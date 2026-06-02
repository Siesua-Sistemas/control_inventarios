"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { deleteEmpleado, isAuthenticated, listEmpleados, type EmpleadoRow } from '@/lib/api';

export default function EmpleadosPage() {
  const router = useRouter();
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    fetch_();
  }, [router]);

  async function fetch_(q?: string) {
    setLoading(true); setError('');
    try {
      const r = await listEmpleados(q ?? search);
      setEmpleados(r.items);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }

  async function handleDelete(e: EmpleadoRow) {
    if (!window.confirm(`¿Eliminar a "${e.nombre_completo}"?`)) return;
    try {
      await deleteEmpleado(e.id);
      setEmpleados((prev) => prev.filter((x) => x.id !== e.id));
    } catch (err) { setError(err instanceof Error ? err.message : 'Error'); }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Gestión</p>
            <h1 className="mt-1 text-3xl font-bold">Empleados</h1>
          </div>
          <Link href="/empleados/nuevo" className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400">
            + Nuevo empleado
          </Link>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); fetch_(); }} className="mb-4 flex gap-2">
          <input
            className="flex-1"
            placeholder="Buscar por nombre o cédula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="px-4 py-2">Buscar</button>
          {search && (
            <button type="button" className="bg-slate-800 px-3" onClick={() => { setSearch(''); fetch_(''); }}>✕</button>
          )}
        </form>

        {error && <p className="mb-4 rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>}

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Cédula</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Sede</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Cargando...</td></tr>
              ) : empleados.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No hay empleados registrados.</td></tr>
              ) : empleados.map((emp) => (
                <tr key={emp.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-medium">{emp.nombre_completo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{emp.cedula}</td>
                  <td className="px-4 py-3 text-slate-300">{emp.cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{emp.sede ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(emp)}
                      className="rounded-md bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && <p className="mt-2 text-right text-xs text-slate-500">{empleados.length} empleado(s)</p>}
      </main>
    </>
  );
}
