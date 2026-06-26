"use client";

import { useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { SiesuaSyncResult, sincronizarSiesua } from '@/lib/api';

export default function IntegracionesPage() {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<SiesuaSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ultimaSync, setUltimaSync] = useState<string | null>(null);

  async function ejecutarSync() {
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const res = await sincronizarSiesua();
      setResultado(res);
      setUltimaSync(new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-10">
        {/* Encabezado */}
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">
            Administración
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50">
            Integraciones
          </h1>
        </div>

        {/* Tarjeta SIESUA */}
        <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {/* Cabecera */}
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 dark:bg-cyan-900/30">
                <svg className="h-5 w-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-slate-50">SIESUA</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Sincroniza sedes y empleados activos desde la base de datos MySQL de SIESUA.
                  Crea los registros que no existen y actualiza los que ya están.
                </p>
                {ultimaSync && (
                  <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                    Última sincronización: {ultimaSync}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={ejecutarSync}
              disabled={cargando}
              className="shrink-0 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
            >
              {cargando ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sincronizando...
                </span>
              ) : (
                'Sincronizar ahora'
              )}
            </button>
          </div>

          {/* Error de conexión */}
          {error && (
            <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Error</p>
              <p className="mt-0.5 text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Resultado de la sincronización */}
          {resultado && (
            <div className="p-6">
              {/* Estado general */}
              <div className={`mb-5 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
                resultado.ok
                  ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
              }`}>
                {resultado.ok ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  </svg>
                )}
                {resultado.ok
                  ? 'Sincronización completada sin errores'
                  : `Sincronización con ${resultado.errores.length} error(es)`}
              </div>

              {/* Métricas */}
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Stat label="Sedes creadas" value={resultado.sedes_creadas} color="cyan" />
                <Stat label="Sedes actualizadas" value={resultado.sedes_actualizadas} color="slate" />
                <Stat label="Empleados creados" value={resultado.empleados_creados} color="cyan" />
                <Stat label="Empleados actualizados" value={resultado.empleados_actualizados} color="slate" />
                <Stat label="Sin cambios" value={resultado.empleados_sin_cambios} color="slate" />
              </div>

              {/* Errores individuales */}
              {resultado.errores.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
                    Errores ({resultado.errores.length})
                  </p>
                  <ul className="space-y-1">
                    {resultado.errores.map((e, i) => (
                      <li key={i} className="text-sm text-red-700 dark:text-red-300">
                        · {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Nota sobre sedes nuevas */}
              {resultado.sedes_creadas > 0 && (
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Las sedes nuevas fueron creadas con coordenadas de Bogotá como marcador.
                  Ve a <strong>Personal → Ubicaciones</strong> para configurar la geovalla correcta de cada una.
                </p>
              )}
            </div>
          )}

          {/* Info cuando no se ha ejecutado */}
          {!resultado && !error && !cargando && (
            <div className="p-6">
              <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                <p><span className="font-medium text-slate-700 dark:text-slate-200">Qué sincroniza:</span> Sedes activas y empleados activos de SIESUA.</p>
                <p><span className="font-medium text-slate-700 dark:text-slate-200">Cómo funciona:</span> Los registros que no existen se crean. Los que ya existen se actualizan con los datos más recientes.</p>
                <p><span className="font-medium text-slate-700 dark:text-slate-200">Es seguro repetirlo:</span> La sincronización es idempotente — ejecutarla varias veces no genera duplicados.</p>
                <p><span className="font-medium text-slate-700 dark:text-slate-200">Sedes y geovalla:</span> Las sedes nuevas se crean sin GPS. El administrador debe configurar las coordenadas desde Personal → Ubicaciones.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: 'cyan' | 'slate' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <p className={`text-2xl font-bold ${
        color === 'cyan' && value > 0
          ? 'text-cyan-600 dark:text-cyan-400'
          : 'text-slate-700 dark:text-slate-200'
      }`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
