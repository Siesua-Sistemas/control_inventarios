"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import { SignaturePad } from '@/components/signature-pad';
import {
  MOTIVOS_BAJA,
  aprobarBaja,
  isAuthenticated,
  listBajas,
  type BajaEquipoRow,
} from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const MOTIVO_LABEL: Record<string, string> = Object.fromEntries(MOTIVOS_BAJA.map((m) => [m.value, m.label]));

const ESTADO_BADGE: Record<string, string> = {
  pendiente_aprobacion: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  aprobada: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
  rechazada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente_aprobacion: 'Pendiente de aprobación',
  aprobada: 'Aprobada — Dado de baja',
  rechazada: 'Rechazada',
};

function AprobarPanel({ baja, onDone }: { baja: BajaEquipoRow; onDone: () => void }) {
  const [firma, setFirma] = useState<string | null>(null);
  const [comentario, setComentario] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleDecidir = async (aprobado: boolean) => {
    if (!firma) { setError('Firma requerida para aprobar o rechazar.'); return; }
    setSaving(true);
    setError('');
    try {
      await aprobarBaja(baja.id, { aprobado, firma_autoriza: firma, comentario: comentario.trim() || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar');
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Comentario (opcional)</label>
        <input
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Notas sobre la decisión"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
        />
      </div>
      <SignaturePad label="Firma de quien autoriza *" name="firma_autoriza" value={firma} onChange={setFirma} />
      {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>}
      {baja.fotos.length === 0 && (
        <p className="rounded-md bg-amber-100 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
          Esta solicitud no tiene fotos de evidencia — no se puede aprobar hasta que el solicitante suba al menos una.
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handleDecidir(true)}
          disabled={saving || baja.fotos.length === 0}
          className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
        >
          {saving ? 'Procesando...' : 'Aprobar baja'}
        </button>
        <button
          type="button"
          onClick={() => handleDecidir(false)}
          disabled={saving}
          className="rounded-md bg-slate-200 px-5 py-2 text-sm text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

function BajaCard({ baja, canAprobar, onUpdated }: { baja: BajaEquipoRow; canAprobar: boolean; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full flex-wrap items-center gap-3 px-5 py-4 text-left">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_BADGE[baja.estado] ?? 'bg-slate-200 text-slate-700'}`}>
          {ESTADO_LABEL[baja.estado] ?? baja.estado}
        </span>
        <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">{baja.equipment_codigo}</span>
        <span className="text-sm text-slate-800 dark:text-slate-200">{baja.equipment_marca} {baja.equipment_modelo}</span>
        <span className="text-xs text-slate-500">{MOTIVO_LABEL[baja.motivo] ?? baja.motivo}</span>
        <span className="ml-auto text-xs text-slate-500">
          {new Date(baja.solicitado_en).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
        <span className="text-slate-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Solicitado por</p>
              <p className="text-slate-800 dark:text-slate-200">{baja.solicitado_por_nombre}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Sede</p>
              <p className="text-slate-800 dark:text-slate-200">{baja.equipment_sede}</p>
            </div>
            {baja.motivo_detalle && (
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">Detalle</p>
                <p className="text-slate-800 dark:text-slate-200">{baja.motivo_detalle}</p>
              </div>
            )}
            {baja.observaciones && (
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">Observaciones</p>
                <p className="text-slate-800 dark:text-slate-200">{baja.observaciones}</p>
              </div>
            )}
            {baja.autorizado_por_nombre && (
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  {baja.estado === 'aprobada' ? 'Aprobada por' : 'Rechazada por'}
                </p>
                <p className="text-slate-800 dark:text-slate-200">
                  {baja.autorizado_por_nombre}
                  {baja.autorizado_en && ` · ${new Date(baja.autorizado_en).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </p>
                {baja.comentario_aprobacion && <p className="mt-0.5 text-xs text-slate-500">{baja.comentario_aprobacion}</p>}
              </div>
            )}
          </div>

          {baja.fotos.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs uppercase tracking-wider text-slate-500">Evidencia fotográfica</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {baja.fotos.map((f) => (
                  <a key={f.id} href={`${API_BASE}${f.url}`} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${API_BASE}${f.url}`} alt="Evidencia" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {baja.estado === 'pendiente_aprobacion' && canAprobar && (
            <AprobarPanel baja={baja} onDone={onUpdated} />
          )}
        </div>
      )}
    </div>
  );
}

export default function BajasEquipoPage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canAprobar = authLoading || hasPermission('equipos:baja_aprobar');

  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes');
  const [items, setItems] = useState<BajaEquipoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (t: 'pendientes' | 'historial' = tab) => {
    setLoading(true);
    try {
      const r = await listBajas(t === 'pendientes' ? { estado: 'pendiente_aprobacion', limit: 200 } : { limit: 200 });
      setItems(t === 'pendientes' ? r.items : r.items.filter((b) => b.estado !== 'pendiente_aprobacion'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    load('pendientes');
  }, [router]);

  const handleTab = (t: 'pendientes' | 'historial') => {
    setTab(t);
    load(t);
  };

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-red-600 dark:text-red-400">Inventario</p>
          <h1 className="mt-1 text-3xl font-bold">Bajas de equipos</h1>
          <p className="mt-1 text-sm text-slate-500">Solicitudes para dar de baja equipos dañados, obsoletos o perdidos.</p>
        </div>

        <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit dark:border-slate-800 dark:bg-slate-900">
          {[
            { id: 'pendientes' as const, label: 'Pendientes' },
            { id: 'historial' as const, label: 'Historial' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => handleTab(id)}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-colors ${
                tab === id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-red-500 dark:border-slate-700 dark:border-t-red-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 py-16 text-center text-slate-500">
            {tab === 'pendientes' ? 'No hay solicitudes de baja pendientes.' : 'Sin historial de bajas.'}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((b) => (
              <BajaCard key={b.id} baja={b} canAprobar={canAprobar} onUpdated={() => load(tab)} />
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-slate-400">
          ¿Necesitas dar de baja un equipo? Entra a su{' '}
          <Link href="/equipos" className="text-cyan-600 hover:underline dark:text-cyan-400">hoja de vida</Link>{' '}
          y usa el botón "Dar de baja" en la pestaña Resumen.
        </p>
      </main>
    </>
  );
}
