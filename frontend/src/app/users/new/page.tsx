"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { apiRequest, isAuthenticated } from '@/lib/api';

interface RoleOption {
  id: number;
  name: string;
  description?: string;
  permissions: Array<{ code: string }>;
}

export default function CreateUserPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    const loadRoles = async () => {
      try {
        const response = await apiRequest<RoleOption[]>('/api/v1/users/roles');
        setRoles(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar roles');
      }
    };

    loadRoles();
  }, [router]);

  const toggleRole = (roleId: number) => {
    setSelectedRoles((current) =>
      current.includes(roleId) ? current.filter((item) => item !== roleId) : [...current, roleId],
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          role_ids: selectedRoles,
        }),
      });

      setSuccess('Usuario creado correctamente');
      setTimeout(() => router.push('/users'), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear el usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <NavBar />
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10">
      <div className="mb-6">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Usuarios</p>
        <h1 className="mt-2 text-3xl font-bold">Crear usuario</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="fullName">Nombre completo</label>
            <input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </div>
          <div>
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
        </div>

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
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.id)}
                    onChange={() => toggleRole(role.id)}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        {error ? <p className="mt-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p> : null}
        {success ? <p className="mt-4 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">{success}</p> : null}

        <div className="mt-6 flex gap-3">
          <button type="submit" className="px-4 py-2 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400" disabled={loading}>
            {loading ? 'Creando...' : 'Crear usuario'}
          </button>
          <button
            type="button"
            className="bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            onClick={() => router.push('/users')}
          >
            Cancelar
          </button>
        </div>
      </form>
    </main>
    </>
  );
}
