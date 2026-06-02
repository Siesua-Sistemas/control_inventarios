"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { deleteEquipment, isAuthenticated, listEquipment, type EquipmentRow } from '@/lib/api';
import { ESTADO_COLORS } from '@/lib/constants';

const TIPOS = ['Portátil', 'Celular', 'Tablet', 'Cámara', 'Audífonos', 'Monitor', 'Impresora', 'Red', 'Accesorio', 'Servidor', 'Otro'];
const ESTADOS = ['Disponible', 'Asignado', 'En mantenimiento', 'Dañado', 'Prestado', 'En bodega', 'Perdido', 'Dado de baja'];

export default function EquiposPage() {
  const router = useRouter();
  const [equipos, setEquipos] = useState<EquipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    fetchEquipos();
  }, [router]);

  async function fetchEquipos(params?: { search?: string; tipo?: string; estado?: string }) {
    setLoading(true);
    setError('');
    try {
      const response = await listEquipment({
        search: params?.search ?? search,
        tipo: params?.tipo ?? filterTipo,
        estado: params?.estado ?? filterEstado,
      });
      setEquipos(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar equipos');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    fetchEquipos();
  }

  function handleFilterChange(tipo: string, estado: string) {
    setFilterTipo(tipo);
    setFilterEstado(estado);
    fetchEquipos({ tipo, estado });
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
      <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Inventario</p>
            <h1 className="mt-1 text-3xl font-bold">Equipos</h1>
          </div>
          <Link href="/equipos/nuevo" className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400">
            + Nuevo equipo
          </Link>
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
            onChange={(e) => handleFilterChange(e.target.value, filterEstado)}
            className="min-w-[140px]"
          >
            <option value="">Todos los tipos</option>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <select
            value={filterEstado}
            onChange={(e) => handleFilterChange(filterTipo, e.target.value)}
            className="min-w-[160px]"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>

          {(search || filterTipo || filterEstado) && (
            <button
              type="button"
              className="bg-slate-800 px-3 py-2 text-slate-300"
              onClick={() => {
                setSearch('');
                setFilterTipo('');
                setFilterEstado('');
                fetchEquipos({ search: '', tipo: '', estado: '' });
              }}
            >
              Limpiar
            </button>
          )}
        </div>

        {error ? <p className="mb-4 rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p> : null}

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="hidden sm:table-cell px-4 py-3">Serial</th>
                <th className="hidden md:table-cell px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Marca / Modelo</th>
                <th className="hidden md:table-cell px-4 py-3">Sede</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Cargando equipos...
                  </td>
                </tr>
              ) : equipos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No se encontraron equipos.
                  </td>
                </tr>
              ) : (
                equipos.map((equipo) => (
                  <tr key={equipo.id} className="border-t border-slate-800 hover:bg-slate-800/50">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/equipos/${equipo.id}/hoja-de-vida`} className="text-cyan-400 hover:text-cyan-300 hover:underline">
                        {equipo.codigo_interno}
                      </Link>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 font-mono text-xs">{equipo.serial}</td>
                    <td className="hidden md:table-cell px-4 py-3 text-slate-300">{equipo.tipo}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{equipo.marca}</span>
                      <span className="ml-1 text-slate-400">{equipo.modelo}</span>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3 text-slate-300">
                      {equipo.sede}
                      {equipo.ubicacion && <span className="ml-1 text-xs text-slate-500">/ {equipo.ubicacion}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[equipo.estado] ?? 'bg-slate-700 text-slate-300'}`}>
                        {equipo.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/equipos/${equipo.id}/hoja-de-vida`}
                          className="rounded-md bg-cyan-500/20 px-3 py-1 text-xs text-cyan-300 hover:bg-cyan-500/40"
                        >
                          Hoja de vida
                        </Link>
                        <Link
                          href={`/equipos/${equipo.id}/editar`}
                          className="rounded-md bg-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-600"
                        >
                          Editar
                        </Link>
                        <button
                          onClick={() => handleDelete(equipo)}
                          className="rounded-md bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/40"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && equipos.length > 0 && (
          <p className="mt-3 text-right text-xs text-slate-500">{equipos.length} equipo(s)</p>
        )}
      </main>
    </>
  );
}
