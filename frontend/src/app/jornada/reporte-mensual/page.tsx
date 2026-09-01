"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import {
  EmpleadoMesOut,
  ReporteMensualOut,
  SedeJornadaOut,
  getReporteMensual,
  getSedesJornada,
  isAuthenticated,
} from '@/lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  });
}

function formatMinutos(min: number): string {
  if (min === 0) return '0h';
  return `${Math.floor(min / 60)}h ${(min % 60).toString().padStart(2, '0')}m`;
}

function mesActual(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7);
}

function addMonths(mesStr: string, n: number): string {
  const [y, m] = mesStr.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function labelMes(mesStr: string): string {
  const [y, m] = mesStr.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-CO', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function csvDownload(filename: string, cabeceras: string[], filas: (string | number)[][]) {
  const contenido = [cabeceras, ...filas]
    .map((fila) => fila.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + contenido], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarResumenCSV(reporte: ReporteMensualOut) {
  const cabeceras = [
    'Empleado', 'Cargo', 'Sede',
    'Días asistidos', 'Días incompletos', 'Días ausentes',
    'Total horas', 'Novedades manuales', 'Novedades ubicación no verificada',
  ];
  const filas = reporte.empleados.map((e) => [
    `${e.apellidos} ${e.nombres}`,
    e.cargo ?? '',
    e.sede ?? '',
    e.dias_asistidos,
    e.dias_incompletos,
    e.dias_ausentes,
    e.total_minutos > 0 ? formatMinutos(e.total_minutos) : '0',
    e.novedades_manuales,
    e.novedades_ubicacion,
  ]);
  csvDownload(`asistencia_mensual_${reporte.mes}.csv`, cabeceras, filas);
}

function exportarDetalleCSV(emp: EmpleadoMesOut, mes: string) {
  const cabeceras = ['Fecha', 'Día', 'Entrada', 'Salida', 'Tiempo neto', 'Novedad'];
  const filas = emp.dias.map((dia) => {
    const entrada = dia.registros.find((r) => r.tipo === 'entrada');
    const salida = dia.registros.find((r) => r.tipo === 'salida');
    const novedades: string[] = [];
    if (dia.registros.some((r) => r.is_manual)) novedades.push('Manual');
    if (dia.registros.some((r) => r.ubicacion_no_verificada)) novedades.push('Ubicación no verificada');
    return [
      dia.fecha,
      dia.dia_semana,
      entrada ? formatHora(entrada.timestamp) : '',
      salida ? formatHora(salida.timestamp) : '',
      dia.tiempo_sede ?? '',
      novedades.join(' · '),
    ];
  });
  csvDownload(`asistencia_${emp.apellidos}_${emp.nombres}_${mes}.csv`, cabeceras, filas);
}

// ── Detalle de un empleado (grilla de tarjetas por día) ──────────────────────

function DetalleEmpleadoMes({
  emp, mesLabel, onVolver,
}: {
  emp: EmpleadoMesOut;
  mesLabel: string;
  onVolver: () => void;
}) {
  const promedio = emp.dias_asistidos > 0 ? Math.round(emp.total_minutos / emp.dias_asistidos) : 0;
  const totalNovedades = emp.novedades_manuales + emp.novedades_ubicacion;

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex items-center justify-between print:hidden">
        <button type="button" onClick={onVolver}
          className="text-sm text-cyan-600 hover:underline dark:text-cyan-400">
          ← Volver al resumen
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={() => exportarDetalleCSV(emp, mesLabel)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            Exportar CSV
          </button>
          <button type="button" onClick={() => window.print()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            Imprimir
          </button>
        </div>
      </div>

      {/* Cabecera del empleado */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 print:rounded-none print:border-x-0 print:border-t-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-600 dark:text-cyan-400 print:text-cyan-700">
              Informe de gestión · Jornada mensual
            </p>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
              {emp.nombres} {emp.apellidos}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {emp.cargo && (
                <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {emp.cargo}
                </span>
              )}
              {emp.sede && (
                <span className="rounded-full bg-cyan-50 px-3 py-0.5 text-xs font-medium text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                  {emp.sede}
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-400 dark:text-slate-500">{mesLabel}</p>
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Días asistidos</p>
            <p className="mt-0.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{emp.dias_asistidos}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Incompletos</p>
            <p className={`mt-0.5 text-2xl font-bold ${emp.dias_incompletos > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>
              {emp.dias_incompletos}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Ausentes</p>
            <p className={`mt-0.5 text-2xl font-bold ${emp.dias_ausentes > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-300 dark:text-slate-600'}`}>
              {emp.dias_ausentes}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Total horas</p>
            <p className="mt-0.5 text-2xl font-bold text-cyan-600 dark:text-cyan-400">
              {emp.total_minutos > 0 ? formatMinutos(emp.total_minutos) : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Promedio / día</p>
            <p className="mt-0.5 text-2xl font-bold text-slate-700 dark:text-slate-300">
              {promedio > 0 ? formatMinutos(promedio) : '—'}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Novedades</p>
            <p className={`mt-0.5 text-2xl font-bold ${totalNovedades > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-slate-300 dark:text-slate-600'}`}>
              {totalNovedades}
            </p>
          </div>
        </div>
      </div>

      {/* Tarjetas por día */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-4 print:gap-2">
        {emp.dias.map((dia) => {
          const ausente = dia.registros.length === 0;
          const esFuturo = ausente && new Date(dia.fecha + 'T12:00:00Z') > new Date();
          const completo = !!dia.tiempo_sede;
          const incompleto = !ausente && !completo;
          const tieneNovedad = dia.registros.some((r) => r.is_manual || r.ubicacion_no_verificada);

          return (
            <div
              key={dia.fecha}
              className={`rounded-xl border p-4 transition-all print:rounded-lg print:p-3 ${
                esFuturo
                  ? 'border-dashed border-slate-200 bg-white opacity-50 dark:border-slate-700 dark:bg-slate-900'
                  : ausente
                  ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                  : completo
                  ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10'
                  : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10'
              } ${dia.es_hoy ? 'ring-2 ring-cyan-400/40' : ''}`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {dia.dia_semana}
                  </p>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    {new Date(dia.fecha + 'T12:00:00Z').toLocaleDateString('es-CO', {
                      day: '2-digit', month: 'short', timeZone: 'UTC',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {tieneNovedad && (
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500" title="Con novedad" />
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    esFuturo ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    : ausente ? 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400'
                    : completo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {esFuturo ? 'Pendiente' : ausente ? 'Ausente' : completo ? 'Completo' : 'Incompleto'}
                  </span>
                </div>
              </div>

              {ausente ? (
                <p className="text-xs text-slate-300 dark:text-slate-600">
                  {esFuturo ? 'Aún no ha ocurrido' : 'Sin registros este día'}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {dia.registros.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                        r.tipo === 'entrada' ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-semibold ${
                          r.tipo === 'entrada' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {r.tipo === 'entrada' ? 'Ingreso' : 'Salida'}
                        </span>
                        {(r.is_manual || r.ubicacion_no_verificada) && (
                          <span className={`ml-1.5 text-[9px] font-semibold uppercase ${
                            r.ubicacion_no_verificada ? 'text-amber-500' : 'text-violet-500'
                          }`}>
                            {r.ubicacion_no_verificada ? '⚠ sin ubicar' : '✎ manual'}
                          </span>
                        )}
                        {r.sede && (
                          <p className="truncate text-[10px] leading-tight text-slate-400 dark:text-slate-500">
                            {r.sede}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs tabular-nums font-medium text-slate-700 dark:text-slate-300">
                        {formatHora(r.timestamp)}
                      </span>
                    </div>
                  ))}

                  {dia.tiempo_sede && (
                    <div className="mt-2 border-t border-emerald-200/70 pt-2 dark:border-emerald-900/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-emerald-600/70 dark:text-emerald-500">
                          Tiempo en sede
                        </span>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          {dia.tiempo_sede}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ReporteMensualPage() {
  const router = useRouter();
  const [reporte, setReporte] = useState<ReporteMensualOut | null>(null);
  const [sedes, setSedes] = useState<SedeJornadaOut[]>([]);
  const [mes, setMes] = useState(mesActual());
  const [filtroSede, setFiltroSede] = useState('');
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [empleadoDetalle, setEmpleadoDetalle] = useState<EmpleadoMesOut | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getSedesJornada().then(setSedes).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, filtroSede]);

  async function cargar() {
    setLoading(true);
    try {
      const sedeId = filtroSede ? Number(filtroSede) : undefined;
      const data = await getReporteMensual(mes, sedeId);
      setReporte(data);
      setEmpleadoDetalle((prev) => {
        if (!prev) return null;
        return data.empleados.find((e) => e.empleado_id === prev.empleado_id) ?? null;
      });
    } catch {
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }

  const empleadosFiltrados = (reporte?.empleados ?? []).filter((e) => {
    if (!busqueda) return true;
    const q = busqueda.toLowerCase();
    const nombre = `${e.nombres} ${e.apellidos}`.toLowerCase();
    return nombre.includes(q) || (e.cargo ?? '').toLowerCase().includes(q);
  });

  const totalHoras = empleadosFiltrados.reduce((a, e) => a + e.total_minutos, 0);
  const totalAsistidos = empleadosFiltrados.reduce((a, e) => a + e.dias_asistidos, 0);
  const totalAusentes = empleadosFiltrados.reduce((a, e) => a + e.dias_ausentes, 0);
  const totalNovedades = empleadosFiltrados.reduce((a, e) => a + e.novedades_manuales + e.novedades_ubicacion, 0);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6 print:px-0 print:py-2">

        {empleadoDetalle ? (
          <DetalleEmpleadoMes
            emp={empleadoDetalle}
            mesLabel={labelMes(mes)}
            onVolver={() => setEmpleadoDetalle(null)}
          />
        ) : (
          <>
            {/* Header */}
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 print:mb-3">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300 print:text-cyan-700">
                  Nuestro Horario
                </p>
                <h1 className="mt-0.5 text-2xl font-bold text-slate-900 dark:text-slate-50">
                  Reporte de asistencia mensual
                </h1>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{labelMes(mes)}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <button type="button" onClick={() => window.print()}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                  Imprimir
                </button>
                <button type="button" onClick={() => reporte && exportarResumenCSV(reporte)} disabled={!reporte}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                  Exportar CSV
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="mb-5 flex flex-wrap items-end gap-3 print:hidden">
              <div className="flex items-center overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700">
                <button type="button" onClick={() => setMes((m) => addMonths(m, -1))}
                  className="px-3 py-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" title="Mes anterior">
                  ←
                </button>
                <span className="border-x border-slate-300 px-4 py-2 text-sm font-medium capitalize text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  {labelMes(mes)}
                </span>
                <button type="button" onClick={() => setMes((m) => addMonths(m, 1))}
                  className="px-3 py-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" title="Mes siguiente">
                  →
                </button>
              </div>
              <button type="button" onClick={() => setMes(mesActual())}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                Mes actual
              </button>

              <select value={filtroSede} onChange={(e) => setFiltroSede(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <option value="">Todas las sedes</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>{s.tipo === 'home_office' ? `🏠 ${s.nombre}` : s.nombre}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Buscar empleado…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="min-w-[200px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>

            {/* Totales */}
            {reporte && (
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4 print:gap-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs text-slate-400">Empleados</p>
                  <p className="mt-0.5 text-xl font-bold text-slate-800 dark:text-slate-100">{empleadosFiltrados.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs text-slate-400">Días asistidos (total)</p>
                  <p className="mt-0.5 text-xl font-bold text-emerald-600 dark:text-emerald-400">{totalAsistidos}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs text-slate-400">Ausencias (total)</p>
                  <p className="mt-0.5 text-xl font-bold text-red-600 dark:text-red-400">{totalAusentes}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs text-slate-400">Total horas</p>
                  <p className="mt-0.5 text-xl font-bold text-cyan-600 dark:text-cyan-400">{formatMinutos(totalHoras)}</p>
                </div>
              </div>
            )}

            {/* Tabla resumen */}
            {loading ? (
              <div className="flex justify-center py-16">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
              </div>
            ) : !reporte || empleadosFiltrados.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
                <p className="text-slate-500 dark:text-slate-400">
                  {busqueda ? 'Sin resultados para esa búsqueda.' : 'No hay empleados con Nuestro Horario activo para este mes.'}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-950">
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Empleado</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Asistidos</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Incompletos</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ausentes</th>
                        <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total horas</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Novedades</th>
                        <th className="px-4 py-3 print:hidden" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {empleadosFiltrados.map((e) => {
                        const novedades = e.novedades_manuales + e.novedades_ubicacion;
                        return (
                          <tr key={e.empleado_id}
                            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            onClick={() => setEmpleadoDetalle(e)}>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">{e.nombres} {e.apellidos}</p>
                              {(e.cargo || e.sede) && (
                                <p className="text-xs text-slate-400">{[e.cargo, e.sede].filter(Boolean).join(' · ')}</p>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                {e.dias_asistidos}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              {e.dias_incompletos > 0 ? (
                                <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  {e.dias_incompletos}
                                </span>
                              ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {e.dias_ausentes > 0 ? (
                                <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  {e.dias_ausentes}
                                </span>
                              ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                            </td>
                            <td className="px-3 py-3 text-right font-semibold tabular-nums text-cyan-700 dark:text-cyan-400">
                              {e.total_minutos > 0 ? formatMinutos(e.total_minutos) : '—'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {novedades > 0 ? (
                                <span className="inline-block rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                  {novedades}
                                </span>
                              ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right print:hidden">
                              <span className="text-xs text-cyan-600 hover:underline dark:text-cyan-400">Ver detalle →</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
