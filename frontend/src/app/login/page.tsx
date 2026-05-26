"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { isAuthenticated } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@inventario.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/users');
    }
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      router.push('/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
      <div className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Inventario</p>
          <h1 className="mt-2 text-2xl font-bold">Inicio de sesión</h1>
          <p className="mt-2 text-sm text-slate-300">
            Accede con tu usuario para gestionar roles, permisos y usuarios.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? <p className="rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</p> : null}

          <button type="submit" className="w-full py-3" disabled={loading}>
            {loading ? 'Validando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </main>
  );
}
