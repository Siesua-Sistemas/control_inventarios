"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { getDashboardStats, isAuthenticated, type AsignacionRow, type DashboardStats } from '@/lib/api';

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

const TIPO_BADGE: Record<string, string> = {
  'Entrega': 'bg-blue-500/20 text-blue-300',
  'Devolución': 'bg-emerald-500/20 text-emerald-300',
  'Traslado': 'bg-purple-500/20 text-purple-300',
};

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-xs uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-2 text-4xl font-bold ${color}`}>{value.toLocaleString()}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function MovimientoRow({ m }: { m: AsignacionRow }) {
  const date = new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  return (
    <div className="flex items-center justify-between border-t border-slate-800 py-2.5 first:border-0">
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_BADGE[m.tipo] ?? 'bg-slate-700 text-slate-300'}`}>
          {m.tipo}
        </span>
        <div>
          <p className="text-sm font-medium">
            <span className="font-mono text-cyan-500">{m.equipment_codigo}</span>
            <span className="mx-1 text-slate-500">·</span>
            <span>{m.equipment_marca} {m.equipment_modelo}</span>
          </p>
          {m.empleado_nombre && (
            <p className="text-xs text-slate-400">{m.empleado_nombre}</p>
          )}
        </div>
      </div>
      <span className="shrink-0 text-xs text-slate-500">{date}</span>
    </div>
  );
}

export default function InicioPage() {
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
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Sistema de inventario</p>
          <h1 className="mt-1 text-3xl font-bold">Panel de control</h1>
        </div>

        {loading ? (
          <p className="text-slate-400">Cargando estadísticas...</p>
        ) : (
          <>
            {/* KPI cards */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total equipos" value={stats?.total_equipos ?? 0} color="text-slate-100" />
              <StatCard label="Disponibles" value={porEstado['Disponible'] ?? 0} color="text-emerald-400" />
              <StatCard label="Asignados" value={porEstado['Asignado'] ?? 0} color="text-blue-400" />
              <StatCard label="En mantenimiento" value={porEstado['En mantenimiento'] ?? 0} color="text-yellow-400" />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Estado distribution */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-1">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Distribución por estado</h2>
                <div className="space-y-3">
                  {Object.entries(porEstado).map(([estado, count]) => {
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={estado}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-slate-300">{estado}</span>
                          <span className="text-slate-500">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-800">
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
                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-800 pt-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-100">{stats?.total_bodegas ?? 0}</p>
                    <p className="text-xs text-slate-500">Bodegas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-100">{stats?.total_empleados ?? 0}</p>
                    <p className="text-xs text-slate-500">Empleados</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-cyan-400">{stats?.asignaciones_hoy ?? 0}</p>
                    <p className="text-xs text-slate-500">Hoy</p>
                  </div>
                </div>
              </div>

              {/* Últimos movimientos */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">Últimos movimientos</h2>
                  <Link href="/historial" className="text-xs text-cyan-400 hover:text-cyan-300">Ver todo →</Link>
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
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-400">Acciones rápidas</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { href: '/equipos/nuevo', label: '+ Registrar equipo', color: 'border-cyan-800 hover:border-cyan-600' },
                  { href: '/asignaciones?accion=entregar', label: '↑ Entregar equipo', color: 'border-blue-800 hover:border-blue-600' },
                  { href: '/asignaciones?accion=devolver', label: '↓ Recibir devolución', color: 'border-emerald-800 hover:border-emerald-600' },
                  { href: '/bodegas/nuevo', label: '+ Nueva bodega', color: 'border-purple-800 hover:border-purple-600' },
                ].map(({ href, label, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`rounded-xl border bg-slate-900 px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:text-slate-100 ${color}`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
