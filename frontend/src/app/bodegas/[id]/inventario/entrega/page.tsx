"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import { SignaturePad } from '@/components/signature-pad';
import {
  createActaEntrega,
  getBodegaInventario,
  isAuthenticated,
  type BodegaInventario,
  type EquipmentRow,
} from '@/lib/api';
import { ESTADO_COLORS } from '@/lib/constants';

type Step = 'checklist' | 'firmas' | 'guardando' | 'listo';

export default function EntregaBodegaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const [data, setData] = useState<BodegaInventario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('checklist');

  // Checklist
  const [checked, setChecked] = useState<Set<number>>(new Set());

  // Firmas
  const [entregaNombre, setEntregaNombre] = useState('');
  const [recibeNombre, setRecibeNombre] = useState('');
  const [firmaEntrega, setFirmaEntrega] = useState<string | null>(null);
  const [firmaRecibe, setFirmaRecibe] = useState<string | null>(null);
  const [observaciones, setObservaciones] = useState('');

  // Resultado
  const [actaId, setActaId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (!authLoading && !hasPermission('bodegas:write')) {
      router.replace(`/bodegas/${id}/inventario`);
      return;
    }
    if (authLoading) return;
    getBodegaInventario(Number(id))
      .then((d) => {
        setData(d);
        setEntregaNombre(d.bodega.responsable ?? '');
      })
      .catch(() => setError('Error al cargar el inventario.'))
      .finally(() => setLoading(false));
  }, [id, router, authLoading, hasPermission]);

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
        </main>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
          <p className="text-red-600 dark:text-red-300">{error || 'Error'}</p>
          <button onClick={() => router.back()} className="text-indigo-600 dark:text-indigo-400 hover:underline">← Volver</button>
        </main>
      </>
    );
  }

  const allChecked = checked.size === data.equipos.length && data.equipos.length > 0;
  const today = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

  // Agrupar equipos: cada dispositivo padre junto con sus periféricos/hijos asociados
  const equipoIds = new Set(data.equipos.map((e) => e.id));
  const childrenByParent = new Map<number, EquipmentRow[]>();
  for (const eq of data.equipos) {
    if (eq.parent_equipment_id != null && equipoIds.has(eq.parent_equipment_id)) {
      const arr = childrenByParent.get(eq.parent_equipment_id) ?? [];
      arr.push(eq);
      childrenByParent.set(eq.parent_equipment_id, arr);
    }
  }
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.codigo_interno.localeCompare(b.codigo_interno));
  }
  const topLevelEquipos = data.equipos
    .filter((eq) => eq.parent_equipment_id == null || !equipoIds.has(eq.parent_equipment_id))
    .slice()
    .sort((a, b) => a.codigo_interno.localeCompare(b.codigo_interno));

  const toggleCheck = (equipoId: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(equipoId)) next.delete(equipoId);
      else next.add(equipoId);
      return next;
    });
  };

  const checkAll = () => {
    if (allChecked) setChecked(new Set());
    else setChecked(new Set(data.equipos.map((e) => e.id)));
  };

  const renderEquipoRow = (eq: EquipmentRow, isChild: boolean, peripheralCount = 0) => {
    const isChecked = checked.has(eq.id);
    return (
      <label
        key={eq.id}
        className={`flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors ${isChild ? 'pl-14' : ''} ${
          isChecked
            ? 'bg-emerald-50 dark:bg-emerald-500/5'
            : isChild
            ? 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950/40 dark:hover:bg-slate-900'
            : 'hover:bg-slate-100 dark:hover:bg-slate-900'
        }`}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => toggleCheck(eq.id)}
          className="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 dark:border-slate-600 accent-emerald-500"
        />
        {isChild && <span className="shrink-0 text-slate-400 dark:text-slate-600">↳</span>}
        <div className="grid flex-1 grid-cols-4 gap-3 items-center min-w-0">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Código</p>
            <p className="flex items-center gap-2 font-mono text-sm font-bold text-cyan-600 dark:text-cyan-400 truncate">
              {eq.codigo_interno}
              {peripheralCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                  +{peripheralCount} periférico{peripheralCount > 1 ? 's' : ''}
                </span>
              )}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Tipo</p>
            <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{eq.tipo}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500">Marca / Modelo</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{eq.marca} {eq.modelo}</p>
          </div>
          <div className="min-w-0">
            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ESTADO_COLORS[eq.estado] ?? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
              {eq.estado}
            </span>
          </div>
        </div>
        {isChecked && <span className="shrink-0 text-emerald-600 dark:text-emerald-400">✓</span>}
      </label>
    );
  };

  const handleGuardar = async () => {
    if (!entregaNombre.trim() || !recibeNombre.trim()) {
      setSaveError('Ingresa los nombres de quien entrega y quien recibe.');
      return;
    }
    setSaveError('');
    setStep('guardando');
    try {
      const snapshot = data.equipos.map((e) => ({
        id: e.id,
        codigo_interno: e.codigo_interno,
        serial: e.serial,
        tipo: e.tipo,
        marca: e.marca,
        modelo: e.modelo,
        estado: e.estado,
      }));
      const acta = await createActaEntrega({
        tipo: 'bodega',
        sede: data.bodega.sede,
        titulo: data.bodega.nombre,
        entrega_nombre: entregaNombre.trim(),
        recibe_nombre: recibeNombre.trim(),
        firma_entrega: firmaEntrega ?? undefined,
        firma_recibe: firmaRecibe ?? undefined,
        equipos_snapshot: snapshot,
        bodega_id: Number(id),
        observaciones: observaciones.trim() || undefined,
      });
      setActaId(acta.id);
      setStep('listo');
    } catch {
      setSaveError('Error al guardar el acta. Intenta nuevamente.');
      setStep('firmas');
    }
  };

  // ─── Paso: listo ────────────────────────────────────────────────────────────
  if (step === 'listo' && actaId) {
    return (
      <>
        <NavBar />
        <main className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="mb-6 text-5xl">✅</div>
          <h1 className="text-2xl font-bold">Acta guardada</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">El acta de entrega ha sido registrada correctamente.</p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/actas/${actaId}/imprimir`}
              className="rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              🖨 Imprimir / Guardar PDF
            </Link>
            <Link
              href="/actas"
              className="rounded-lg border border-slate-300 bg-slate-100 px-6 py-3 text-sm text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Ver historial de actas
            </Link>
            <Link
              href={`/bodegas/${id}/inventario`}
              className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              ← Volver al inventario
            </Link>
          </div>
        </main>
      </>
    );
  }

  // ─── Paso: guardando ────────────────────────────────────────────────────────
  if (step === 'guardando') {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
            <p className="text-slate-600 dark:text-slate-400">Guardando acta...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <Link href={`/bodegas/${id}/inventario/acta`} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            ← Acta
          </Link>
          <h1 className="mt-1 text-2xl font-bold">Proceso de Entrega</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">{data.bodega.nombre} · {data.bodega.sede}</p>
        </div>

        {/* Stepper */}
        <div className="mb-8 flex items-center gap-0">
          {[
            { key: 'checklist', label: '1. Revisión' },
            { key: 'firmas', label: '2. Firmas' },
          ].map((s, i) => (
            <div key={s.key} className="flex items-center gap-0">
              {i > 0 && <div className={`h-px w-12 ${step === 'firmas' ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`} />}
              <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                step === s.key
                  ? 'bg-indigo-600 text-white'
                  : step === 'firmas' && s.key === 'checklist'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {step === 'firmas' && s.key === 'checklist' ? '✓' : null}
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Paso 1: Checklist ─────────────────────────────────────────────── */}
        {step === 'checklist' && (
          <div className="rounded-2xl border border-slate-300 dark:border-slate-700 overflow-hidden">
            <div className="bg-white px-6 py-4 border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold">Revisión de inventario</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">Verifica y marca cada equipo antes de continuar</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-400">{checked.size}/{data.equipos.length}</span>
                <button
                  onClick={checkAll}
                  className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                >
                  {allChecked ? 'Desmarcar todo' : 'Marcar todo'}
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {topLevelEquipos.map((eq) => {
                const children = childrenByParent.get(eq.id) ?? [];
                return (
                  <div key={eq.id}>
                    {renderEquipoRow(eq, false, children.length)}
                    {children.map((child) => renderEquipoRow(child, true))}
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-100 border-t border-slate-200 dark:bg-slate-950 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {allChecked
                  ? 'Todos los equipos revisados. Listo para continuar.'
                  : `Faltan ${data.equipos.length - checked.size} por revisar.`}
              </p>
              <button
                onClick={() => setStep('firmas')}
                disabled={!allChecked}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continuar a firmas →
              </button>
            </div>
          </div>
        )}

        {/* ─── Paso 2: Firmas ────────────────────────────────────────────────── */}
        {step === 'firmas' && (
          <div className="space-y-6">
            {/* Datos del acta */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Datos del acta</p>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Asesora que entrega *</span>
                  <input
                    value={entregaNombre}
                    onChange={(e) => setEntregaNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-600 dark:text-slate-400">Asesora que recibe *</span>
                  <input
                    value={recibeNombre}
                    onChange={(e) => setRecibeNombre(e.target.value)}
                    placeholder="Nombre completo"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                  />
                </label>
              </div>
              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-400">Observaciones (opcional)</span>
                <textarea
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                  placeholder="Novedades, estado general, aclaraciones..."
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none resize-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                />
              </label>
            </div>

            {/* Pads de firma */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                <SignaturePad
                  label="Firma quien entrega"
                  name={entregaNombre || '—'}
                  onChange={setFirmaEntrega}
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
                <SignaturePad
                  label="Firma quien recibe"
                  name={recibeNombre || '—'}
                  onChange={setFirmaRecibe}
                />
              </div>
            </div>

            {saveError && (
              <p className="rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-300">{saveError}</p>
            )}

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep('checklist')}
                className="rounded-lg border border-slate-300 bg-slate-100 px-5 py-2 text-sm text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                ← Volver al checklist
              </button>
              <div className="flex items-center gap-3">
                <p className="text-xs text-slate-500">
                  {today} · {data.total} equipos · {data.bodega.sede}
                </p>
                <button
                  onClick={handleGuardar}
                  className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                >
                  Confirmar y guardar acta ✓
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
