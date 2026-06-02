"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { createEmpleado, isAuthenticated } from '@/lib/api';

export default function NuevoEmpleadoPage() {
  const router = useRouter();
  const [form, setForm] = useState({ nombres: '', apellidos: '', cedula: '', cargo: '', departamento: '', sede: '', email: '', telefono: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!isAuthenticated()) router.replace('/login'); }, [router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await createEmpleado({
        nombres: form.nombres, apellidos: form.apellidos, cedula: form.cedula,
        cargo: form.cargo || null, departamento: form.departamento || null,
        sede: form.sede || null, email: form.email || null, telefono: form.telefono || null,
      });
      router.push('/empleados');
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al crear'); }
    finally { setLoading(false); }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Empleados</p>
          <h1 className="mt-1 text-3xl font-bold">Nuevo empleado</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="nombres">Nombres *</label><input id="nombres" value={form.nombres} onChange={set('nombres')} required /></div>
            <div><label htmlFor="apellidos">Apellidos *</label><input id="apellidos" value={form.apellidos} onChange={set('apellidos')} required /></div>
            <div><label htmlFor="cedula">Cédula *</label><input id="cedula" value={form.cedula} onChange={set('cedula')} required /></div>
            <div><label htmlFor="cargo">Cargo</label><input id="cargo" value={form.cargo} onChange={set('cargo')} /></div>
            <div><label htmlFor="departamento">Departamento</label><input id="departamento" value={form.departamento} onChange={set('departamento')} /></div>
            <div><label htmlFor="sede">Sede</label><input id="sede" value={form.sede} onChange={set('sede')} /></div>
            <div><label htmlFor="email">Correo</label><input id="email" type="email" value={form.email} onChange={set('email')} /></div>
            <div><label htmlFor="telefono">Teléfono</label><input id="telefono" value={form.telefono} onChange={set('telefono')} /></div>
          </div>
          {error && <p className="rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Crear empleado'}</button>
            <button type="button" className="bg-slate-800 text-slate-100" onClick={() => router.push('/empleados')}>Cancelar</button>
          </div>
        </form>
      </main>
    </>
  );
}
