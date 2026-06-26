"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { MovimientoRow } from '@/components/movimiento-row';
import { StatCard } from '@/components/stat-card';
import { getDashboardStats, isAuthenticated, type DashboardStats } from '@/lib/api';

const ESTADO_COLORS: Record<string, string> = {
  'Disponible':       'bg-lime-600',
  'Asignado':         'bg-teal-600',
  'En mantenimiento': 'bg-amber-500',
  'Dañado':           'bg-red-600',
  'Prestado':         'bg-violet-600',
  'En bodega':        'bg-stone-500',
  'Perdido':          'bg-orange-600',
  'Dado de baja':     'bg-stone-700',
};

export function GeneralDashboardContent() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getDashboardStats()
      .then(setStats)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [router]);

  const total = stats?.total_equipos ?? 0;
  const porEstado = stats?.por_estado ?? {};

  return (
    <>
      {loading ? (
        <p className="text-slate-600 dark:text-slate-400">Cargando estadísticas...</p>
      ) : (
        <>
          {/* KPI cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total equipos" value={stats?.total_equipos ?? 0} color="text-slate-900 dark:text-slate-100" />
            <StatCard label="Disponibles" value={porEstado['Disponible'] ?? 0} color="text-emerald-600 dark:text-emerald-400" />
            <StatCard label="Asignados" value={porEstado['Asignado'] ?? 0} color="text-blue-600 dark:text-blue-400" />
            <StatCard label="En mantenimiento" value={porEstado['En mantenimiento'] ?? 0} color="text-yellow-600 dark:text-yellow-400" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Estado distribution */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-1 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Distribución por estado</h2>
              <div className="space-y-3">
                {Object.entries(porEstado).map(([estado, count]) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={estado}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-300">{estado}</span>
                        <span className="text-slate-500">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-1.5 rounded-full ${ESTADO_COLORS[estado] ?? 'bg-slate-600'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(porEstado).length === 0 && (
                  <p className="text-sm text-slate-500">Sin equipos registrados.</p>
                )}
              </div>

              {/* Secondary stats */}
              <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats?.total_bodegas ?? 0}</p>
                  <p className="text-xs text-slate-500">Bodegas</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats?.total_empleados ?? 0}</p>
                  <p className="text-xs text-slate-500">Empleados</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-cyan-600 dark:text-cyan-400">{stats?.asignaciones_hoy ?? 0}</p>
                  <p className="text-xs text-slate-500">Hoy</p>
                </div>
              </div>
            </div>

            {/* Últimos movimientos */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Últimos movimientos</h2>
                <Link href="/historial" className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300">Ver todo →</Link>
              </div>
              {(stats?.ultimos_movimientos ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">Sin movimientos registrados.</p>
              ) : (
                <div>
                  {stats!.ultimos_movimientos.map((m) => <MovimientoRow key={m.id} m={m} />)}
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-8">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Acciones rápidas</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: '/equipos/nuevo', label: '+ Registrar equipo', color: 'border-cyan-300 hover:border-cyan-500 dark:border-cyan-800 dark:hover:border-cyan-600' },
                { href: '/asignaciones?accion=entregar', label: '↑ Entregar equipo', color: 'border-blue-300 hover:border-blue-500 dark:border-blue-800 dark:hover:border-blue-600' },
                { href: '/asignaciones?accion=devolver', label: '↓ Recibir devolución', color: 'border-emerald-300 hover:border-emerald-500 dark:border-emerald-800 dark:hover:border-emerald-600' },
                { href: '/bodegas/nuevo', label: '+ Nueva bodega', color: 'border-purple-300 hover:border-purple-500 dark:border-purple-800 dark:hover:border-purple-600' },
              ].map(({ href, label, color }) => (
                <Link
                  key={href}
                  href={href}
                  className={`rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100 ${color}`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
