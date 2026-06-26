"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { StatCard } from '@/components/stat-card';
import {
  getInventarioDashboard,
  isAuthenticated,
  listBodegas,
  type BodegaRow,
  type InventarioDashboard,
} from '@/lib/api';

const TIPO_COLORS = [
  'bg-cyan-600', 'bg-blue-600', 'bg-violet-600', 'bg-emerald-600',
  'bg-amber-500', 'bg-rose-600', 'bg-slate-500',
];

export function InventarioDashboardContent() {
  const router = useRouter();
  const [data, setData] = useState<InventarioDashboard | null>(null);
  const [bodegas, setBodegas] = useState<BodegaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    Promise.all([getInventarioDashboard(), listBodegas()])
      .then(([dashboard, bodegasResponse]) => {
        setData(dashboard);
        setBodegas(bodegasResponse.items);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar el dashboard'))
      .finally(() => setLoading(false));
  }, [router]);

  const total = data?.total_equipos ?? 0;
  const porEstado = data?.por_estado ?? {};
  const porTipo = data?.por_tipo ?? {};

  return (
    <>
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
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total equipos" value={total} color="text-slate-900 dark:text-slate-100" />
            <StatCard label="Disponibles" value={porEstado['Disponible'] ?? 0} color="text-emerald-600 dark:text-emerald-400" />
            <StatCard label="Asignados" value={porEstado['Asignado'] ?? 0} color="text-blue-600 dark:text-blue-400" />
            <StatCard label="En bodega" value={porEstado['En bodega'] ?? 0} color="text-cyan-600 dark:text-cyan-400" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Distribución por tipo */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-1 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Distribución por tipo</h2>
              <div className="space-y-3">
                {Object.entries(porTipo).map(([tipo, count], idx) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={tipo}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-300">{tipo}</span>
                        <span className="text-slate-500">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-1.5 rounded-full ${TIPO_COLORS[idx % TIPO_COLORS.length]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {Object.keys(porTipo).length === 0 && (
                  <p className="text-sm text-slate-500">Sin equipos registrados.</p>
                )}
              </div>
            </div>

            {/* Stock por bodega */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Stock por bodega</h2>
                <Link href="/bodegas" className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300">Ver todo →</Link>
              </div>
              {bodegas.length === 0 ? (
                <p className="text-sm text-slate-500">Sin bodegas registradas.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Bodega</th>
                        <th className="px-4 py-3">Sede</th>
                        <th className="px-4 py-3 text-right">Equipos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {bodegas.map((b) => (
                        <tr key={b.id}>
                          <td className="px-4 py-3 font-medium">{b.nombre}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{b.sede}</td>
                          <td className="px-4 py-3 text-right font-semibold">{b.total_equipos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            {/* Garantías por vencer */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Garantías por vencer</h2>
              {data.garantias_por_vencer.length === 0 ? (
                <p className="text-sm text-slate-500">Sin garantías próximas a vencer.</p>
              ) : (
                <div className="space-y-2">
                  {data.garantias_por_vencer.map((g) => (
                    <Link
                      key={g.equipment_id}
                      href={`/equipos/${g.equipment_id}/hoja-de-vida`}
                      className="block rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      <p className="text-sm font-medium">
                        <span className="font-mono text-cyan-600 dark:text-cyan-500">{g.equipment_codigo}</span>
                        <span className="mx-1 text-slate-500">·</span>
                        <span>{g.equipment_marca} {g.equipment_modelo}</span>
                      </p>
                      <p className="text-xs text-slate-500">{g.sede} · vence en {g.dias} día(s)</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Altas recientes */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Altas recientes</h2>
                <Link href="/equipos" className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300">Ver todo →</Link>
              </div>
              {data.altas_recientes.length === 0 ? (
                <p className="text-sm text-slate-500">Sin equipos registrados.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Marca / Modelo</th>
                        <th className="px-4 py-3">Sede</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {data.altas_recientes.map((eq) => (
                        <tr key={eq.id}>
                          <td className="px-4 py-3 font-mono text-cyan-600 dark:text-cyan-500">
                            <Link href={`/equipos/${eq.id}/hoja-de-vida`} className="hover:underline">{eq.codigo_interno}</Link>
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{eq.tipo}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{eq.marca} {eq.modelo}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{eq.sede}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{eq.estado}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {new Date(eq.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                { href: '/bodegas/nuevo', label: '+ Nueva bodega', color: 'border-purple-300 hover:border-purple-500 dark:border-purple-800 dark:hover:border-purple-600' },
                { href: '/equipos', label: 'Ver equipos', color: 'border-blue-300 hover:border-blue-500 dark:border-blue-800 dark:hover:border-blue-600' },
                { href: '/bodegas', label: 'Ver bodegas', color: 'border-emerald-300 hover:border-emerald-500 dark:border-emerald-800 dark:hover:border-emerald-600' },
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
      ) : null}
    </>
  );
}
