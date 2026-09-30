"use client";

import { useEffect, useState } from 'react';

import { addPaso, deletePaso, updatePaso, type PasoRow } from '@/lib/api';

interface MantenimientoChecklistProps {
  mantenimientoId: number;
  pasos: PasoRow[];
  /** Puede marcar/desmarcar y diligenciar valores (técnico ejecutando la OT). */
  canFill: boolean;
  /** Puede agregar o eliminar pasos del checklist (supervisor/admin). */
  canManage: boolean;
  onRefresh: () => void | Promise<void>;
  /**
   * OT aprobada / cerrada: se muestra como informe técnico terminado — texto plano de
   * resultados, sin bordes de campo ni botones — en vez de un formulario deshabilitado.
   */
  reportMode?: boolean;
}

function IconTrash({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0-.6 12.1a2 2 0 0 1-2 1.9H9.6a2 2 0 0 1-2-1.9L7 7h10Z" />
    </svg>
  );
}

function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconCheck({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function IconWarning({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9 1.9 18a1.5 1.5 0 0 0 1.3 2.2h17.6a1.5 1.5 0 0 0 1.3-2.2L13.7 3.9a1.5 1.5 0 0 0-2.6 0Z" />
    </svg>
  );
}

const fmtNum = (s: string | null): string | null => (s == null || s === '' ? null : String(Number(s)));

function fueraDeRango(p: PasoRow): boolean {
  if (p.tipo_campo !== 'numero' || !p.valor) return false;
  const n = Number(p.valor);
  if (Number.isNaN(n)) return false;
  if (p.valor_min != null && n < Number(p.valor_min)) return true;
  if (p.valor_max != null && n > Number(p.valor_max)) return true;
  return false;
}

export function MantenimientoChecklist({ mantenimientoId, pasos, canFill, canManage, onRefresh, reportMode = false }: MantenimientoChecklistProps) {
  const [local, setLocal] = useState<PasoRow[]>(pasos);
  useEffect(() => { setLocal(pasos); }, [pasos]);

  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const total = local.length;
  const done = local.filter((p) => p.completado).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (reportMode) {
    return <ChecklistReport pasos={local} />;
  }

  async function toggle(paso: PasoRow) {
    if (!canFill) return;
    const next = !paso.completado;
    setLocal((prev) => prev.map((p) => (p.id === paso.id ? { ...p, completado: next } : p)));
    setBusyId(paso.id);
    try {
      await updatePaso(mantenimientoId, paso.id, { completado: next });
    } finally {
      setBusyId(null);
      onRefresh();
    }
  }

  function setValorLocal(pasoId: number, valor: string) {
    setLocal((prev) => prev.map((p) => (p.id === pasoId ? { ...p, valor } : p)));
  }

  async function saveValor(pasoId: number, valor: string) {
    setBusyId(pasoId);
    try {
      await updatePaso(mantenimientoId, pasoId, { valor });
    } finally {
      setBusyId(null);
      onRefresh();
    }
  }

  async function remove(pasoId: number) {
    setBusyId(pasoId);
    try {
      await deletePaso(mantenimientoId, pasoId);
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newDesc.trim()) return;
    setAdding(true);
    try {
      await addPaso(mantenimientoId, newDesc.trim(), total);
      setNewDesc('');
      await onRefresh();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-3">
      {total > 0 && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300 dark:from-emerald-500 dark:to-emerald-400"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">
            {done}/{total}
          </span>
        </div>
      )}

      <ul className="space-y-2">
        {local.map((paso) => {
          const tipo = paso.tipo_campo ?? 'checkbox';
          const opcional = paso.obligatorio === false;
          const busy = busyId === paso.id;
          const outOfRange = fueraDeRango(paso);

          if (tipo === 'checkbox') {
            return (
              <li key={paso.id}>
                <div
                  className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors ${
                    paso.completado
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-500/10'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(paso)}
                    disabled={!canFill || busy}
                    aria-pressed={paso.completado}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      paso.completado
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-800'
                    } ${canFill ? 'active:scale-90' : 'cursor-default opacity-70'}`}
                  >
                    <IconCheck />
                  </button>
                  <button
                    type="button"
                    onClick={() => toggle(paso)}
                    disabled={!canFill || busy}
                    className={`flex-1 text-left text-[15px] leading-snug ${
                      paso.completado ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-800 dark:text-slate-200'
                    } ${canFill ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    {paso.descripcion}
                    {opcional && <span className="ml-1.5 text-xs font-normal text-slate-400">(opcional)</span>}
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => remove(paso.id)}
                      disabled={busy}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              </li>
            );
          }

          return (
            <li key={paso.id}>
              <div
                className={`rounded-2xl border px-3.5 py-3 transition-colors ${
                  paso.completado
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-500/10'
                    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      paso.completado
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 bg-white text-transparent dark:border-slate-600 dark:bg-slate-800'
                    }`}
                  >
                    <IconCheck className="h-3 w-3" />
                  </span>
                  <span className="flex-1 pt-0.5 text-[15px] leading-snug text-slate-800 dark:text-slate-200">
                    {paso.descripcion}
                    {opcional && <span className="ml-1.5 text-xs font-normal text-slate-400">(opcional)</span>}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => remove(paso.id)}
                      disabled={busy}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>

                <div className="mt-2.5 pl-9">
                  {tipo === 'numero' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          disabled={!canFill}
                          value={paso.valor ?? ''}
                          onChange={(e) => setValorLocal(paso.id, e.target.value)}
                          onBlur={(e) => canFill && saveValor(paso.id, e.target.value)}
                          placeholder="Valor"
                          className={`w-28 rounded-xl border bg-white px-3 py-2.5 text-base font-medium text-slate-900 focus:outline-none disabled:opacity-60 dark:bg-slate-800 dark:text-white ${
                            outOfRange ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-cyan-500 dark:border-slate-600'
                          }`}
                        />
                        {paso.unidad && <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{paso.unidad}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(paso.valor_min != null || paso.valor_max != null) && (
                          <span className="text-xs text-slate-400">
                            rango aceptado: {fmtNum(paso.valor_min) ?? '−∞'}–{fmtNum(paso.valor_max) ?? '∞'}
                          </span>
                        )}
                        {outOfRange && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300">
                            <IconWarning /> fuera de rango
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {tipo === 'texto' && (
                    <textarea
                      rows={2}
                      disabled={!canFill}
                      value={paso.valor ?? ''}
                      onChange={(e) => setValorLocal(paso.id, e.target.value)}
                      onBlur={(e) => canFill && saveValor(paso.id, e.target.value)}
                      placeholder="Escribe el resultado..."
                      className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 focus:border-cyan-500 focus:outline-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                    />
                  )}

                  {tipo === 'seleccion' && (
                    <div className="flex flex-wrap gap-2">
                      {(paso.opciones ?? []).map((o) => {
                        const selected = paso.valor === o;
                        return (
                          <button
                            key={o}
                            type="button"
                            disabled={!canFill}
                            onClick={() => canFill && saveValor(paso.id, o)}
                            className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
                              selected
                                ? 'border-cyan-500 bg-cyan-500 text-white'
                                : 'border-slate-300 bg-white text-slate-700 hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {canManage && (
        <form onSubmit={handleAdd} className="flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/40">
          <input
            type="text"
            placeholder="+ Agregar paso al checklist..."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 text-[15px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 dark:text-slate-200 dark:placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={adding || !newDesc.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white transition-colors hover:bg-cyan-400 disabled:opacity-40"
          >
            <IconPlus />
          </button>
        </form>
      )}
    </div>
  );
}

// ── Modo informe: OT cerrada — texto de resultados, sin apariencia de formulario ──

function ChecklistReport({ pasos }: { pasos: PasoRow[] }) {
  const total = pasos.length;
  const done = pasos.filter((p) => p.completado).length;

  return (
    <div className="space-y-3">
      {total > 0 && (
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {done} de {total} puntos conformes
        </p>
      )}
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {pasos.map((paso) => {
          const tipo = paso.tipo_campo ?? 'checkbox';
          const opcional = paso.obligatorio === false;
          const outOfRange = fueraDeRango(paso);

          return (
            <div key={paso.id} className="flex items-start gap-3 px-4 py-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                  paso.completado
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                }`}
              >
                {paso.completado ? <IconCheck className="h-3 w-3" /> : <span className="h-1 w-1 rounded-full bg-current" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  {paso.descripcion}
                  {opcional && <span className="ml-1.5 text-xs font-normal text-slate-400">(opcional)</span>}
                </p>

                {tipo === 'checkbox' && (
                  <p className={`mt-0.5 text-xs ${paso.completado ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {paso.completado ? 'Conforme' : 'No conforme'}
                  </p>
                )}

                {tipo === 'numero' && (
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {paso.valor !== null && paso.valor !== '' ? fmtNum(paso.valor) : '—'}
                    </span>
                    {paso.unidad && <span className="text-slate-500 dark:text-slate-400">{paso.unidad}</span>}
                    {outOfRange && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/20 dark:text-red-300">
                        <IconWarning /> fuera de rango
                      </span>
                    )}
                  </p>
                )}

                {tipo === 'texto' && (
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                    {paso.valor?.trim() ? paso.valor : '—'}
                  </p>
                )}

                {tipo === 'seleccion' && (
                  <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {paso.valor || '—'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
