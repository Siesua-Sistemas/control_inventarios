"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { SedeJornadaOut, createEmpleado, getSedesJornada, isAuthenticated } from '@/lib/api';

export default function NuevoEmpleadoPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nombres: '', apellidos: '', cedula: '', cargo: '',
    departamento: '', sede: '', email: '', telefono: '',
  });
  const [enJornada, setEnJornada] = useState(false);
  const [sedesJornada, setSedesJornada] = useState<number[]>([]);
  const [sedesDisp, setSedesDisp] = useState<SedeJornadaOut[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getSedesJornada().then(setSedesDisp).catch(() => {});
  }, [router]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSedeChange = (nombre: string) => {
    setForm((p) => ({ ...p, sede: nombre }));
    if (enJornada && nombre) {
      const sedeObj = sedesDisp.find((s) => s.nombre === nombre);
      if (sedeObj && !sedesJornada.includes(sedeObj.id)) {
        setSedesJornada((prev) => [...prev, sedeObj.id]);
      }
    }
  };

  const toggleSede = (id: number) =>
    setSedesJornada((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const sedesEmpresa = sedesDisp.filter((s) => s.tipo === 'empresa');
  const sedePrincipalId = sedesDisp.find((s) => s.nombre === form.sede)?.id ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await createEmpleado({
        nombres: form.nombres, apellidos: form.apellidos, cedula: form.cedula,
        cargo: form.cargo || null, departamento: form.departamento || null,
        sede: form.sede || null, email: form.email || null, telefono: form.telefono || null,
        en_jornada: enJornada,
        sedes_jornada_ids: enJornada ? sedesJornada : [],
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
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Empleados</p>
          <h1 className="mt-1 text-3xl font-bold">Nuevo empleado</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="nombres">Nombres *</label><input id="nombres" value={form.nombres} onChange={set('nombres')} required /></div>
            <div><label htmlFor="apellidos">Apellidos *</label><input id="apellidos" value={form.apellidos} onChange={set('apellidos')} required /></div>
            <div><label htmlFor="cedula">Cédula *</label><input id="cedula" value={form.cedula} onChange={set('cedula')} required /></div>
            <div><label htmlFor="cargo">Cargo</label><input id="cargo" value={form.cargo} onChange={set('cargo')} /></div>
            <div><label htmlFor="departamento">Departamento</label><input id="departamento" value={form.departamento} onChange={set('departamento')} /></div>

            {/* Sede principal — select real de sedes empresa */}
            <div>
              <label htmlFor="sede">Sede principal</label>
              {sedesEmpresa.length > 0 ? (
                <select
                  id="sede"
                  value={form.sede}
                  onChange={(e) => handleSedeChange(e.target.value)}
                  className="w-full"
                >
                  <option value="">— Sin asignar —</option>
                  {sedesEmpresa.map((s) => (
                    <option key={s.id} value={s.nombre}>
                      {s.nombre}{s.ciudad ? ` · ${s.ciudad}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input id="sede" value={form.sede} onChange={set('sede')} placeholder="Ej: Bogotá Norte" />
              )}
            </div>

            <div><label htmlFor="email">Correo</label><input id="email" type="email" value={form.email} onChange={set('email')} /></div>
            <div><label htmlFor="telefono">Teléfono</label><input id="telefono" value={form.telefono} onChange={set('telefono')} /></div>
          </div>

          {/* Sección Mi Jornada */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Mi Jornada</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Aparece en el control de asistencia</p>
              </div>
              <button
                type="button"
                onClick={() => setEnJornada((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  enJornada ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enJornada ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Sedes de bodega — independiente de Mi Jornada */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Sedes de bodega
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Sedes vinculadas a este colaborador. Se usan al generar tickets de bodega para identificar desde qué ubicación reporta el elemento.
                </p>
              </div>
              {sedesDisp.length === 0 ? (
                <p className="text-xs text-slate-400">No hay sedes configuradas. Ve a <strong>Personal → Sedes jornada</strong> para crearlas.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sedesDisp.map((s) => {
                    const sel = sedesJornada.includes(s.id);
                    const esPrincipal = s.id === sedePrincipalId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSede(s.id)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                          sel
                            ? s.tipo === 'home_office'
                              ? 'bg-violet-600 text-white dark:bg-violet-500 dark:text-slate-950'
                              : 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950'
                            : 'border border-slate-300 bg-white text-slate-600 hover:border-cyan-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {sel && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                        {s.tipo === 'home_office' && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                          </svg>
                        )}
                        {s.nombre}
                        {s.ciudad ? ` · ${s.ciudad}` : ''}
                        {esPrincipal && (
                          <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            sel ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400'
                          }`}>
                            Principal
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400">{loading ? 'Guardando...' : 'Crear empleado'}</button>
            <button type="button" className="bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" onClick={() => router.push('/empleados')}>Cancelar</button>
          </div>
        </form>
      </main>
    </>
  );
}
