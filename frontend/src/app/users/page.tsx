"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { apiRequest, isAuthenticated } from '@/lib/api';

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: Array<{ id: number; name: string }>;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    const loadUsers = async () => {
      try {
        const response = await apiRequest<{ total: number; items: UserRow[] }>('/api/v1/users');
        setUsers(response.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el listado');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [router]);

  return (
    <>
      <NavBar />
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Usuarios</p>
          <h1 className="mt-2 text-3xl font-bold">Listado de usuarios</h1>
        </div>
        <Link href="/users/new" className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950">
          Crear usuario
        </Link>
      </div>

      {error ? <p className="mb-4 rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-200">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Roles</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-300">
                  Cargando usuarios...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-300">
                  No hay usuarios registrados.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t border-slate-800">
                  <td className="px-4 py-3 font-semibold">{user.full_name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.is_active ? 'Activo' : 'Inactivo'}</td>
                  <td className="px-4 py-3">{user.roles.map((role) => role.name).join(', ')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
    </>
  );
}
