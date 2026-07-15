"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { isAuthenticated, listCalibraciones, type CalibracionItem } from '@/lib/api';
import { MantenimientosSubNav } from '@/app/mantenimientos/_components/mantenimientos-subnav';

const CRITICIDAD_COLORS: Record<string, string> = {
  Alta: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  Media: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  Baja: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

function vencimientoClass(dias: number): string {
  if (dias < 0) return 'text-red-600 font-semibold dark:text-red-400';
  if (dias <= 30) return 'text-amber-600 font-semibold dark:text-amber-400';
  return 'text-slate-700 dark:text-slate-300';
}

function vencimientoLabel(dias: number, fecha: string): string {
  if (dias < 0) return `${fecha} (vencida ${Math.abs(dias)}d)`;
  if (dias <= 30) return `${fecha} (en ${dias}d)`;
  return fecha;
}

export default function CalibracionesPage() {
  const router = useRouter();
  const [items, setItems] = useState<CalibracionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'vencidas' | 'proximas'>('todas');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    fetchData();
  }, [router]);

  async function fetchData() {
    setLoading(true);
    setError('');
    try {
      const params = filtro === 'vencidas' ? { vencidas: true } :
                     filtro === 'proximas' ? { vencidas: false, proximas_dias: 30 } : {};
      const r = await listCalibraciones(params);
      setItems(r.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar calibraciones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [filtro]);

  const vencidas = items.filter((i) => i.dias_para_vencer < 0).length;
  const proximas = items.filter((i) => i.dias_para_vencer >= 0 && i.dias_para_vencer <= 30).length;
  const alDia = items.filter((i) => i.dias_para_vencer > 30).length;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Mantenimiento</p>
          <h1 className="mt-1 text-3xl font-bold">Calibraciones</h1>
        </div>

        <MantenimientosSubNav />

        <div className="mb-6">
          <h2 className="mb-4 text-lg font-semibold">Calibraciones y metrología</h2>

          {/* Resumen rápido */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
              <p className="text-xs uppercase tracking-widest text-red-600 dark:text-red-400">Vencidas</p>
              <p className="mt-1 text-4xl font-bold text-red-600 dark:text-red-400">{vencidas}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-xs uppercase tracking-widest text-amber-600 dark:text-amber-400">Próximos 30 días</p>
              <p className="mt-1 text-4xl font-bold text-amber-600 dark:text-amber-400">{proximas}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs uppercase tracking-widest text-slate-500">Al día</p>
              <p className="mt-1 text-4xl font-bold text-slate-900 dark:text-slate-100">{alDia}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="mb-4 flex gap-2">
            {(['todas', 'vencidas', 'proximas'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  filtro === f
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {f === 'todas' ? 'Todas' : f === 'vencidas' ? 'Vencidas' : 'Próximas 30d'}
              </button>
            ))}
          </div>

          {error && <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>}

          {loading ? (
            <p className="text-slate-600 dark:text-slate-400">Cargando...</p>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-slate-500">
                {filtro === 'vencidas' ? 'No hay calibraciones vencidas.' :
                 filtro === 'proximas' ? 'No hay calibraciones próximas a vencer.' :
                 'No hay equipos con datos de calibración registrados.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Equipo</th>
                    <th className="px-4 py-3 hidden md:table-cell">Tipo</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Sede</th>
                    <th className="px-4 py-3">Criticidad</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Última calibración</th>
                    <th className="px-4 py-3">Vencimiento</th>
                    <th className="px-4 py-3 hidden md:table-cell">Frecuencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {items.map((item) => (
                    <tr key={item.equipment_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/equipos/${item.equipment_id}/hoja-de-vida`}
                          className="font-mono text-xs text-cyan-600 hover:underline dark:text-cyan-400"
                        >
                          {item.equipment_codigo}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                        {item.equipment_marca} {item.equipment_modelo}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-slate-600 dark:text-slate-400">
                        {item.equipment_tipo}
                      </td>
                      <td className="hidden lg:table-cell px-4 py-3 text-slate-600 dark:text-slate-400">
                        {item.equipment_sede}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CRITICIDAD_COLORS[item.criticidad] ?? CRITICIDAD_COLORS.Media}`}>
                          {item.criticidad}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-slate-600 dark:text-slate-400">
                        {item.fecha_calibracion ?? '—'}
                      </td>
                      <td className={`px-4 py-3 ${vencimientoClass(item.dias_para_vencer)}`}>
                        {vencimientoLabel(item.dias_para_vencer, item.vencimiento_calibracion)}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-slate-600 dark:text-slate-400">
                        {item.frecuencia_calibracion_meses ? `${item.frecuencia_calibracion_meses} meses` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
