"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { createBodega, isAuthenticated, listEmpleados, type EmpleadoRow } from '@/lib/api';

export default function NuevaBodegaPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [sede, setSede] = useState('');
  const [empleadoId, setEmpleadoId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    listEmpleados().then((r) => setEmpleados(r.items)).catch(() => null);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    const empleado = empleados.find((emp) => emp.id === Number(empleadoId));
    try {
      await createBodega({
        nombre,
        sede,
        responsable: empleado ? empleado.nombre_completo : null,
        descripcion: descripcion || null,
      });
      router.push('/bodegas');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear bodega');
    } finally { setLoading(false); }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Bodegas</p>
          <h1 className="mt-1 text-3xl font-bold">Nueva bodega</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div>
            <label htmlFor="nombre">Nombre *</label>
            <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="sede">Sede *</label>
            <input id="sede" value={sede} onChange={(e) => setSede(e.target.value)} required placeholder="Ej: Sede Norte, Bogotá" />
          </div>
          <div>
            <label htmlFor="responsable">Responsable</label>
            <select id="responsable" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
              <option value="">— Sin responsable —</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre_completo} · {emp.cedula}{emp.cargo ? ` · ${emp.cargo}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="descripcion">Descripción</label>
            <input id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
          {error && <p className="rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Crear bodega'}</button>
            <button type="button" className="bg-slate-800 text-slate-100" onClick={() => router.push('/bodegas')}>Cancelar</button>
          </div>
        </form>
      </main>
    </>
  );
}
