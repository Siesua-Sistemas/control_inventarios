"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  BodegaRow,
  SedeJornadaCreate,
  SedeJornadaOut,
  createSedeJornada,
  deleteSedeJornada,
  getSedesJornada,
  listBodegas,
  updateSedeJornada,
} from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

// ── Formulario de sede ────────────────────────────────────────────────────────

const EMPTY_FORM: SedeJornadaCreate = {
  nombre: '',
  direccion: '',
  ciudad: '',
  latitud: 0,
  longitud: 0,
  radio_metros: 100,
  ip_autorizada: '',
  tipo: 'empresa',
  bodega_ids: [],
};

function SedeForm({
  inicial,
  onGuardar,
  onCancelar,
}: {
  inicial?: Partial<SedeJornadaCreate>;
  onGuardar: (data: SedeJornadaCreate) => Promise<void>;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState<SedeJornadaCreate>({ ...EMPTY_FORM, ...inicial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMsg, setGpsMsg] = useState('');
  const [ipLoading, setIpLoading] = useState(false);
  const [ipMsg, setIpMsg] = useState('');
  const [bodegas, setBodegas] = useState<BodegaRow[]>([]);

  useEffect(() => {
    listBodegas().then((r) => setBodegas(r.items)).catch(() => {});
  }, []);

  const toggleBodega = (id: number) => {
    setForm((f) => {
      const ids = f.bodega_ids ?? [];
      if (ids.includes(id)) return { ...f, bodega_ids: ids.filter((x) => x !== id) };
      if (ids.length >= 2) return f; // max 2
      return { ...f, bodega_ids: [...ids, id] };
    });
  };

  const set = (k: keyof SedeJornadaCreate, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onGuardar(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const usarUbicacionActual = () => {
    if (!navigator.geolocation) {
      setGpsMsg('GPS no disponible en este navegador.');
      return;
    }
    setGpsLoading(true);
    setGpsMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitud: parseFloat(pos.coords.latitude.toFixed(7)),
          longitud: parseFloat(pos.coords.longitude.toFixed(7)),
        }));
        setGpsMsg(`Precisión: ±${Math.round(pos.coords.accuracy)} m`);
        setGpsLoading(false);
      },
      (err) => {
        setGpsMsg(err.code === 1 ? 'Permiso de ubicación denegado.' : 'No se pudo obtener la ubicación.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const leerIpPublica = async () => {
    setIpLoading(true);
    setIpMsg('');
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json() as { ip: string };
      set('ip_autorizada', data.ip);
      setIpMsg(`Detectada: ${data.ip}`);
    } catch {
      setIpMsg('No se pudo detectar la IP pública.');
    } finally {
      setIpLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tipo de sede */}
      <div className="grid grid-cols-2 gap-3">
        {([
          {
            value: 'empresa',
            label: 'Sede empresa',
            desc: 'Ubicación física con bodega(s)',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
            ),
          },
          {
            value: 'home_office',
            label: 'Home Office',
            desc: 'Ubicación remota del empleado',
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            ),
          },
        ] as const).map((opt) => {
          const active = form.tipo === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, tipo: opt.value, bodega_ids: opt.value === 'home_office' ? [] : f.bodega_ids }))}
              className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                active
                  ? opt.value === 'empresa'
                    ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-500 dark:bg-cyan-900/20'
                    : 'border-violet-500 bg-violet-50 dark:border-violet-500 dark:bg-violet-900/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/50'
              }`}
            >
              <span className={`mt-0.5 shrink-0 ${active ? (opt.value === 'empresa' ? 'text-cyan-600 dark:text-cyan-400' : 'text-violet-600 dark:text-violet-400') : 'text-slate-400'}`}>
                {opt.icon}
              </span>
              <span>
                <span className={`block text-sm font-semibold ${active ? 'text-slate-900 dark:text-slate-50' : 'text-slate-600 dark:text-slate-300'}`}>{opt.label}</span>
                <span className="block text-xs text-slate-400">{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="nombre">Nombre de la sede *</label>
          <input id="nombre" type="text" value={form.nombre}
            onChange={(e) => set('nombre', e.target.value)} required
            placeholder={form.tipo === 'home_office' ? 'Ej: Home Office María López' : 'Ej: VIP109, Unicentro'} />
        </div>
        <div>
          <label htmlFor="ciudad">Ciudad</label>
          <input id="ciudad" type="text" value={form.ciudad ?? ''}
            onChange={(e) => set('ciudad', e.target.value)} placeholder="Bogotá" />
        </div>
        <div>
          <label htmlFor="ip_autorizada">IP autorizada</label>
          <div className="flex gap-2">
            <input id="ip_autorizada" type="text" value={form.ip_autorizada ?? ''}
              onChange={(e) => set('ip_autorizada', e.target.value)}
              placeholder="190.xxx.xxx.xxx"
              className="flex-1 min-w-0" />
            <button
              type="button"
              onClick={leerIpPublica}
              disabled={ipLoading}
              title="Detectar IP pública de esta red"
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {ipLoading ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              )}
              Leer IP
            </button>
          </div>
          {ipMsg && (
            <p className={`mt-1 text-xs ${ipMsg.startsWith('No') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {ipMsg}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="direccion">Dirección</label>
          <input id="direccion" type="text" value={form.direccion ?? ''}
            onChange={(e) => set('direccion', e.target.value)}
            placeholder="Cra 15 # 97-20, Bogotá" />
        </div>
      </div>

      {/* Coordenadas y radio */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Geovalla
          </p>
          <button
            type="button"
            onClick={usarUbicacionActual}
            disabled={gpsLoading}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-700 hover:bg-cyan-100 disabled:opacity-50 dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 dark:hover:bg-cyan-900/50"
          >
            {gpsLoading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-300 border-t-cyan-600" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            )}
            Usar ubicación actual
          </button>
        </div>
        {gpsMsg && (
          <p className={`mb-3 text-xs ${gpsMsg.includes('denegado') || gpsMsg.includes('pudo') ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
            📍 {gpsMsg}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="lat">Latitud *</label>
            <input id="lat" type="number" step="any" value={form.latitud}
              onChange={(e) => set('latitud', parseFloat(e.target.value) || 0)} required
              placeholder="4.6940" />
          </div>
          <div>
            <label htmlFor="lon">Longitud *</label>
            <input id="lon" type="number" step="any" value={form.longitud}
              onChange={(e) => set('longitud', parseFloat(e.target.value) || 0)} required
              placeholder="-74.0750" />
          </div>
          <div>
            <label htmlFor="radio">Radio (metros) *</label>
            <input id="radio" type="number" min="10" max="5000" value={form.radio_metros}
              onChange={(e) => set('radio_metros', parseInt(e.target.value) || 100)} required />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Tip: usa el botón estando físicamente en la sede, o copia las coordenadas desde Google Maps (clic derecho en el mapa).
        </p>
      </div>

      {/* Bodegas asociadas — solo para sedes empresa */}
      {form.tipo === 'empresa' && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Bodegas asociadas
          </p>
          <span className="text-xs text-slate-400">Máximo 2</span>
        </div>
        {bodegas.length === 0 ? (
          <p className="text-xs text-slate-400">No hay bodegas disponibles.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bodegas.map((b) => {
              const sel = (form.bodega_ids ?? []).includes(b.id);
              const atLimit = (form.bodega_ids ?? []).length >= 2 && !sel;
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={atLimit}
                  onClick={() => toggleBodega(b.id)}
                  title={atLimit ? 'Máximo 2 bodegas por sede' : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                    sel
                      ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950'
                      : 'border border-slate-300 bg-white text-slate-600 hover:border-emerald-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {sel && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                  {b.nombre}
                  {b.sede ? <span className="opacity-60">· {b.sede}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>}

      {error && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancelar}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950">
          {saving ? 'Guardando…' : 'Guardar sede'}
        </button>
      </div>
    </form>
  );
}

// ── SedeCard ──────────────────────────────────────────────────────────────────

function SedeCard({
  sede,
  onEdit,
  onDelete,
}: {
  sede: SedeJornadaOut;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const googleMapsUrl = `https://www.google.com/maps?q=${sede.latitud},${sede.longitud}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-slate-50">{sede.nombre}</h3>
            {sede.tipo === 'home_office' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
                Home Office
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                </svg>
                Sede empresa
              </span>
            )}
            {sede.ciudad && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {sede.ciudad}
              </span>
            )}
          </div>
          {sede.direccion && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{sede.direccion}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onEdit}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          </button>
          <button type="button" onClick={onDelete}
            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
            title="Eliminar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Datos geovalla */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
          <p className="text-xs text-slate-400">Latitud</p>
          <p className="font-mono text-sm font-semibold">{sede.latitud.toFixed(6)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
          <p className="text-xs text-slate-400">Longitud</p>
          <p className="font-mono text-sm font-semibold">{sede.longitud.toFixed(6)}</p>
        </div>
        <div className="rounded-lg bg-emerald-50 px-3 py-2 dark:bg-emerald-900/20">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Radio</p>
          <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{sede.radio_metros} m</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
          <p className="text-xs text-slate-400">IP autorizada</p>
          <p className="font-mono text-sm">{sede.ip_autorizada || '—'}</p>
        </div>
      </div>

      {sede.bodegas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-400 self-center">Bodegas:</span>
          {sede.bodegas.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              {b.nombre}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Ver en Google Maps
        </a>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SedesAdminPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const [sedes, setSedes] = useState<SedeJornadaOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<'lista' | 'nueva' | 'editar'>('lista');
  const [editando, setEditando] = useState<SedeJornadaOut | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SedeJornadaOut | null>(null);
  const [deleting, setDeleting] = useState(false);

  const puedeAdmin = hasPermission('jornada:admin');

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    try {
      const data = await getSedesJornada();
      setSedes(data);
    } finally {
      setLoading(false);
    }
  }

  const handleNueva = async (data: SedeJornadaCreate) => {
    await createSedeJornada(data);
    await cargar();
    setModo('lista');
  };

  const handleEditar = async (data: SedeJornadaCreate) => {
    if (!editando) return;
    await updateSedeJornada(editando.id, data);
    await cargar();
    setModo('lista');
    setEditando(null);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteSedeJornada(confirmDelete.id);
      await cargar();
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => router.back()}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
              </button>
              <div>
                <p className="text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-300">
                  Mi Jornada · Admin
                </p>
                <h1 className="text-lg font-bold">Sedes y Geovallas</h1>
              </div>
            </div>
          </div>
          {puedeAdmin && modo === 'lista' && (
            <button
              type="button"
              onClick={() => { setModo('nueva'); setEditando(null); }}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nueva sede
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">

        {/* Formulario nueva / editar */}
        {(modo === 'nueva' || modo === 'editar') && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-5 font-semibold">
              {modo === 'nueva' ? 'Nueva sede' : `Editar: ${editando?.nombre}`}
            </h2>
            <SedeForm
              inicial={editando ? {
                nombre: editando.nombre,
                direccion: editando.direccion ?? '',
                ciudad: editando.ciudad ?? '',
                latitud: editando.latitud,
                longitud: editando.longitud,
                radio_metros: editando.radio_metros,
                ip_autorizada: editando.ip_autorizada ?? '',
                tipo: editando.tipo,
                bodega_ids: editando.bodegas.map((b) => b.id),
              } : undefined}
              onGuardar={modo === 'nueva' ? handleNueva : handleEditar}
              onCancelar={() => { setModo('lista'); setEditando(null); }}
            />
          </div>
        )}

        {/* Lista de sedes */}
        {modo === 'lista' && (
          <>
            {loading ? (
              <div className="flex justify-center py-12">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
              </div>
            ) : sedes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <p className="font-semibold text-slate-600 dark:text-slate-400">No hay sedes configuradas</p>
                <p className="mt-1 text-sm text-slate-400">
                  Agrega una sede con sus coordenadas GPS para activar la validación de geovalla.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sedes.map((sede) => (
                  <SedeCard
                    key={sede.id}
                    sede={sede}
                    onEdit={() => { setEditando(sede); setModo('editar'); }}
                    onDelete={() => setConfirmDelete(sede)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Info sobre geovalla */}
        {modo === 'lista' && (
          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 dark:border-cyan-800 dark:bg-cyan-900/20">
            <div className="flex gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div className="text-sm text-cyan-800 dark:text-cyan-200">
                <p className="font-semibold mb-1">¿Cómo funciona la geovalla?</p>
                <p>El nombre de la sede debe coincidir exactamente con el campo <strong>Sede</strong> del empleado. Cuando un colaborador registre su jornada, el sistema verificará que su GPS esté dentro del radio configurado.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal confirmar eliminar */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="font-bold">¿Eliminar sede?</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Se eliminará la geovalla de <strong>{confirmDelete.nombre}</strong>. Los empleados de esa sede podrán registrar jornada desde cualquier ubicación.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
                Cancelar
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
