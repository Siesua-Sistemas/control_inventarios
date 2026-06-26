"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { EquipoModal } from '@/components/equipo-modal';
import { NavBar } from '@/components/nav-bar';
import { deleteEquipment, exportEquiposCsv, isAuthenticated, listEquipment, listEquipmentTipos, type EquipmentRow, type EquipmentTipo } from '@/lib/api';
import { ESTADO_COLORS } from '@/lib/constants';

const ESTADOS = ['Disponible', 'Asignado', 'En mantenimiento', 'Dañado', 'Prestado', 'En bodega', 'Perdido', 'Dado de baja'];
const CRITICIDADES = ['Alta', 'Media', 'Baja'];
const CRITICIDAD_COLORS: Record<string, string> = {
  Alta: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  Media: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  Baja: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};
const PAGE_SIZE = 50;

type SortField = 'codigo_interno' | 'serial' | 'tipo' | 'marca_modelo' | 'sede' | 'estado';

function sortValue(e: EquipmentRow, field: SortField): string {
  switch (field) {
    case 'codigo_interno': return e.codigo_interno;
    case 'serial': return e.serial;
    case 'tipo': return e.tipo;
    case 'marca_modelo': return `${e.marca} ${e.modelo}`;
    case 'sede': return `${e.sede} ${e.ubicacion ?? ''}`;
    case 'estado': return e.estado;
  }
}

export default function EquiposPage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canWrite = authLoading || hasPermission('equipment:write');
  const canDelete = authLoading || hasPermission('equipment:delete');
  const canViewHojaVida = authLoading || hasPermission('equipment:hoja_vida');
  const canExport = authLoading || hasPermission('reports:export');
  const [equipos, setEquipos] = useState<EquipmentRow[]>([]);
  const [tipos, setTipos] = useState<EquipmentTipo[]>([]);
  const [sedes, setSedes] = useState<string[]>([]);
  const [modalEquipoId, setModalEquipoId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterSede, setFilterSede] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterCriticidad, setFilterCriticidad] = useState('');
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
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    fetchEquipos(undefined, 0);
    listEquipment().then((r) => {
      setSedes(Array.from(new Set(r.items.map((e) => e.sede))).sort((a, b) => a.localeCompare(b, 'es')));
    }).catch(() => null);
    listEquipmentTipos().then((r) => setTipos(r.items.filter((t) => t.activo))).catch(() => null);
  }, [router]);

  async function fetchEquipos(params?: { search?: string; tipo?: string; sede?: string; estado?: string; criticidad?: string }, p = 0) {
    setLoading(true);
    setError('');
    try {
      const response = await listEquipment({
        search: params?.search ?? search,
        tipo: params?.tipo ?? filterTipo,
        sede: params?.sede ?? filterSede,
        estado: params?.estado ?? filterEstado,
        criticidad: params?.criticidad ?? filterCriticidad,
        skip: p * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setEquipos(response.items);
      setTotal(response.total);
      setPage(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar equipos');
    } finally {
      setLoading(false);
    }
  }

  function goPage(p: number) {
    fetchEquipos(undefined, p);
  }

  async function handleExportCsv() {
    setExporting(true);
    setError('');
    try {
      await exportEquiposCsv({ search, tipo: filterTipo, sede: filterSede, estado: filterEstado, criticidad: filterCriticidad });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar');
    } finally {
      setExporting(false);
    }
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    fetchEquipos();
  }

  function handleFilterChange(tipo: string, sede: string, estado: string, criticidad: string) {
    setFilterTipo(tipo);
    setFilterSede(sede);
    setFilterEstado(estado);
    setFilterCriticidad(criticidad);
    fetchEquipos({ tipo, sede, estado, criticidad });
  }

  async function handleDelete(equipo: EquipmentRow) {
    if (!window.confirm(`¿Eliminar el equipo ${equipo.codigo_interno} — ${equipo.marca} ${equipo.modelo}?`)) return;
    try {
      await deleteEquipment(equipo.id);
      setEquipos((prev) => prev.filter((e) => e.id !== equipo.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  return (
    <>
      <NavBar />
      {modalEquipoId && <EquipoModal equipoId={modalEquipoId} onClose={() => setModalEquipoId(null)} />}
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Inventario</p>
            <h1 className="mt-1 text-3xl font-bold">Equipos</h1>
          </div>
          <div className="flex items-center gap-2">
            {canExport ? (
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exporting}
                className="rounded-md bg-slate-200 px-4 py-2 font-semibold text-slate-800 hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {exporting ? 'Descargando...' : 'Descargar CSV'}
              </button>
            ) : null}
            {canWrite ? (
              <Link href="/equipos/nuevo" className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400">
                + Nuevo equipo
              </Link>
            ) : null}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
            <input
              type="text"
              placeholder="Buscar por serial, marca o modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-[220px] flex-1"
            />
            <button type="submit" className="px-4 py-2">Buscar</button>
          </form>

          <select
            value={filterTipo}
            onChange={(e) => handleFilterChange(e.target.value, filterSede, filterEstado, filterCriticidad)}
            className="min-w-[140px]"
          >
            <option value="">Todos los tipos</option>
            {tipos.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
          </select>

          <select
            value={filterSede}
            onChange={(e) => handleFilterChange(filterTipo, e.target.value, filterEstado, filterCriticidad)}
            className="min-w-[160px]"
          >
            <option value="">Todas las sedes</option>
            {sedes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={filterEstado}
            onChange={(e) => handleFilterChange(filterTipo, filterSede, e.target.value, filterCriticidad)}
            className="min-w-[160px]"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>

          <select
            value={filterCriticidad}
            onChange={(e) => handleFilterChange(filterTipo, filterSede, filterEstado, e.target.value)}
            className="min-w-[140px]"
          >
            <option value="">Toda criticidad</option>
            {CRITICIDADES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          {(search || filterTipo || filterSede || filterEstado || filterCriticidad) && (
            <button
              type="button"
              className="bg-slate-100 px-3 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              onClick={() => {
                setSearch('');
                setFilterTipo('');
                setFilterSede('');
                setFilterEstado('');
                setFilterCriticidad('');
                fetchEquipos({ search: '', tipo: '', sede: '', estado: '', criticidad: '' });
              }}
            >
              Limpiar
            </button>
          )}
        </div>

        {error ? <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p> : null}

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                {([
                  ['codigo_interno', 'Código', ''],
                  ['serial', 'Serial', 'hidden sm:table-cell'],
                  ['tipo', 'Tipo', 'hidden md:table-cell'],
                  ['marca_modelo', 'Marca / Modelo', ''],
                  ['sede', 'Sede', 'hidden md:table-cell'],
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
                <th className="hidden lg:table-cell px-4 py-3">Criticidad</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">
                    Cargando equipos...
                  </td>
                </tr>
              ) : equipos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">
                    No se encontraron equipos.
                  </td>
                </tr>
              ) : (
                [...equipos].sort((a, b) => {
                  const cmp = sortValue(a, sortField).localeCompare(sortValue(b, sortField), 'es', { sensitivity: 'base' });
                  return sortDir === 'asc' ? cmp : -cmp;
                }).map((equipo) => (
                  <tr key={equipo.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs">
                      <button
                        onClick={() => setModalEquipoId(equipo.id)}
                        className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline"
                      >
                        {equipo.codigo_interno}
                      </button>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 font-mono text-xs">{equipo.serial}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-slate-700 dark:text-slate-300">{equipo.tipo}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{equipo.marca}</span>
                      <span className="ml-1 text-slate-600 dark:text-slate-400">{equipo.modelo}</span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-slate-700 dark:text-slate-300">
                      {equipo.sede}
                      {equipo.ubicacion && <span className="ml-1 text-xs text-slate-500">/ {equipo.ubicacion}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[equipo.estado] ?? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                        {equipo.estado}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CRITICIDAD_COLORS[equipo.criticidad] ?? CRITICIDAD_COLORS.Media}`}>
                        {equipo.criticidad}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canViewHojaVida ? (
                          <Link
                            href={`/equipos/${equipo.id}/hoja-de-vida`}
                            className="rounded-md bg-cyan-100 px-3 py-1 text-xs text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:hover:bg-cyan-500/40"
                          >
                            Hoja de vida
                          </Link>
                        ) : null}
                        {canWrite ? (
                          <Link
                            href={`/equipos/${equipo.id}/editar`}
                            className="rounded-md bg-slate-200 px-3 py-1 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                          >
                            Editar
                          </Link>
                        ) : null}
                        {canDelete ? (
                          <button
                            onClick={() => handleDelete(equipo)}
                            className="rounded-md bg-red-100 px-3 py-1 text-xs text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/40"
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && equipos.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{total} equipo(s)</span>
            {total > PAGE_SIZE && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => goPage(page - 1)}
                  disabled={page === 0}
                  className="rounded-md bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  ← Anterior
                </button>
                <span>Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}</span>
                <button
                  type="button"
                  onClick={() => goPage(page + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  className="rounded-md bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
