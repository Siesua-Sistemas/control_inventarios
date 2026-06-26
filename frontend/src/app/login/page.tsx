"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { isAuthenticated, verificarEmpleado } from '@/lib/api';

type Tab = 'sistema' | 'colaborador' | 'jornada';

export default function LoginPage() {
  const router = useRouter();
  const { login, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('sistema');

  // Tab sistema
  const [email, setEmail] = useState('sistemas@siesua.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Tab colaborador
  const [documento, setDocumento] = useState('');
  const [docError, setDocError] = useState('');
  const [docLoading, setDocLoading] = useState(false);

  // Tab jornada
  const [cedulaJornada, setCedulaJornada] = useState('');
  const [jornadaError, setJornadaError] = useState('');
  const [jornadaLoading, setJornadaLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace('/inicio');
    }
  }, [router]);

  const handleSistemaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.push('/inicio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleColaboradorSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDocLoading(true);
    setDocError('');
    try {
      await verificarEmpleado(documento.trim());
      router.push(`/portal?doc=${encodeURIComponent(documento.trim())}`);
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'Cédula no registrada o empleado inactivo');
    } finally {
      setDocLoading(false);
    }
  };

  const handleJornadaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setJornadaLoading(true);
    setJornadaError('');
    try {
      await verificarEmpleado(cedulaJornada.trim());
      router.push(`/jornada?doc=${encodeURIComponent(cedulaJornada.trim())}`);
    } catch (err) {
      setJornadaError(err instanceof Error ? err.message : 'Cédula no registrada o empleado inactivo');
    } finally {
      setJornadaLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Inventario</p>
          <h1 className="mt-2 text-2xl font-bold">Bienvenido</h1>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex rounded-lg border border-slate-200 p-1 dark:border-slate-700">
          <button
            type="button"
            onClick={() => { setTab('sistema'); setError(''); setDocError(''); setJornadaError(''); }}
            className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${tab === 'sistema' ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
          >
            Sistema
          </button>
          <button
            type="button"
            onClick={() => { setTab('colaborador'); setError(''); setDocError(''); setJornadaError(''); }}
            className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${tab === 'colaborador' ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
          >
            Portal
          </button>
          <button
            type="button"
            onClick={() => { setTab('jornada'); setError(''); setDocError(''); setJornadaError(''); }}
            className={`flex-1 rounded-md py-2 text-xs font-medium transition-colors ${tab === 'jornada' ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
          >
            Mi Jornada
          </button>
        </div>

        {/* Tab sistema */}
        {tab === 'sistema' && (
          <form onSubmit={handleSistemaSubmit} className="space-y-4">
            <div>
              <label htmlFor="email">Correo</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">
                {error}
              </p>
            )}
            <button type="submit" className="w-full py-3 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400" disabled={loading}>
              {loading ? 'Validando...' : 'Ingresar'}
            </button>
          </form>
        )}

        {/* Tab colaborador */}
        {tab === 'colaborador' && (
          <form onSubmit={handleColaboradorSubmit} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ingresa tu número de cédula para acceder al portal de empleados y ver las redes WiFi de tu sede.
            </p>
            <div>
              <label htmlFor="documento">Número de documento</label>
              <input
                id="documento"
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="Ej: 12345678"
                required
              />
            </div>
            {docError && (
              <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">
                {docError}
              </p>
            )}
            <button type="submit" className="w-full py-3 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400" disabled={docLoading}>
              {docLoading ? 'Verificando...' : 'Ingresar al portal'}
            </button>
          </form>
        )}

        {/* Tab jornada */}
        {tab === 'jornada' && (
          <form onSubmit={handleJornadaSubmit} className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-cyan-50 p-3 dark:bg-cyan-900/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8 shrink-0 text-cyan-600 dark:text-cyan-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-cyan-800 dark:text-cyan-200">
                Registra tu ingreso o salida del día con tu número de cédula.
              </p>
            </div>
            <div>
              <label htmlFor="cedulaJornada">Número de documento</label>
              <input
                id="cedulaJornada"
                type="text"
                inputMode="numeric"
                value={cedulaJornada}
                onChange={(e) => setCedulaJornada(e.target.value)}
                placeholder="Ej: 12345678"
                required
              />
            </div>
            {jornadaError && (
              <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">
                {jornadaError}
              </p>
            )}
            <button type="submit" className="w-full py-3 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400" disabled={jornadaLoading}>
              {jornadaLoading ? 'Verificando...' : 'Ir a Mi Jornada'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
