"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { StatCard } from '@/components/stat-card';
import {
  AsistenciaResponse,
  getAsistencia,
  isAuthenticated,
  listEmpleados,
} from '@/lib/api';

function hoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  });
}

function formatFecha(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });
}

const ACCESOS_RAPIDOS = [
  { href: '/jornada/dashboard', label: 'Asistencia de hoy', color: 'border-emerald-300 hover:border-emerald-500 dark:border-emerald-800 dark:hover:border-emerald-600' },
  { href: '/jornada/reporte', label: 'Reporte semanal', color: 'border-cyan-300 hover:border-cyan-500 dark:border-cyan-800 dark:hover:border-cyan-600' },
  { href: '/empleados', label: 'Empleados', color: 'border-blue-300 hover:border-blue-500 dark:border-blue-800 dark:hover:border-blue-600' },
  { href: '/jornada/admin/sedes', label: 'Administrar sedes', color: 'border-purple-300 hover:border-purple-500 dark:border-purple-800 dark:hover:border-purple-600' },
];

export function GestionHumanaDashboardContent() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<AsistenciaResponse | null>(null);
  const [nomina, setNomina] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const puedeVerJornada = hasPermission('jornada:read');
  const puedeAdminJornada = hasPermission('jornada:admin');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (!puedeVerJornada) { setLoading(false); return; }

    Promise.all([
      getAsistencia({ fecha: hoy() }),
      listEmpleados({ limit: 1 }).catch(() => null),
    ])
      .then(([asistencia, empleados]) => {
        setData(asistencia);
        setNomina(empleados?.total ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar el dashboard'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, puedeVerJornada]);

  const ausentes = (data?.empleados ?? []).filter((e) => e.estado === 'ausente');
  const accesos = puedeAdminJornada ? ACCESOS_RAPIDOS : ACCESOS_RAPIDOS.filter((a) => a.href !== '/jornada/admin/sedes');

  if (!puedeVerJornada) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="font-semibold text-slate-600 dark:text-slate-400">Sin acceso</p>
        <p className="text-sm text-slate-400">Necesitas el permiso <code>jornada:read</code></p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Accesos rápidos */}
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {accesos.map(({ href, label, color }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-xl border bg-white px-4 py-5 text-center text-base font-semibold text-slate-700 transition-colors hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-slate-100 ${color}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-600 dark:text-slate-400">Cargando estadísticas...</p>
      ) : data ? (
        <>
          {data && (
            <p className="mb-3 text-sm capitalize text-slate-500 dark:text-slate-400">
              Asistencia de hoy · {formatFecha(data.fecha)}
            </p>
          )}

          {/* KPI cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Nómina activa" value={nomina ?? data.total_empleados} color="text-slate-900 dark:text-slate-100" />
            <StatCard label="En sede" value={data.presentes} sub="Entrada sin salida" color="text-emerald-600 dark:text-emerald-400" />
            <StatCard label="Completaron" value={data.completos} sub="Jornada cerrada" color="text-blue-600 dark:text-blue-400" />
            <StatCard label="Ausentes" value={data.ausentes} sub="Sin registros hoy" color="text-red-600 dark:text-red-400" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Ausentes */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">Ausentes hoy</h2>
                <Link href="/jornada/dashboard" className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300">Ver todo →</Link>
              </div>
              {ausentes.length === 0 ? (
                <p className="text-sm text-slate-500">Todos los colaboradores tienen registro hoy.</p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ausentes.slice(0, 8).map((e) => (
                    <div key={e.empleado_id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{e.nombres} {e.apellidos}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{[e.cargo, e.sede].filter(Boolean).join(' · ') || '—'}</p>
                      </div>
                      <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">Sin registro</span>
                    </div>
                  ))}
                  {ausentes.length > 8 && (
                    <p className="pt-2 text-xs text-slate-400">y {ausentes.length - 8} más…</p>
                  )}
                </div>
              )}
            </div>

            {/* En sede ahora mismo */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">En sede ahora</h2>
              {data.empleados.filter((e) => e.estado === 'presente').length === 0 ? (
                <p className="text-sm text-slate-500">Nadie con jornada abierta.</p>
              ) : (
                <div className="space-y-2">
                  {data.empleados.filter((e) => e.estado === 'presente').slice(0, 6).map((e) => (
                    <div key={e.empleado_id} className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">{e.nombres} {e.apellidos}</span>
                      <span className="ml-2 shrink-0 font-mono text-xs text-emerald-700 dark:text-emerald-400">
                        {e.entrada ? formatHora(e.entrada.timestamp) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
