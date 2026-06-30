"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { isAuthenticated, verificarEmpleado } from '@/lib/api';

type Tab = 'sistema' | 'colaborador' | 'jornada';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [tab, setTab] = useState<Tab>('sistema');

  const [email, setEmail] = useState('sistemas@siesua.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [documento, setDocumento] = useState('');
  const [docError, setDocError] = useState('');
  const [docLoading, setDocLoading] = useState(false);

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

  const resetErrors = () => {
    setError('');
    setDocError('');
    setJornadaError('');
  };

  const inputStyles = "mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition-all focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-500/20 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:focus:border-cyan-400 dark:focus:bg-slate-800";
  const labelStyles = "text-xs font-bold text-slate-700 dark:text-slate-300 tracking-wide uppercase";
  const buttonStyles = "w-full rounded-xl py-3.5 px-4 bg-cyan-600 text-sm font-semibold text-white shadow-md shadow-cyan-600/10 hover:bg-cyan-700 active:scale-[0.98] transition-all disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400";

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6 py-12 bg-slate-50 dark:bg-slate-950">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900 transition-all">

        {/* Encabezado */}
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-600 dark:text-cyan-400">
            Siesua Interno
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Bienvenido
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Selecciona tu método de acceso
          </p>
        </div>

        {/* Tabs con íconos */}
        <div className="mb-8 flex gap-1 rounded-xl bg-slate-100 p-1.5 dark:bg-slate-800/60">
          <button
            type="button"
            onClick={() => { setTab('sistema'); resetErrors(); }}
            className={`flex flex-col items-center justify-center flex-1 rounded-lg py-3 text-[11px] font-semibold tracking-wide transition-all ${
              tab === 'sistema'
                ? 'bg-white text-cyan-600 shadow-sm dark:bg-slate-700 dark:text-cyan-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Sistema
          </button>

          <button
            type="button"
            onClick={() => { setTab('colaborador'); resetErrors(); }}
            className={`flex flex-col items-center justify-center flex-1 rounded-lg py-3 text-[11px] font-semibold tracking-wide transition-all ${
              tab === 'colaborador'
                ? 'bg-white text-cyan-600 shadow-sm dark:bg-slate-700 dark:text-cyan-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Portal
          </button>

          <button
            type="button"
            onClick={() => { setTab('jornada'); resetErrors(); }}
            className={`flex flex-col items-center justify-center flex-1 rounded-lg py-3 text-[11px] font-semibold tracking-wide transition-all ${
              tab === 'jornada'
                ? 'bg-white text-cyan-600 shadow-sm dark:bg-slate-700 dark:text-cyan-300'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Mi Jornada
          </button>
        </div>

        {/* Tab sistema */}
        {tab === 'sistema' && (
          <form onSubmit={handleSistemaSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className={labelStyles}>Correo corporativo</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputStyles}
                placeholder="nombre@siesua.com"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className={labelStyles}>Contraseña</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputStyles}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
                {error}
              </p>
            )}
            <button type="submit" className={buttonStyles} disabled={loading}>
              {loading ? 'Validando credenciales...' : 'Iniciar Sesión'}
            </button>
          </form>
        )}

        {/* Tab colaborador */}
        {tab === 'colaborador' && (
          <form onSubmit={handleColaboradorSubmit} className="space-y-5">
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Ingresa tu número de documento para acceder al portal autónomo de redes WiFi corporativas.
            </p>
            <div>
              <label htmlFor="documento" className={labelStyles}>Número de documento</label>
              <input
                id="documento"
                type="text"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                className={inputStyles}
                placeholder="Ej: 10203040"
                required
              />
            </div>
            {docError && (
              <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
                {docError}
              </p>
            )}
            <button type="submit" className={buttonStyles} disabled={docLoading}>
              {docLoading ? 'Verificando empleado...' : 'Ingresar al Portal'}
            </button>
          </form>
        )}

        {/* Tab jornada */}
        {tab === 'jornada' && (
          <form onSubmit={handleJornadaSubmit} className="space-y-5">
            <div className="flex items-start gap-3 rounded-xl bg-cyan-50/60 p-4 border border-cyan-100/40 dark:bg-cyan-950/20 dark:border-cyan-900/30">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 mt-0.5 shrink-0 text-cyan-600 dark:text-cyan-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs leading-relaxed text-cyan-800 dark:text-cyan-300">
                <strong>Registro de asistencia rápido:</strong> Digita tu cédula para marcar tu entrada, salida o tiempos de descanso del día.
              </p>
            </div>
            <div>
              <label htmlFor="cedulaJornada" className={labelStyles}>Número de documento</label>
              <input
                id="cedulaJornada"
                type="text"
                inputMode="numeric"
                value={cedulaJornada}
                onChange={(e) => setCedulaJornada(e.target.value)}
                className={inputStyles}
                placeholder="Ej: 10203040"
                required
              />
            </div>
            {jornadaError && (
              <p className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-400">
                {jornadaError}
              </p>
            )}
            <button type="submit" className={buttonStyles} disabled={jornadaLoading}>
              {jornadaLoading ? 'Procesando marca...' : 'Ir a Mi Jornada →'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
