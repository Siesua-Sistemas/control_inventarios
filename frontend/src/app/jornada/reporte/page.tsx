"use client";

import { useEffect, useRef, useState } from 'react';
import { NavBar } from '@/components/nav-bar';
import {
  DiaRegistros,
  EmpleadoSemanaOut,
  ReporteSemanalOut,
  SedeJornadaOut,
  getReporteSemanal,
  getSedesJornada,
  isAuthenticated,
} from '@/lib/api';
import { useRouter } from 'next/navigation';

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  });
}

function formatMinutos(min: number): string {
  if (min === 0) return '0h';
  return `${Math.floor(min / 60)}h ${(min % 60).toString().padStart(2, '0')}m`;
}

function labelSemana(inicio: string, fin: string): string {
  const ops = { day: '2-digit' as const, month: 'short' as const, timeZone: 'UTC' };
  const i = new Date(inicio + 'T12:00:00Z').toLocaleDateString('es-CO', ops);
  const f = new Date(fin + 'T12:00:00Z').toLocaleDateString('es-CO', { ...ops, year: 'numeric' as const });
  return `${i} – ${f}`;
}

// ── Celda de día ─────────────────────────────────────────────────────────────

function DiaCell({ dia }: { dia: DiaRegistros }) {
  const entrada = dia.registros.find((r) => r.tipo === 'entrada');
  const salida = dia.registros.find((r) => r.tipo === 'salida');
  const esFuturo = !dia.es_hoy && dia.registros.length === 0 &&
    new Date(dia.fecha + 'T12:00:00Z') > new Date();

  if (esFuturo) {
    return <td className="border border-slate-100 px-2 py-2 text-center dark:border-slate-800" />;
  }

  if (!entrada && !salida) {
    return (
      <td className="border border-slate-100 px-2 py-2 text-center dark:border-slate-800">
        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
      </td>
    );
  }

  if (entrada && salida && dia.tiempo_sede) {
    return (
      <td className="border border-slate-100 px-1.5 py-1.5 text-center dark:border-slate-800">
        <div className="rounded-lg bg-emerald-50 px-1.5 py-1.5 dark:bg-emerald-900/20">
          <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{dia.tiempo_sede}</p>
          <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500">
            {formatHora(entrada.timestamp)} – {formatHora(salida.timestamp)}
          </p>
        </div>
      </td>
    );
  }

  // Solo entrada
  return (
    <td className="border border-slate-100 px-1.5 py-1.5 text-center dark:border-slate-800">
      <div className="rounded-lg bg-amber-50 px-1.5 py-1.5 dark:bg-amber-900/20">
        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">↗ {formatHora(entrada!.timestamp)}</p>
        <p className="text-[10px] text-amber-500/70 dark:text-amber-500">sin salida</p>
      </div>
    </td>
  );
}

// ── Fila de empleado ──────────────────────────────────────────────────────────

function EmpleadoRow({ emp }: { emp: EmpleadoSemanaOut }) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
      <td className="sticky left-0 z-10 border border-slate-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">
          {emp.nombres} {emp.apellidos}
        </p>
        {(emp.cargo || emp.sede) && (
          <p className="text-xs text-slate-400 leading-tight">
            {[emp.cargo, emp.sede].filter(Boolean).join(' · ')}
          </p>
        )}
      </td>
      {emp.dias.map((dia) => (
        <DiaCell key={dia.fecha} dia={dia} />
      ))}
      <td className="border border-slate-100 px-2 py-2 text-center dark:border-slate-800">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
          emp.dias_asistidos >= 5
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : emp.dias_asistidos >= 3
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {emp.dias_asistidos}
          {emp.dias_incompletos > 0 && (
            <span className="text-[10px] opacity-70"> +{emp.dias_incompletos}⚠</span>
          )}
        </span>
      </td>
      <td className="border border-slate-100 px-3 py-2 text-right text-sm font-semibold tabular-nums text-cyan-700 dark:border-slate-800 dark:text-cyan-400">
        {emp.total_minutos > 0 ? formatMinutos(emp.total_minutos) : '—'}
      </td>
    </tr>
  );
}

// ── Fila de totales ───────────────────────────────────────────────────────────

function TotalesRow({ reporte }: { reporte: ReporteSemanalOut }) {
  const numDias = reporte.empleados[0]?.dias.length ?? 0;
  const presentesPorDia = Array.from({ length: numDias }, (_, i) =>
    reporte.empleados.filter(
      (emp) => emp.dias[i] && emp.dias[i].registros.length > 0
    ).length
  );
  const totalMinutos = reporte.empleados.reduce((a, e) => a + e.total_minutos, 0);

  return (
    <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold dark:border-slate-600 dark:bg-slate-800/50">
      <td className="sticky left-0 z-10 border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
        Con registro
      </td>
      {presentesPorDia.map((p, i) => (
        <td key={i} className="border border-slate-200 px-2 py-2 text-center dark:border-slate-700">
          {p > 0 ? (
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{p}</span>
          ) : (
            <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
          )}
        </td>
      ))}
      <td className="border border-slate-200 px-2 py-2 dark:border-slate-700" />
      <td className="border border-slate-200 px-3 py-2 text-right text-sm font-bold text-cyan-700 dark:border-slate-700 dark:text-cyan-400">
        {totalMinutos > 0 ? formatMinutos(totalMinutos) : '—'}
      </td>
    </tr>
  );
}

// ── Exportar CSV ─────────────────────────────────────────────────────────────

function exportarCSV(reporte: ReporteSemanalOut) {
  const dias = reporte.empleados[0]?.dias ?? [];
  const cabeceras = [
    'Empleado', 'Cargo', 'Sede',
    ...dias.map((d) => `${d.dia_semana} ${d.fecha.slice(5).replace('-', '/')}`),
    'Días', 'Total horas',
  ];

  const filas = reporte.empleados.map((emp) => [
    `${emp.apellidos} ${emp.nombres}`,
    emp.cargo ?? '',
    emp.sede ?? '',
    ...emp.dias.map((dia) => {
      const e = dia.registros.find((r) => r.tipo === 'entrada');
      const s = dia.registros.find((r) => r.tipo === 'salida');
      if (dia.tiempo_sede) return `${formatHora(e!.timestamp)}-${formatHora(s!.timestamp)} (${dia.tiempo_sede})`;
      if (e) return `↗ ${formatHora(e.timestamp)} (sin salida)`;
      return '';
    }),
    emp.dias_asistidos + (emp.dias_incompletos > 0 ? `+${emp.dias_incompletos}` : ''),
    emp.total_minutos > 0 ? formatMinutos(emp.total_minutos) : '0',
  ]);

  const contenido = [cabeceras, ...filas]
    .map((fila) => fila.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `asistencia_${reporte.semana_inicio}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ReporteSemanalPage() {
  const router = useRouter();
  const [reporte, setReporte] = useState<ReporteSemanalOut | null>(null);
  const [sedes, setSedes] = useState<SedeJornadaOut[]>([]);
  const [sedeId, setSedeId] = useState<number | undefined>();
  const [semana, setSemana] = useState<string>('');   // ISO date de referencia (lunes)
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getSedesJornada().then(setSedes).catch(() => {});
  }, [router]);

  useEffect(() => {
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semana, sedeId]);

  async function cargar() {
    setLoading(true);
    try {
      const data = await getReporteSemanal(semana || undefined, sedeId);
      setReporte(data);
      if (!semana) setSemana(data.semana_inicio);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const irSemana = (delta: number) => {
    const base = semana || reporte?.semana_inicio || new Date().toISOString().slice(0, 10);
    setSemana(addDays(base, delta * 7));
  };

  const diasSemana = reporte?.empleados[0]?.dias ?? [];
  const totalHoras = reporte?.empleados.reduce((a, e) => a + e.total_minutos, 0) ?? 0;
  const totalDias = reporte?.empleados.reduce((a, e) => a + e.dias_asistidos, 0) ?? 0;

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 print:bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 print:px-0 print:py-2">

          {/* Header */}
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 print:mb-3">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300 print:text-cyan-700">
                Jornada
              </p>
              <h1 className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-slate-50">
                Reporte de asistencia semanal
              </h1>
              {reporte && (
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {labelSemana(reporte.semana_inicio, reporte.semana_fin)}
                </p>
              )}
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                Imprimir
              </button>
              {reporte && reporte.empleados.length > 0 && (
                <button
                  onClick={() => exportarCSV(reporte)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Exportar CSV
                </button>
              )}
            </div>
          </div>

          {/* Controles de semana + filtro sede */}
          <div className="mb-5 flex flex-wrap items-center gap-3 print:hidden">
            {/* Navegación de semana */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <button
                onClick={() => irSemana(-1)}
                disabled={loading}
                className="rounded-l-xl px-3 py-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700"
                title="Semana anterior"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
              <span className="min-w-[11rem] px-2 py-2 text-center text-sm font-medium text-slate-700 dark:text-slate-200">
                {reporte ? labelSemana(reporte.semana_inicio, reporte.semana_fin) : '…'}
              </span>
              <button
                onClick={() => irSemana(1)}
                disabled={loading}
                className="rounded-r-xl px-3 py-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700"
                title="Semana siguiente"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {/* Ir a semana actual */}
            <button
              onClick={() => { setSemana(''); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            >
              Semana actual
            </button>

            {/* Filtro por sede */}
            {sedes.length > 0 && (
              <select
                value={sedeId ?? ''}
                onChange={(e) => setSedeId(e.target.value ? Number(e.target.value) : undefined)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">Todas las sedes</option>
                {sedes.filter((s) => s.tipo === 'empresa').map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            )}
          </div>

          {/* Tarjetas resumen */}
          {reporte && (
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs text-slate-400">Empleados</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-800 dark:text-slate-100">{reporte.empleados.length}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs text-slate-400">Días registrados</p>
                <p className="mt-0.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalDias}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs text-slate-400">Total horas</p>
                <p className="mt-0.5 text-2xl font-bold text-cyan-600 dark:text-cyan-400">{formatMinutos(totalHoras)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs text-slate-400">Promedio diario</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-700 dark:text-slate-300">
                  {reporte.empleados.length > 0 && totalDias > 0
                    ? formatMinutos(Math.round(totalHoras / totalDias))
                    : '—'}
                </p>
              </div>
            </div>
          )}

          {/* Tabla */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
            </div>
          ) : !reporte || reporte.empleados.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No hay empleados con Mi Jornada activo para esta semana.
              </p>
            </div>
          ) : (
            <div ref={printRef} className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th className="sticky left-0 z-10 border border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      Empleado
                    </th>
                    {diasSemana.map((dia) => (
                      <th
                        key={dia.fecha}
                        className={`border border-slate-200 px-2 py-3 text-center text-xs font-bold uppercase tracking-wider dark:border-slate-700 ${
                          dia.es_hoy
                            ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <span className="block">{dia.dia_semana.slice(0, 3)}</span>
                        <span className="block text-[10px] font-normal opacity-70">
                          {new Date(dia.fecha + 'T12:00:00Z').toLocaleDateString('es-CO', {
                            day: '2-digit', month: 'short', timeZone: 'UTC',
                          })}
                        </span>
                      </th>
                    ))}
                    <th className="border border-slate-200 px-2 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Días
                    </th>
                    <th className="border border-slate-200 px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.empleados.map((emp) => (
                    <EmpleadoRow key={emp.empleado_id} emp={emp} />
                  ))}
                  <TotalesRow reporte={reporte} />
                </tbody>
              </table>
            </div>
          )}

          {/* Leyenda */}
          {reporte && reporte.empleados.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400 print:mt-2">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/40" />
                Día completo (entrada + salida)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-amber-100 dark:bg-amber-900/40" />
                Solo entrada (sin salida registrada)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded bg-slate-100 dark:bg-slate-800" />
                Ausente
              </span>
            </div>
          )}

        </div>
      </main>

      {/* Estilos de impresión */}
      <style jsx global>{`
        @media print {
          nav, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          table { font-size: 10px !important; }
          th, td { padding: 4px 6px !important; }
        }
      `}</style>
    </>
  );
}
