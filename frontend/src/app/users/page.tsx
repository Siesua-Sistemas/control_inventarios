"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import { isAuthenticated, listUsers, type UserItem } from '@/lib/api';

export default function UsersPage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canWrite = authLoading || hasPermission('users:write');
  const canManageRoles = authLoading || hasPermission('roles:read');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }

    const loadUsers = async () => {
      try {
        const response = await listUsers();
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Usuarios</p>
          <h1 className="mt-2 text-3xl font-bold">Listado de usuarios</h1>
        </div>
        <div className="flex gap-3">
          {canManageRoles ? (
            <Link href="/users/roles" className="rounded-md border border-slate-300 bg-slate-100 px-4 py-2 font-semibold text-slate-900 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
              Roles y permisos
            </Link>
          ) : null}
          {canWrite ? (
            <Link href="/users/new" className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950">
              Crear usuario
            </Link>
          ) : null}
        </div>
      </div>

      {error ? <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Roles</th>
              {canWrite ? <th className="px-4 py-3">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-700 dark:text-slate-300">
                  Cargando usuarios...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-700 dark:text-slate-300">
                  No hay usuarios registrados.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="px-4 py-3 font-semibold">{user.full_name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.is_active ? 'Activo' : 'Inactivo'}</td>
                  <td className="px-4 py-3">{user.roles.map((role) => role.name).join(', ')}</td>
                  {canWrite ? (
                    <td className="px-4 py-3">
                      <Link
                        href={`/users/${user.id}/edit`}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-slate-100 dark:border-slate-700 dark:text-cyan-300 dark:hover:bg-slate-800"
                      >
                        Editar
                      </Link>
                    </td>
                  ) : null}
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
