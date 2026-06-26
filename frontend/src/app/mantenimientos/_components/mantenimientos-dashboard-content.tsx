"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { StatCard } from '@/components/stat-card';
import {
  getMantenimientosDashboard,
  isAuthenticated,
  type MantenimientosDashboard,
} from '@/lib/api';

const SEVERIDAD_BADGE: Record<string, string> = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  baja: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

const TIPO_ALERTA_META: Record<string, { label: string; color: string; accion: string }> = {
  mantenimiento_vencido: {
    label: 'Mantenimiento',
    color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
    accion: 'Registrar mantenimiento preventivo',
  },
  garantia_por_vencer: {
    label: 'Garantía fabricante',
    color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/30',
    accion: 'Aprovechar garantía antes del vencimiento — edita el equipo si la fecha es incorrecta',
  },
  equipo_dano: {
    label: 'Estado equipo',
    color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
    accion: 'Requiere atención técnica inmediata',
  },
  equipo_en_mantenimiento: {
    label: 'En mantenimiento',
    color: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    accion: 'Actualizar estado del equipo al finalizar',
  },
  calibracion_vencida: {
    label: 'Calibración',
    color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30',
    accion: 'Programar recalibración',
  },
  calibracion_proxima: {
    label: 'Calibración',
    color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/30',
    accion: 'Programar recalibración próximamente',
  },
};

const ALERTAS_VISIBLES = 20;

function formatMoneda(value: string): string {
  return `$${Number(value).toLocaleString('es-CO')}`;
}

export function MantenimientosDashboardContent() {
  const router = useRouter();
  const [data, setData] = useState<MantenimientosDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    setLoading(true);
    setError(null);
    getMantenimientosDashboard()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar el dashboard'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, []);

  const estados = Array.from(
    new Set((data?.por_sede ?? []).flatMap((s) => Object.keys(s.por_estado)))
  ).sort();

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <svg className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-600 dark:text-slate-400">Cargando estadísticas...</p>
      ) : data ? (
        <>
          {/* KPI cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <StatCard label="Mantenimientos vencidos" value={data.vencidos} color="text-red-600 dark:text-red-400" />
            <StatCard label="Próximos 30 días" value={data.proximos_30_dias} color="text-amber-600 dark:text-amber-400" />
            <StatCard label="Garantías por vencer (60d)" value={data.garantias_por_vencer_60_dias} color="text-orange-600 dark:text-orange-400" />
            <Link href="/mantenimientos/calibraciones" className="block rounded-2xl border border-slate-200 bg-white p-5 hover:border-cyan-400 transition-colors dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-widest text-slate-500">Calibraciones vencidas</p>
              <p className={`mt-2 text-4xl font-bold ${data.calibraciones_vencidas > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>{data.calibraciones_vencidas}</p>
            </Link>
            <Link href="/mantenimientos/calibraciones" className="block rounded-2xl border border-slate-200 bg-white p-5 hover:border-cyan-400 transition-colors dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-widest text-slate-500">Calibraciones próx. 30d</p>
              <p className={`mt-2 text-4xl font-bold ${data.calibraciones_proximas_30_dias > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>{data.calibraciones_proximas_30_dias}</p>
            </Link>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-widest text-slate-500">Costo este mes</p>
              <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-slate-100">{formatMoneda(data.costo_mes_actual)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-widest text-slate-500">Costo este año</p>
              <p className="mt-2 text-4xl font-bold text-slate-900 dark:text-slate-100">{formatMoneda(data.costo_anio_actual)}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Estado de equipos por sede */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Estado de equipos por sede</h2>
              {data.por_sede.length === 0 ? (
                <p className="text-sm text-slate-500">Sin equipos registrados.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Sede</th>
                        <th className="px-4 py-3 text-right">Total</th>
                        {estados.map((estado) => (
                          <th key={estado} className="px-4 py-3 text-right">{estado}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {data.por_sede.map((s) => (
                        <tr key={s.sede}>
                          <td className="px-4 py-3 font-medium">{s.sede}</td>
                          <td className="px-4 py-3 text-right font-semibold">{s.total}</td>
                          {estados.map((estado) => (
                            <td key={estado} className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                              {s.por_estado[estado] ?? 0}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Alertas */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">
                Alertas {data.alertas.length > 0 && <span className="ml-1 text-slate-400">({data.alertas.length})</span>}
              </h2>
              {data.alertas.length === 0 ? (
                <p className="text-sm text-slate-500">Sin alertas activas.</p>
              ) : (
                <div className="space-y-2">
                  {data.alertas.slice(0, ALERTAS_VISIBLES).map((a, idx) => {
                    const meta = TIPO_ALERTA_META[a.tipo];
                    return (
                      <Link
                        key={idx}
                        href={`/equipos/${a.equipment_id}/hoja-de-vida`}
                        className="block rounded-lg border border-slate-200 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                      >
                        {/* Fila 1: tipo + severidad + código + sede */}
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                          {meta && (
                            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.color}`}>
                              {meta.label}
                            </span>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERIDAD_BADGE[a.severidad] ?? SEVERIDAD_BADGE.baja}`}>
                            {a.severidad}
                          </span>
                          <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">{a.equipment_codigo}</span>
                          <span className="text-xs text-slate-500">· {a.sede}</span>
                        </div>
                        {/* Fila 2: mensaje */}
                        <p className="text-sm text-slate-800 dark:text-slate-200">{a.mensaje}</p>
                        {/* Fila 3: acción sugerida */}
                        {meta && (
                          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">↳ {meta.accion}</p>
                        )}
                      </Link>
                    );
                  })}
                  {data.alertas.length > ALERTAS_VISIBLES && (
                    <p className="pt-1 text-center text-xs text-slate-500">
                      +{data.alertas.length - ALERTAS_VISIBLES} más
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
