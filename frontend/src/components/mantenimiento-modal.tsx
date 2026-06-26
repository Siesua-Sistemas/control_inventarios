"use client";

import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { PhotoGrid } from '@/components/photo-grid';
import { SignaturePad } from '@/components/signature-pad';
import {
  aprobarMantenimiento,
  firmarTecnico,
  iniciarMantenimiento,
  updatePaso,
  type MantenimientoRow,
} from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const PRIORIDAD_BADGE: Record<string, string> = {
  Urgente: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  Alta:    'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
  Media:   'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  Baja:    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const ESTADO_OT_BADGE: Record<string, string> = {
  programado:           'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  en_proceso:           'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  realizado:            'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  cancelado:            'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  pendiente_aprobacion: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  aprobado:             'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  rechazado:            'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
};

const ESTADO_LABEL: Record<string, string> = {
  programado:           'Programado',
  en_proceso:           'En proceso',
  realizado:            'Realizado',
  cancelado:            'Cancelado',
  pendiente_aprobacion: 'Pendiente aprobación',
  aprobado:             'Aprobado',
  rechazado:            'Rechazado',
};

interface MantenimientoModalProps {
  mantenimiento: MantenimientoRow;
  onClose: () => void;
  onUpdate?: (updated: MantenimientoRow) => void;
}

export function MantenimientoModal({ mantenimiento: initial, onClose, onUpdate }: MantenimientoModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { hasPermission } = useAuth();

  const [m, setM] = useState<MantenimientoRow>(initial);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Firma modal state
  const [firmaMode, setFirmaMode] = useState<'tecnico' | 'supervisor' | null>(null);
  const [firmaData, setFirmaData] = useState<string | null>(null);
  const [comentarioRechazo, setComentarioRechazo] = useState('');
  const [rechazando, setRechazando] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !firmaMode) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, firmaMode]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !firmaMode) onClose();
  };

  function applyUpdate(updated: MantenimientoRow) {
    setM(updated);
    onUpdate?.(updated);
  }

  // ── Checklist ──────────────────────────────────────────────────────────────

  async function togglePaso(pasoId: number, completed: boolean) {
    try {
      await updatePaso(m.id, pasoId, { completado: !completed });
      setM((prev) => ({
        ...prev,
        pasos: prev.pasos.map((p) =>
          p.id === pasoId ? { ...p, completado: !completed, completado_en: completed ? null : new Date().toISOString() } : p
        ),
      }));
    } catch { /* silently fail */ }
  }

  // ── Estado transitions ────────────────────────────────────────────────────

  async function handleIniciar() {
    setActionLoading(true); setActionError('');
    try { applyUpdate(await iniciarMantenimiento(m.id)); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Error'); }
    finally { setActionLoading(false); }
  }

  async function handleFirmaTecnico(firma: string) {
    setActionLoading(true); setActionError('');
    try { applyUpdate(await firmarTecnico(m.id, firma)); setFirmaMode(null); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Error'); }
    finally { setActionLoading(false); }
  }

  async function handleAprobar(firma: string) {
    setActionLoading(true); setActionError('');
    try { applyUpdate(await aprobarMantenimiento(m.id, { aprobado: true, firma_supervisor: firma })); setFirmaMode(null); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Error'); }
    finally { setActionLoading(false); }
  }

  async function handleRechazar() {
    setActionLoading(true); setActionError('');
    try { applyUpdate(await aprobarMantenimiento(m.id, { aprobado: false, comentario: comentarioRechazo })); setRechazando(false); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Error'); }
    finally { setActionLoading(false); }
  }

  const totalPasos = m.pasos?.length ?? 0;
  const donePasos = m.pasos?.filter((p) => p.completado).length ?? 0;
  const canUpdate = hasPermission('mantenimientos:update') || hasPermission('mantenimientos:write');
  const canApprove = hasPermission('mantenimientos:approve');

  // ── Firma modal ───────────────────────────────────────────────────────────
  if (firmaMode) {
    const isSupervisor = firmaMode === 'supervisor';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-1 text-lg font-bold">
            {isSupervisor ? 'Firma de aprobación' : 'Firma del técnico'}
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            {isSupervisor
              ? 'Firma como supervisor para aprobar este mantenimiento.'
              : 'Firma para confirmar que realizaste el mantenimiento. El estado pasará a Pendiente de aprobación.'}
          </p>
          <SignaturePad
            label={isSupervisor ? 'Firma del supervisor' : 'Firma del técnico'}
            name={isSupervisor ? 'Supervisor' : 'Técnico'}
            onChange={setFirmaData}
            value={firmaData}
          />
          <div className="mt-4 flex gap-2">
            <button
              disabled={!firmaData || actionLoading}
              onClick={() => firmaData && (isSupervisor ? handleAprobar(firmaData) : handleFirmaTecnico(firmaData))}
              className="flex-1 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-40 transition-colors"
            >
              {actionLoading ? 'Guardando...' : 'Confirmar firma'}
            </button>
            <button
              onClick={() => { setFirmaMode(null); setFirmaData(null); }}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Rechazo modal ─────────────────────────────────────────────────────────
  if (rechazando) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-lg font-bold text-rose-600 dark:text-rose-400">Rechazar OT</h2>
          <label className="mb-1 block text-sm font-medium">Motivo del rechazo</label>
          <textarea
            rows={3}
            value={comentarioRechazo}
            onChange={(e) => setComentarioRechazo(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Describe el motivo..."
          />
          <div className="mt-4 flex gap-2">
            <button
              disabled={actionLoading}
              onClick={handleRechazar}
              className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {actionLoading ? 'Rechazando...' : 'Confirmar rechazo'}
            </button>
            <button
              onClick={() => setRechazando(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main modal ────────────────────────────────────────────────────────────
  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          ✕
        </button>

        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {m.numero_ot && (
              <span className="font-mono text-xs font-semibold text-cyan-700 dark:text-cyan-400">{m.numero_ot}</span>
            )}
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${m.tipo === 'Correctivo' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
              {m.tipo}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORIDAD_BADGE[m.prioridad ?? 'Media'] ?? PRIORIDAD_BADGE.Media}`}>
              {m.prioridad ?? 'Media'}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_OT_BADGE[m.estado] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
              {ESTADO_LABEL[m.estado] ?? m.estado}
            </span>
            <span className="font-mono text-xs text-slate-500">{m.equipment_tipo}</span>
            <span className="text-xs text-slate-500">· {m.equipment_sede}</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{m.equipment_marca} {m.equipment_modelo}</h2>
          <p className="font-mono text-sm text-cyan-600 dark:text-cyan-400">{m.equipment_codigo}</p>
        </div>

        {/* Info grid */}
        <div className="mx-6 mb-4 rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 px-4 py-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Fecha</p>
              <p className="text-slate-800 dark:text-slate-200">{m.fecha.split('T')[0]}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Técnico</p>
              <p className="text-slate-800 dark:text-slate-200">{m.tecnico ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Costo</p>
              <p className="text-slate-800 dark:text-slate-200">{m.costo ? `$${Number(m.costo).toLocaleString()}` : '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Próximo mantenimiento</p>
              <p className="text-slate-800 dark:text-slate-200">{m.proximo_mantenimiento ?? '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wider text-slate-500">Descripción</p>
              <p className="text-slate-800 dark:text-slate-200">{m.descripcion}</p>
            </div>
            {m.observaciones && (
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">Observaciones</p>
                <p className="text-slate-800 dark:text-slate-200">{m.observaciones}</p>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wider text-slate-500">Registrado por</p>
              <p className="text-slate-800 dark:text-slate-200">{m.created_by_nombre} · {m.created_at.split('T')[0]}</p>
            </div>
            {m.aprobado_por_nombre && (
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  {m.estado === 'aprobado' ? 'Aprobado por' : 'Rechazado por'}
                </p>
                <p className="text-slate-800 dark:text-slate-200">
                  {m.aprobado_por_nombre}
                  {m.aprobado_en && <span className="ml-2 text-xs text-slate-400">· {m.aprobado_en.split('T')[0]}</span>}
                </p>
                {m.comentario_aprobacion && <p className="mt-0.5 text-xs text-slate-500">{m.comentario_aprobacion}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Checklist interactivo */}
        {totalPasos > 0 && (
          <div className="mx-6 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Checklist ({donePasos}/{totalPasos})
              </p>
              <div className="h-1.5 w-24 rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-1.5 rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${totalPasos > 0 ? (donePasos / totalPasos) * 100 : 0}%` }}
                />
              </div>
            </div>
            <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
              {m.pasos.map((paso) => (
                <button
                  key={paso.id}
                  onClick={() => canUpdate && togglePaso(paso.id, paso.completado)}
                  disabled={!canUpdate}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors ${canUpdate ? 'hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`flex-none text-base ${paso.completado ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>
                    {paso.completado ? '✓' : '○'}
                  </span>
                  <span className={`text-sm ${paso.completado ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
                    {paso.descripcion}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Acciones de flujo */}
        {actionError && (
          <p className="mx-6 mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">
            {actionError}
          </p>
        )}

        {canUpdate && m.estado === 'programado' && (
          <div className="mx-6 mb-4">
            <button
              onClick={handleIniciar}
              disabled={actionLoading}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Procesando...' : '▶ Iniciar OT'}
            </button>
          </div>
        )}

        {canUpdate && m.estado === 'en_proceso' && (
          <div className="mx-6 mb-4">
            <button
              onClick={() => { setFirmaData(null); setFirmaMode('tecnico'); }}
              disabled={actionLoading}
              className="w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 transition-colors"
            >
              ✏️ Firmar y completar
            </button>
          </div>
        )}

        {canApprove && m.estado === 'pendiente_aprobacion' && (
          <div className="mx-6 mb-4 flex gap-2">
            <button
              onClick={() => { setFirmaData(null); setFirmaMode('supervisor'); }}
              disabled={actionLoading}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              ✓ Aprobar
            </button>
            <button
              onClick={() => setRechazando(true)}
              disabled={actionLoading}
              className="flex-1 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              ✕ Rechazar
            </button>
          </div>
        )}

        {/* Firmas */}
        {(m.firma_tecnico || m.firma_supervisor) && (
          <div className="mx-6 mb-4 grid grid-cols-2 gap-4">
            {m.firma_tecnico && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Firma técnico</p>
                <img src={m.firma_tecnico} alt="Firma técnico" className="h-16 w-full rounded-lg border border-slate-200 bg-white object-contain dark:border-slate-700" />
              </div>
            )}
            {m.firma_supervisor && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Firma supervisor</p>
                <img src={m.firma_supervisor} alt="Firma supervisor" className="h-16 w-full rounded-lg border border-slate-200 bg-white object-contain dark:border-slate-700" />
              </div>
            )}
          </div>
        )}

        {/* Fotos */}
        <div className="mx-6 mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Fotos</p>
          <PhotoGrid photos={m.fotos} apiBase={API_BASE} />
        </div>
      </div>
    </div>
  );
}
