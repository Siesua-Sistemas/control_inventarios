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

  const sedesEmpresa    = sedesDisp.filter((s) => s.tipo === 'empresa');
  const sedesHomeOffice = sedesDisp.filter((s) => s.tipo === 'home_office');
  const sedePrincipalId = sedesDisp.find((s) => s.nombre === form.sede)?.id ?? null;
  const homeOfficeSeleccionado = sedesHomeOffice.some((s) => sedesJornada.includes(s.id));

  const toggleHomeOffice = () => {
    const ids = sedesHomeOffice.map((s) => s.id);
    if (homeOfficeSeleccionado) {
      setSedesJornada((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSedesJornada((prev) => [...new Set([...prev, ...ids])]);
    }
  };

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
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Nuevo empleado</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

          {/* Campos principales */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nombres" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nombres *</label>
              <input id="nombres" className="w-full" value={form.nombres} onChange={set('nombres')} placeholder="Ej: María Fernanda" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="apellidos" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Apellidos *</label>
              <input id="apellidos" className="w-full" value={form.apellidos} onChange={set('apellidos')} placeholder="Ej: González Ruiz" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cedula" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cédula *</label>
              <input id="cedula" className="w-full" value={form.cedula} onChange={set('cedula')} placeholder="Ej: 1020304050" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cargo" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Cargo</label>
              <input id="cargo" className="w-full" value={form.cargo} onChange={set('cargo')} placeholder="Ej: Asesora líder" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="departamento" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Departamento</label>
              <input id="departamento" className="w-full" value={form.departamento} onChange={set('departamento')} placeholder="Ej: Ventas" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sede" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Sede principal</label>
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
                <input id="sede" className="w-full" value={form.sede} onChange={set('sede')} placeholder="Ej: Bogotá Norte" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Correo</label>
              <input id="email" className="w-full" type="email" value={form.email} onChange={set('email')} placeholder="correo@ejemplo.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="telefono" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Teléfono</label>
              <input id="telefono" className="w-full" value={form.telefono} onChange={set('telefono')} placeholder="Ej: 3001234567" />
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800" />

          {/* Nuestro Horario */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Nuestro Horario</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Aparece en el control de asistencia diario</p>
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

          {/* Sedes de bodega */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="mb-3 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Sedes de bodega</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ubicaciones desde donde este colaborador reporta elementos</p>
              </div>
            </div>

            {sedesDisp.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                No hay sedes configuradas. Ve a <strong>Personal → Sedes jornada</strong> para crearlas.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {sedesEmpresa.map((s) => {
                  const sel = sedesJornada.includes(s.id);
                  const esPrincipal = s.id === sedePrincipalId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSede(s.id)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                        sel
                          ? 'bg-cyan-600 text-white shadow-sm dark:bg-cyan-500 dark:text-slate-950'
                          : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-cyan-300 hover:bg-cyan-50 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:border-cyan-500 dark:hover:bg-cyan-900/20'
                      }`}
                    >
                      {sel ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <span className="h-3 w-3 rounded-full border border-current opacity-40" />
                      )}
                      {s.nombre}{s.ciudad ? ` · ${s.ciudad}` : ''}
                      {esPrincipal && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          sel ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400'
                        }`}>
                          Principal
                        </span>
                      )}
                    </button>
                  );
                })}

                {sedesHomeOffice.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleHomeOffice}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                      homeOfficeSeleccionado
                        ? 'bg-violet-600 text-white shadow-sm dark:bg-violet-500 dark:text-slate-950'
                        : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-violet-300 hover:bg-violet-50 dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-300 dark:hover:border-violet-500 dark:hover:bg-violet-900/20'
                    }`}
                  >
                    {homeOfficeSeleccionado ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-current opacity-40" />
                    )}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                    </svg>
                    Home Office
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 rounded-xl"
            >
              {loading ? 'Guardando...' : 'Crear empleado'}
            </button>
            <button
              type="button"
              className="px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl"
              onClick={() => router.push('/empleados')}
            >
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
