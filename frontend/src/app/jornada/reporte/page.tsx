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

// ── Modal detalle de un día ───────────────────────────────────────────────────

function ModalDia({
  emp, dia, onClose,
}: {
  emp: EmpleadoSemanaOut;
  dia: DiaRegistros;
  onClose: () => void;
}) {
  const entradas = dia.registros.filter((r) => r.tipo === 'entrada').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const salidas  = dia.registros.filter((r) => r.tipo === 'salida').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const pares = Math.min(entradas.length, salidas.length);

  const sedesDelDia = [...new Set(dia.registros.filter((r) => r.sede).map((r) => r.sede as string))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              {dia.dia_semana} · {new Date(dia.fecha + 'T12:00:00Z').toLocaleDateString('es-CO', {
                day: '2-digit', month: 'long', timeZone: 'UTC',
              })}
            </p>
            <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
              {emp.nombres} {emp.apellidos}
            </p>
            {sedesDelDia.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {sedesDelDia.map((s) => (
                  <span key={s} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    s === emp.sede
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                  }`}>
                    {s}{s === emp.sede ? ' ★' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Registros */}
        <div className="space-y-2 px-5 py-4 max-h-80 overflow-y-auto">
          {dia.registros.length === 0 ? (
            <p className="text-center text-sm text-slate-400">Sin registros este día</p>
          ) : (
            dia.registros
              .slice()
              .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
              .map((r, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    r.tipo === 'entrada'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {r.tipo === 'entrada' ? '↗' : '↙'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${
                      r.tipo === 'entrada' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {r.tipo === 'entrada' ? 'Ingreso' : 'Salida'}
                    </p>
                    {r.sede && (
                      <p className="truncate text-[10px] text-slate-400">{r.sede}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm tabular-nums font-medium text-slate-700 dark:text-slate-200">
                    {formatHora(r.timestamp)}
                  </span>
                </div>
              ))
          )}
        </div>

        {/* Pares con duración */}
        {pares > 0 && (
          <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Sesiones</p>
            {Array.from({ length: pares }, (_, i) => {
              const minutos = Math.max(0, Math.round(
                (new Date(salidas[i].timestamp).getTime() - new Date(entradas[i].timestamp).getTime()) / 60000
              ));
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatHora(entradas[i].timestamp)} → {formatHora(salidas[i].timestamp)}
                  </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                    {formatMinutos(minutos)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Total */}
        {dia.tiempo_sede && (
          <div className="flex items-center justify-between rounded-b-2xl border-t border-slate-100 bg-slate-50 px-5 py-3 dark:border-slate-800 dark:bg-slate-800/50">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total en sede
            </span>
            <span className="text-base font-extrabold text-cyan-700 dark:text-cyan-400">
              {dia.tiempo_sede}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Celda de día (tabla general) ──────────────────────────────────────────────

function DiaCell({
  dia, sedePrincipal, onSelect,
}: {
  dia: DiaRegistros;
  sedePrincipal: string | null;
  onSelect: () => void;
}) {
  const entradas = dia.registros.filter((r) => r.tipo === 'entrada').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const salidas  = dia.registros.filter((r) => r.tipo === 'salida').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const primerEntrada = entradas[0];
  const ultimaSalida  = salidas[salidas.length - 1];
  const esFuturo = !dia.es_hoy && dia.registros.length === 0 && new Date(dia.fecha + 'T12:00:00Z') > new Date();

  if (esFuturo) {
    return <td className="border border-slate-100 px-2 py-2 text-center dark:border-slate-800" />;
  }

  if (!primerEntrada && !ultimaSalida) {
    return (
      <td className="border border-slate-100 px-2 py-2 text-center dark:border-slate-800">
        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
      </td>
    );
  }

  // Verde: una sola sede (la principal) y un solo ciclo
  // Cyan: múltiples ciclos o sede diferente a la principal
  const multipleCiclos = entradas.length > 1 || salidas.length > 1;
  const sedeDiferente = sedePrincipal
    ? dia.registros.some((r) => r.sede && r.sede !== sedePrincipal)
    : false;
  const esPrincipal = !multipleCiclos && !sedeDiferente;

  if (primerEntrada && ultimaSalida && dia.tiempo_sede) {
    return (
      <td className="border border-slate-100 px-1.5 py-1.5 text-center dark:border-slate-800">
        <button
          onClick={onSelect}
          className={`w-full rounded-lg px-1.5 py-1.5 text-left transition-opacity hover:opacity-80 ${
            esPrincipal
              ? 'bg-emerald-50 dark:bg-emerald-900/20'
              : 'bg-cyan-50 dark:bg-cyan-900/20'
          }`}
        >
          <p className={`text-[11px] font-semibold ${
            esPrincipal ? 'text-emerald-700 dark:text-emerald-400' : 'text-cyan-700 dark:text-cyan-400'
          }`}>
            {dia.tiempo_sede}
          </p>
          <p className={`text-[10px] ${
            esPrincipal ? 'text-emerald-600/70 dark:text-emerald-500' : 'text-cyan-600/70 dark:text-cyan-500'
          }`}>
            {formatHora(primerEntrada.timestamp)} – {formatHora(ultimaSalida.timestamp)}
          </p>
          {multipleCiclos && (
            <p className="text-[9px] font-bold text-cyan-500 dark:text-cyan-500">
              {entradas.length} sesiones
            </p>
          )}
        </button>
      </td>
    );
  }

  // Solo entrada sin salida
  return (
    <td className="border border-slate-100 px-1.5 py-1.5 text-center dark:border-slate-800">
      <button
        onClick={onSelect}
        className="w-full rounded-lg bg-amber-50 px-1.5 py-1.5 text-left hover:opacity-80 dark:bg-amber-900/20"
      >
        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">↗ {formatHora(primerEntrada!.timestamp)}</p>
        <p className="text-[10px] text-amber-500/70 dark:text-amber-500">sin salida</p>
      </button>
    </td>
  );
}

// ── Fila de empleado (tabla general) ─────────────────────────────────────────

function EmpleadoRow({
  emp,
  onSelectDia,
}: {
  emp: EmpleadoSemanaOut;
  onSelectDia: (dia: DiaRegistros) => void;
}) {
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
        <DiaCell
          key={dia.fecha}
          dia={dia}
          sedePrincipal={emp.sede}
          onSelect={() => onSelectDia(dia)}
        />
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

function exportarCSV(reporte: ReporteSemanalOut, empleados?: EmpleadoSemanaOut[]) {
  const lista = empleados ?? reporte.empleados;
  const dias = reporte.empleados[0]?.dias ?? [];
  const cabeceras = [
    'Empleado', 'Cargo', 'Sede',
    ...dias.map((d) => `${d.dia_semana} ${d.fecha.slice(5).replace('-', '/')}`),
    'Días', 'Total horas',
  ];

  const filas = lista.map((emp) => [
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
  a.download = `asistencia_${lista.length === 1 ? `${lista[0].apellidos}_` : ''}${reporte.semana_inicio}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Informe detallado de un empleado ─────────────────────────────────────────

function InformeEmpleado({ emp, semanaLabel }: { emp: EmpleadoSemanaOut; semanaLabel: string }) {
  const promedio = emp.dias_asistidos > 0
    ? Math.round(emp.total_minutos / emp.dias_asistidos)
    : 0;

  return (
    <div className="space-y-4 print:space-y-3">

      {/* Cabecera del empleado */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 print:rounded-none print:border-x-0 print:border-t-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-600 dark:text-cyan-400 print:text-cyan-700">
              Informe de gestión · Jornada semanal
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
          <p className="text-sm text-slate-400 dark:text-slate-500">{semanaLabel}</p>
        </div>

        {/* Stats del empleado */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Días asistidos</p>
            <p className={`mt-0.5 text-2xl font-bold ${
              emp.dias_asistidos >= 5 ? 'text-emerald-600 dark:text-emerald-400'
              : emp.dias_asistidos >= 3 ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'
            }`}>
              {emp.dias_asistidos}
              <span className="ml-1 text-sm font-normal text-slate-400">/ {emp.dias.filter(d => new Date(d.fecha + 'T12:00:00Z') <= new Date()).length}</span>
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Días incompletos</p>
            <p className={`mt-0.5 text-2xl font-bold ${
              emp.dias_incompletos > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300 dark:text-slate-600'
            }`}>
              {emp.dias_incompletos}
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
        </div>
      </div>

      {/* Tarjetas por día */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 print:grid-cols-4 print:gap-2">
        {emp.dias.map((dia) => {
          const ausente = dia.registros.length === 0;
          const esFuturo = ausente && new Date(dia.fecha + 'T12:00:00Z') > new Date();
          const completo = !!dia.tiempo_sede;
          const incompleto = !ausente && !completo;

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
              {/* Cabecera del día */}
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
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  esFuturo ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                  : ausente ? 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400'
                  : completo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {esFuturo ? 'Pendiente' : ausente ? 'Ausente' : completo ? 'Completo' : 'Incompleto'}
                </span>
              </div>

              {/* Lista de registros del día */}
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
                          r.tipo === 'entrada'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}>
                          {r.tipo === 'entrada' ? 'Ingreso' : 'Salida'}
                        </span>
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

                  {/* Tiempo total del día */}
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

export default function ReporteSemanalPage() {
  const router = useRouter();
  const [reporte, setReporte] = useState<ReporteSemanalOut | null>(null);
  const [sedes, setSedes] = useState<SedeJornadaOut[]>([]);
  const [filtroSede, setFiltroSede] = useState<string>(''); // '' | 'home_office' | id numérico
  const [semana, setSemana] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [modalDia, setModalDia] = useState<{ emp: EmpleadoSemanaOut; dia: DiaRegistros } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // sedeId que va a la API: solo cuando es una sede empresa específica
  const sedeIdApi = filtroSede !== '' && filtroSede !== 'home_office'
    ? Number(filtroSede)
    : undefined;

  // Nombres de sedes home_office para filtrar en frontend
  const homeOfficeSedes = new Set(
    sedes.filter((s) => s.tipo === 'home_office').map((s) => s.nombre)
  );

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getSedesJornada().then(setSedes).catch(() => {});
  }, [router]);

  useEffect(() => {
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semana, sedeIdApi]);

  async function cargar() {
    setLoading(true);
    try {
      const data = await getReporteSemanal(semana || undefined, sedeIdApi);
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

  // Filtro por nombre de empleado + home_office (frontend)
  const empleadosFiltrados = (reporte?.empleados ?? []).filter((emp) => {
    if (filtroSede === 'home_office' && (!emp.sede || !homeOfficeSedes.has(emp.sede))) return false;
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (
      `${emp.nombres} ${emp.apellidos}`.toLowerCase().includes(q) ||
      `${emp.apellidos} ${emp.nombres}`.toLowerCase().includes(q)
    );
  });

  // Modo informe: exactamente 1 empleado coincide con la búsqueda
  const modoInforme = busqueda.trim() !== '' && empleadosFiltrados.length === 1;
  const empleadoInforme = modoInforme ? empleadosFiltrados[0] : null;

  const diasSemana = reporte?.empleados[0]?.dias ?? [];
  const totalHoras = empleadosFiltrados.reduce((a, e) => a + e.total_minutos, 0);
  const totalDias = empleadosFiltrados.reduce((a, e) => a + e.dias_asistidos, 0);

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
                {modoInforme
                  ? `Informe · ${empleadoInforme!.nombres} ${empleadoInforme!.apellidos}`
                  : 'Reporte de asistencia semanal'}
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
              {reporte && empleadosFiltrados.length > 0 && (
                <button
                  onClick={() => exportarCSV(reporte, modoInforme ? empleadosFiltrados : undefined)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-slate-950"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  {modoInforme ? 'Exportar informe' : 'Exportar CSV'}
                </button>
              )}
            </div>
          </div>

          {/* Controles */}
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

            <button
              onClick={() => { setSemana(''); }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            >
              Semana actual
            </button>

            {/* Filtro por sede */}
            {sedes.length > 0 && (
              <select
                value={filtroSede}
                onChange={(e) => setFiltroSede(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">Todas las sedes</option>
                {sedes.some((s) => s.tipo === 'home_office') && (
                  <option value="home_office">Casa (Home Office)</option>
                )}
                {sedes.filter((s) => s.tipo === 'empresa' && s.is_active).map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            )}

            {/* Buscador de empleado */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <svg
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar empleado…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-700 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Indicador de modo informe */}
            {modoInforme && (
              <span className="flex items-center gap-1.5 rounded-lg bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                Modo informe
              </span>
            )}
          </div>

          {/* Tarjetas resumen */}
          {reporte && !modoInforme && (
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs text-slate-400">Empleados</p>
                <p className="mt-0.5 text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {empleadosFiltrados.length}
                  {busqueda && reporte.empleados.length !== empleadosFiltrados.length && (
                    <span className="ml-1 text-sm font-normal text-slate-400">/ {reporte.empleados.length}</span>
                  )}
                </p>
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
                  {totalDias > 0 ? formatMinutos(Math.round(totalHoras / totalDias)) : '—'}
                </p>
              </div>
            </div>
          )}

          {/* Contenido principal */}
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
          ) : empleadosFiltrados.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white py-12 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ningún empleado coincide con <strong>"{busqueda}"</strong>.
              </p>
              <button onClick={() => setBusqueda('')} className="mt-2 text-xs text-cyan-600 hover:underline dark:text-cyan-400">
                Limpiar búsqueda
              </button>
            </div>
          ) : modoInforme ? (
            /* ── Modo informe (un solo empleado) ── */
            <div ref={printRef}>
              <InformeEmpleado emp={empleadoInforme!} semanaLabel={labelSemana(reporte.semana_inicio, reporte.semana_fin)} />
            </div>
          ) : (
            /* ── Tabla general (todos / filtrados) ── */
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
                  {empleadosFiltrados.map((emp) => (
                    <EmpleadoRow
                      key={emp.empleado_id}
                      emp={emp}
                      onSelectDia={(dia) => setModalDia({ emp, dia })}
                    />
                  ))}
                  <TotalesRow reporte={{ ...reporte, empleados: empleadosFiltrados }} />
                </tbody>
              </table>
            </div>
          )}

          {/* Leyenda */}
          {reporte && empleadosFiltrados.length > 0 && !modoInforme && (
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

      {/* Modal detalle día */}
      {modalDia && (
        <ModalDia
          emp={modalDia.emp}
          dia={modalDia.dia}
          onClose={() => setModalDia(null)}
        />
      )}

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
