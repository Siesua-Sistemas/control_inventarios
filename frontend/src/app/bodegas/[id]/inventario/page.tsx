"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { EquipoModal } from '@/components/equipo-modal';
import { NavBar } from '@/components/nav-bar';
import { getBodegaInventario, isAuthenticated, listActas, type ActaEntregaRow, type BodegaInventario, type EquipmentRow } from '@/lib/api';
import { ESTADO_COLORS } from '@/lib/constants';

type SortField = 'codigo_interno' | 'serial' | 'tipo' | 'marca_modelo' | 'asignado' | 'estado';

function sortValue(e: EquipmentRow, field: SortField): string {
  switch (field) {
    case 'codigo_interno': return e.codigo_interno;
    case 'serial': return e.serial;
    case 'tipo': return e.tipo;
    case 'marca_modelo': return `${e.marca} ${e.modelo}`;
    case 'asignado': return e.empleado_nombre ?? (e.bodega_id ? 'En bodega' : (e.ubicacion ?? ''));
    case 'estado': return e.estado;
  }
}

export default function InventarioBodegaPage() {
  const router = useRouter();
  const { id } = useParams();
  const { loading: authLoading, hasPermission } = useAuth();
  const canGestionar = authLoading || hasPermission('bodegas:write');
  const [data, setData] = useState<BodegaInventario | null>(null);
  const [ultimaActa, setUltimaActa] = useState<ActaEntregaRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalEquipoId, setModalEquipoId] = useState<number | null>(null);
  const [sortField, setSortField] = useState<SortField>('codigo_interno');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getBodegaInventario(Number(id))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));

    listActas({ bodega_id: Number(id), limit: 1 })
      .then((actas) => setUltimaActa(actas.items[0] ?? null))
      .catch(() => setUltimaActa(null));
  }, [id, router]);

  if (loading) return <><NavBar /><main className="flex min-h-screen items-center justify-center"><p className="text-slate-600 dark:text-slate-400">Cargando...</p></main></>;
  if (!data) return <><NavBar /><main className="flex min-h-screen items-center justify-center"><p className="text-red-600 dark:text-red-300">{error}</p></main></>;

  return (
    <>
      <NavBar />
      {modalEquipoId && <EquipoModal equipoId={modalEquipoId} onClose={() => setModalEquipoId(null)} />}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/bodegas" className="hover:text-cyan-600 dark:hover:text-cyan-400">Bodegas</Link>
          <span>/</span>
          <span className="text-slate-700 dark:text-slate-300">{data.bodega.nombre}</span>
        </div>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{data.bodega.nombre}</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">{data.bodega.sede}{data.bodega.responsable ? ` · ${data.bodega.responsable}` : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canGestionar ? (
              <Link
                href={`/bodegas/${id}/inventario/entrega`}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Iniciar Entrega →
              </Link>
            ) : null}
            {canGestionar ? (
              <Link
                href={`/bodegas/${id}/inventario/paz-y-salvo`}
                className="flex items-center gap-2 rounded-lg border border-lime-300 bg-lime-50 px-4 py-2 text-sm font-medium text-lime-700 hover:bg-lime-100 dark:border-lime-800/60 dark:bg-lime-900/20 dark:text-lime-400 dark:hover:bg-lime-900/40 transition-colors"
              >
                Paz y Salvo
              </Link>
            ) : null}
            <Link
              href={ultimaActa ? `/actas/${ultimaActa.id}/imprimir` : `/bodegas/${id}/inventario/acta`}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {ultimaActa ? 'Última acta →' : 'Ver Acta'}
            </Link>
            <span className="rounded-2xl bg-cyan-100 px-5 py-2 text-2xl font-bold text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400">{data.total}</span>
          </div>
        </div>

        {/* Summary pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          {Object.entries(data.por_tipo).map(([tipo, count]) => (
            <span key={tipo} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">{tipo}: {count}</span>
          ))}
        </div>

        {/* Equipment table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                {([
                  ['codigo_interno', 'Código', ''],
                  ['serial', 'Serial', 'hidden sm:table-cell'],
                  ['tipo', 'Tipo', 'hidden sm:table-cell'],
                  ['marca_modelo', 'Marca / Modelo', ''],
                  ['asignado', 'Ubicación física', 'hidden md:table-cell'],
                  ['estado', 'Estado', ''],
                ] as [SortField, string, string][]).map(([field, label, extraClass]) => (
                  <th key={field} className={`${extraClass} px-4 py-3`}>
                    <button
                      onClick={() => toggleSort(field)}
                      className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                    >
                      {label}
                      <span className={sortField === field ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-600'}>
                        {sortField === field ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.equipos.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">Bodega vacía.</td></tr>
              ) : [...data.equipos].sort((a, b) => {
                  const cmp = sortValue(a, sortField).localeCompare(sortValue(b, sortField), 'es', { sensitivity: 'base' });
                  return sortDir === 'asc' ? cmp : -cmp;
                }).map((e) => (
                <tr key={e.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-3 font-mono text-xs">
                    <button
                      onClick={() => setModalEquipoId(e.id)}
                      className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline text-left"
                    >
                      {e.codigo_interno}
                    </button>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 font-mono text-xs">{e.serial}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-slate-700 dark:text-slate-300">{e.tipo}</td>
                  <td className="px-4 py-3"><span className="font-medium">{e.marca}</span> <span className="text-slate-600 dark:text-slate-400">{e.modelo}</span></td>
                  <td className="hidden md:table-cell px-4 py-3 text-slate-700 dark:text-slate-300">
                    {e.empleado_nombre ?? (e.bodega_id ? 'En bodega' : (e.ubicacion ?? '—'))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[e.estado] ?? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>{e.estado}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
