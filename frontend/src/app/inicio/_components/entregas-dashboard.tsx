"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { MovimientoRow } from '@/components/movimiento-row';
import { StatCard } from '@/components/stat-card';
import { getDashboardStats, isAuthenticated, type DashboardStats } from '@/lib/api';

const ACCESOS_RAPIDOS = [
  { href: '/asignaciones?accion=entregar', label: '↑ Entregar equipo', color: 'border-blue-300 hover:border-blue-500 dark:border-blue-800 dark:hover:border-blue-600' },
  { href: '/asignaciones?accion=devolver', label: '↓ Recibir devolución', color: 'border-emerald-300 hover:border-emerald-500 dark:border-emerald-800 dark:hover:border-emerald-600' },
  { href: '/historial', label: 'Ver historial', color: 'border-cyan-300 hover:border-cyan-500 dark:border-cyan-800 dark:hover:border-cyan-600' },
  { href: '/actas', label: 'Actas de entrega', color: 'border-purple-300 hover:border-purple-500 dark:border-purple-800 dark:hover:border-purple-600' },
];

export function EntregasDashboardContent() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getDashboardStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar el dashboard'))
      .finally(() => setLoading(false));
  }, [router]);

  const porEstado = stats?.por_estado ?? {};

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Accesos rápidos */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACCESOS_RAPIDOS.map(({ href, label, color }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-xl border bg-white px-4 py-5 text-center text-base font-semibold text-slate-700 transition-colors hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100 ${color}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-600 dark:text-slate-400">Cargando estadísticas...</p>
      ) : stats ? (
        <>
          {/* KPI cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Asignaciones hoy" value={stats.asignaciones_hoy} color="text-cyan-600 dark:text-cyan-400" />
            <StatCard label="Total equipos" value={stats.total_equipos} color="text-slate-900 dark:text-slate-100" />
            <StatCard label="Disponibles" value={porEstado['Disponible'] ?? 0} color="text-emerald-600 dark:text-emerald-400" />
            <StatCard label="Asignados" value={porEstado['Asignado'] ?? 0} color="text-blue-600 dark:text-blue-400" />
          </div>

          {/* Últimos movimientos */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Últimos movimientos</h2>
              <Link href="/historial" className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300">Ver todo →</Link>
            </div>
            {stats.ultimos_movimientos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin movimientos registrados.</p>
            ) : (
              <div>
                {stats.ultimos_movimientos.map((m) => <MovimientoRow key={m.id} m={m} />)}
              </div>
            )}
          </div>
        </>
      ) : null}
    </>
  );
}
