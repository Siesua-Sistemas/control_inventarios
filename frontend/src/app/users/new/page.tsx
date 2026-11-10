"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { SedeJornadaOut, apiRequest, getSedesJornada, isAuthenticated } from '@/lib/api';

interface RoleOption {
  id: number;
  name: string;
  description?: string;
  permissions: Array<{ code: string }>;
}
interface EmpleadoSinCuenta { id: number; nombre_completo: string; cedula: string; email: string | null }

type Tipo = 'empleado' | 'usuario' | 'ambos';

const TIPOS: { value: Tipo; titulo: string; desc: string }[] = [
  { value: 'ambos', titulo: 'Empleado + usuario de acceso', desc: 'Registra a la persona y le crea su cuenta de ingreso.' },
  { value: 'empleado', titulo: 'Solo empleado', desc: 'Ficha de la persona, sin cuenta para ingresar al sistema.' },
  { value: 'usuario', titulo: 'Solo usuario de acceso', desc: 'Crea la cuenta (correo y contraseña); puede vincularse a un empleado ya registrado.' },
];

function CreateUserForm() {
  const router = useRouter();
  const params = useSearchParams();
  const empleadoParam = params.get('empleado_id');

  const [tipo, setTipo] = useState<Tipo>(empleadoParam ? 'usuario' : 'ambos');
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [sedes, setSedes] = useState<SedeJornadaOut[]>([]);
  const [sinCuenta, setSinCuenta] = useState<EmpleadoSinCuenta[]>([]);
  const [empleadoId, setEmpleadoId] = useState(empleadoParam ?? '');
  const [emp, setEmp] = useState({ nombres: '', apellidos: '', cedula: '', cargo: '', departamento: '', sede: '', telefono: '', email: '' });
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activo, setActivo] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const conEmpleado = tipo === 'empleado' || tipo === 'ambos';
  const conCuenta = tipo === 'usuario' || tipo === 'ambos';
  const vinculado = sinCuenta.find((e) => String(e.id) === empleadoId);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    apiRequest<RoleOption[]>('/api/v1/users/roles').then(setRoles).catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar roles'));
    getSedesJornada().then((s) => setSedes(s.filter((x) => x.tipo === 'empresa'))).catch(() => {});
    apiRequest<EmpleadoSinCuenta[]>('/api/v1/personas/empleados-sin-cuenta').then(setSinCuenta).catch(() => {});
  }, [router]);

  // Al elegir un empleado existente se sugiere su correo para la cuenta.
  useEffect(() => {
    if (tipo === 'usuario' && vinculado?.email && !email) setEmail(vinculado.email);
  }, [vinculado, tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const setE = (k: keyof typeof emp) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEmp((p) => ({ ...p, [k]: e.target.value }));

  const toggleRole = (id: number) =>
    setSelectedRoles((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      const nul = (v: string) => v.trim() || null;
      const body = {
        tipo,
        empleado: conEmpleado ? {
          nombres: emp.nombres, apellidos: emp.apellidos, cedula: emp.cedula, cargo: nul(emp.cargo),
          departamento: nul(emp.departamento), sede: nul(emp.sede), telefono: nul(emp.telefono),
          email: tipo === 'ambos' ? email : nul(emp.email), en_jornada: false, sedes_jornada_ids: [],
        } : null,
        empleado_id: tipo === 'usuario' && empleadoId ? Number(empleadoId) : null,
        usuario: conCuenta ? {
          email, password, role_ids: selectedRoles, is_active: activo,
          full_name: tipo === 'ambos' ? `${emp.nombres} ${emp.apellidos}`.trim() : (vinculado ? undefined : fullName),
        } : null,
      };
      await apiRequest('/api/v1/personas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setSuccess('Registro creado correctamente');
      setTimeout(() => router.push(tipo === 'empleado' ? '/empleados' : '/users'), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear el registro');
    } finally {
      setLoading(false);
    }
  };

  const L = ({ id, children }: { id: string; children: React.ReactNode }) => <label htmlFor={id}>{children}</label>;

  return (
    <>
      <NavBar />
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Administración</p>
          <h1 className="mt-2 text-3xl font-bold">Nuevo registro</h1>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">¿Qué necesitas crear?</p>
          <div className="grid gap-3 md:grid-cols-3">
            {TIPOS.map((t) => (
              <label key={t.value} className={`cursor-pointer rounded-xl border p-3 ${tipo === t.value ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                <input type="radio" name="tipo" className="sr-only" checked={tipo === t.value} onChange={() => setTipo(t.value)} />
                <span className="block font-semibold">{t.titulo}</span>
                <span className="block text-xs text-slate-600 dark:text-slate-400">{t.desc}</span>
              </label>
            ))}
          </div>

          {tipo === 'usuario' && (
            <div className="mt-6">
              <L id="empleado">Vincular a un empleado ya registrado (opcional)</L>
              <select id="empleado" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)}>
                <option value="">— Sin vincular —</option>
                {sinCuenta.map((e) => <option key={e.id} value={e.id}>{e.nombre_completo} · {e.cedula}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">Solo aparecen empleados activos que aún no tienen cuenta de acceso.</p>
            </div>
          )}

          {conEmpleado && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div><L id="nombres">Nombres *</L><input id="nombres" value={emp.nombres} onChange={setE('nombres')} required /></div>
              <div><L id="apellidos">Apellidos *</L><input id="apellidos" value={emp.apellidos} onChange={setE('apellidos')} required /></div>
              <div><L id="cedula">Cédula *</L><input id="cedula" value={emp.cedula} onChange={setE('cedula')} required /></div>
              <div><L id="telefono">Teléfono</L><input id="telefono" value={emp.telefono} onChange={setE('telefono')} /></div>
              <div><L id="cargo">Cargo</L><input id="cargo" value={emp.cargo} onChange={setE('cargo')} /></div>
              <div><L id="departamento">Departamento</L><input id="departamento" value={emp.departamento} onChange={setE('departamento')} /></div>
              <div>
                <L id="sede">Sede principal</L>
                <select id="sede" value={emp.sede} onChange={setE('sede')}>
                  <option value="">— Sin asignar —</option>
                  {sedes.map((s) => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                </select>
              </div>
              {tipo === 'empleado' && <div><L id="emailEmp">Correo</L><input id="emailEmp" type="email" value={emp.email} onChange={setE('email')} /></div>}
            </div>
          )}

          {conCuenta && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {tipo === 'usuario' && !vinculado && (
                <div className="md:col-span-2"><L id="fullName">Nombre completo *</L><input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
              )}
              <div><L id="email">Correo (usuario de ingreso) *</L><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
              <div><L id="password">Contraseña * (mín. 8 caracteres)</L><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" /></div>
              <label className="flex items-center gap-2 md:col-span-2">
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                <span className="text-sm">Activar la cuenta ahora <span className="text-slate-500">(si no, queda inactiva hasta que la actives)</span></span>
              </label>
            </div>
          )}

          {conCuenta && (
            <div className="mt-6">
              <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Roles y permisos</p>
              <div className="grid gap-3 md:grid-cols-2">
                {roles.map((role) => (
                  <label key={role.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center justify-between gap-4">
                      <span>
                        <span className="block font-semibold">{role.name}</span>
                        <span className="block text-xs text-slate-700 dark:text-slate-300">{role.description}</span>
                      </span>
                      <input type="checkbox" checked={selectedRoles.includes(role.id)} onChange={() => toggleRole(role.id)} />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error ? <p className="mt-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p> : null}
          {success ? <p className="mt-4 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">{success}</p> : null}

          <div className="mt-6 flex gap-3">
            <button type="submit" className="px-4 py-2 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400" disabled={loading}>
              {loading ? 'Creando...' : 'Crear'}
            </button>
            <button type="button" className="bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700" onClick={() => router.push('/users')}>
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </>
  );
}

export default function CreateUserPage() {
  return <Suspense fallback={null}><CreateUserForm /></Suspense>;
}
