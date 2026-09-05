"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { useAuth } from '@/components/auth-provider';
import {
  EmpleadoMesOut,
  RECARGO_CATEGORIAS,
  ReporteMensualOut,
  ReporteMensualParams,
  SedeJornadaOut,
  exportarReporteMensualConsolidado,
  exportarReporteMensualDetalle,
  exportarReporteMensualResumen,
  getReporteMensual,
  getSedesJornada,
  isAuthenticated,
  marcarPagoAnticipado,
  quitarPagoAnticipado,
} from '@/lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const JORNADA_SEMANAL_MIN = 42 * 60; // Tope de jornada ordinaria semanal (Ley 2101 de 2021, vigente desde jul-2026)

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

function hoyISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

function diaSemanaISO(iso: string): number {
  // 0 = lunes ... 6 = domingo
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function lunesDeSemanaActual(): string {
  const hoy = hoyISO();
  return sumarDias(hoy, -diaSemanaISO(hoy));
}

function labelRango(desde: string, hasta: string): string {
  const fmt = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
  return `${fmt(desde)} – ${fmt(hasta)}`;
}

function extraTotalMin(recargos: Record<string, number>): number {
  return (
    (recargos.extra_diurna ?? 0) +
    (recargos.extra_nocturna ?? 0) +
    (recargos.extra_dominical_diurno ?? 0) +
    (recargos.extra_dominical_nocturno ?? 0)
  );
}

// ── Detalle de un empleado (grilla de tarjetas por día) ──────────────────────

function DetalleEmpleadoMes({
  emp, params, mesLabel, onVolver, onCambio,
}: {
  emp: EmpleadoMesOut;
  params: ReporteMensualParams;
  mesLabel: string;
  onVolver: () => void;
  onCambio: () => void;
}) {
  const { hasPermission } = useAuth();
  const puedeAdmin = hasPermission('jornada:admin');
  const [exportando, setExportando] = useState(false);
  const [guardandoPago, setGuardandoPago] = useState<string | null>(null); // fecha en proceso
  const promedio = emp.dias_asistidos > 0 ? Math.round(emp.total_minutos / emp.dias_asistidos) : 0;
  const totalNovedades = emp.novedades_manuales + emp.novedades_ubicacion;
  const extraTotal = extraTotalMin(emp.recargos_totales);

  async function togglePagoAnticipado(fecha: string, marcado: boolean) {
    setGuardandoPago(fecha);
    try {
      if (marcado) {
        await quitarPagoAnticipado(emp.empleado_id, fecha);
      } else {
        await marcarPagoAnticipado(emp.empleado_id, fecha);
      }
      onCambio();
    } finally {
      setGuardandoPago(null);
    }
  }
  const alertaLegal = emp.dias_excedidos > 0 || emp.periodos_excedidos > 0;

  async function exportar() {
    setExportando(true);
    try {
      await exportarReporteMensualDetalle(emp.empleado_id, params, `asistencia_${emp.apellidos}_${emp.nombres}.xlsx`);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex items-center justify-between print:hidden">
        <button type="button" onClick={onVolver}
          className="text-sm text-cyan-600 hover:underline dark:text-cyan-400">
          ← Volver al resumen
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={exportar} disabled={exportando}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            {exportando ? 'Generando…' : 'Exportar Excel'}
          </button>
          <button type="button" onClick={() => window.print()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
            Imprimir
          </button>
        </div>
      </div>

      {alertaLegal && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400 print:border-red-300">
          ⚠ Supera los límites de horas extra de la Ley 2466: {emp.dias_excedidos} día(s) con más de 2h extra
          {emp.periodos_excedidos > 0 && ` y ${emp.periodos_excedidos} periodo(s) con más de 12h extra`}.
          Riesgo de sanción de MinTrabajo por incumplimiento de topes de jornada.
        </div>
      )}

      {/* Cabecera del empleado */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 print:rounded-none print:border-x-0 print:border-t-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-600 dark:text-cyan-400 print:text-cyan-700">
              Informe de gestión · Jornada
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
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <p className="text-xs text-slate-400">Pago anticipado</p>
            <p className={`mt-0.5 text-2xl font-bold ${emp.dias_pago_anticipado > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600'}`}>
              {emp.dias_pago_anticipado}
            </p>
          </div>
        </div>
      </div>

      {/* Recargos legales del mes */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900 print:rounded-none print:border-x-0 print:shadow-none">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400">
          Recargos (Ley 2466)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-400 dark:border-slate-700">
                <th className="py-1.5 pr-3 font-semibold">Tipo de hora</th>
                <th className="py-1.5 pr-3 font-semibold">Franja</th>
                <th className="py-1.5 text-right font-semibold">Horas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {RECARGO_CATEGORIAS.map((cat) => {
                const min = emp.recargos_totales[cat.clave] ?? 0;
                if (min === 0) return null;
                return (
                  <tr key={cat.clave}>
                    <td className="py-1.5 pr-3 font-medium text-slate-700 dark:text-slate-200">{cat.label}</td>
                    <td className="py-1.5 pr-3 text-xs text-slate-400">{cat.franja}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums text-cyan-700 dark:text-cyan-400">
                      {formatMinutos(min)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-slate-200 dark:border-slate-700">
                <td className="py-1.5 pr-3 font-bold text-slate-800 dark:text-slate-100" colSpan={2}>Total horas extra</td>
                <td className={`py-1.5 text-right font-bold tabular-nums ${extraTotal > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}>
                  {formatMinutos(extraTotal)}
                </td>
              </tr>
            </tbody>
          </table>
          {emp.recargos_totales && Object.values(emp.recargos_totales).every((v) => v === 0) && (
            <p className="py-2 text-sm text-slate-400">Sin recargos este mes.</p>
          )}
        </div>

        {emp.periodos_extra.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {emp.periodos_extra.some((p) => p.tipo !== 'semana') ? 'Ciclos de 2 semanas' : 'Semanas del mes'}
            </p>
            <div className="flex flex-wrap gap-2">
              {emp.periodos_extra.map((p) => {
                if (p.tipo === 'suelto') {
                  return (
                    <div key={p.inicio}
                      className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
                      title={`${p.inicio} → ${p.fin} · fuera de ciclo, solo informativo`}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {p.inicio.slice(5)}–{p.fin.slice(5)} <span className="italic">(suelto)</span>
                      </p>
                      <p className="mt-0.5">
                        <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                          {formatMinutos(p.trabajado_min)}
                        </span>
                        <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">trabajadas</span>
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                        fuera de ciclo — informativo
                      </p>
                    </div>
                  );
                }

                const restanteMin = Math.max(0, JORNADA_SEMANAL_MIN * (p.tipo === 'ciclo_2sem' ? 2 : 1) - p.trabajado_min);
                return (
                  <div key={p.inicio}
                    className={`rounded-xl border px-3 py-1.5 ${
                      p.excede
                        ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-900/10'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
                    }`}
                    title={p.extra_min > 0
                      ? `${p.inicio} → ${p.fin} · límite de extra ${formatMinutos(p.limite_min)}`
                      : `${p.inicio} → ${p.fin} · jornada ordinaria de referencia ${formatMinutos(JORNADA_SEMANAL_MIN * (p.tipo === 'ciclo_2sem' ? 2 : 1))}`}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {p.inicio.slice(5)}–{p.fin.slice(5)}
                    </p>
                    <p className="mt-0.5">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        {formatMinutos(p.trabajado_min)}
                      </span>
                      <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">trabajadas</span>
                    </p>
                    {p.tipo !== 'ciclo_2sem' && (
                      p.extra_min > 0 ? (
                        <p className="mt-0.5 text-xs font-bold text-red-600 dark:text-red-400">
                          +{formatMinutos(p.extra_min)} extra {p.excede ? '⚠' : ''}
                        </p>
                      ) : restanteMin > 0 ? (
                        <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                          faltan {formatMinutos(restanteMin)} p/ 42h
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                          ✓ 42h completas
                        </p>
                      )
                    )}
                    {p.semanas.length === 2 && (
                      <div className="mt-1.5 space-y-0.5 border-t border-slate-200 pt-1.5 dark:border-slate-700">
                        {p.semanas.map((s) => (
                          <p key={s.inicio} className="flex items-center justify-between gap-3 text-[10px]">
                            <span className="text-slate-400 dark:text-slate-500">
                              {s.inicio.slice(5)}–{s.fin.slice(5)}
                            </span>
                            <span className={`font-semibold ${
                              s.diferencia_min >= 0
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-blue-500 dark:text-blue-400'
                            }`}>
                              {s.diferencia_min >= 0
                                ? `+${formatMinutos(s.diferencia_min)} extra`
                                : `faltan ${formatMinutos(Math.abs(s.diferencia_min))}`}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
                dia.pago_anticipado
                  ? 'border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-900/10'
                  : esFuturo
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
                  {dia.excede_diario && (
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" title={`Excede 2h extra/día (${formatMinutos(dia.extra_min)})`} />
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    dia.pago_anticipado ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : esFuturo ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                    : ausente ? 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400'
                    : completo ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}>
                    {dia.pago_anticipado ? 'Pago anticipado' : esFuturo ? 'Pendiente' : ausente ? 'Ausente' : completo ? 'Completo' : 'Incompleto'}
                  </span>
                  {puedeAdmin && !esFuturo && (
                    <button type="button"
                      onClick={() => togglePagoAnticipado(dia.fecha, dia.pago_anticipado)}
                      disabled={guardandoPago === dia.fecha}
                      title={dia.pago_anticipado ? 'Quitar marca de pago anticipado' : 'Marcar como pago anticipado (excluir de horas/recargos/extras)'}
                      className="rounded p-0.5 text-slate-300 hover:bg-slate-200 hover:text-blue-600 disabled:opacity-50 dark:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-blue-400">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {ausente ? (
                <p className="text-xs text-slate-300 dark:text-slate-600">
                  {dia.pago_anticipado ? 'Turno pagado por adelantado' : esFuturo ? 'Aún no ha ocurrido' : 'Sin registros este día'}
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

                  {dia.pago_anticipado && (
                    <p className="mt-1 text-[10px] italic text-blue-500 dark:text-blue-400">
                      Excluido de horas, recargos y extras (pago anticipado)
                    </p>
                  )}

                  {dia.tiempo_sede && (
                    <div className="mt-2 border-t border-emerald-200/70 pt-2 dark:border-emerald-900/30">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-600/70 dark:text-emerald-500">
                          Tiempo en sede
                          {dia.almuerzo_min > 0 && (
                            <span
                              className="text-xs leading-none"
                              title={`Almuerzo descontado: ${dia.almuerzo_min} min${dia.almuerzo_manual ? ' (fijado a mano)' : ''}`}
                            >
                              🍴
                            </span>
                          )}
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
  const [modo, setModo] = useState<'mes' | 'rango'>('mes');
  const [mes, setMes] = useState(mesActual());
  const [desde, setDesde] = useState(lunesDeSemanaActual());
  const [hasta, setHasta] = useState(() => sumarDias(lunesDeSemanaActual(), 6));
  const [filtroSede, setFiltroSede] = useState('');
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [empleadoDetalle, setEmpleadoDetalle] = useState<EmpleadoMesOut | null>(null);
  const [exportando, setExportando] = useState<'resumen' | 'consolidado' | null>(null);
  const sedeId = filtroSede ? Number(filtroSede) : undefined;
  const params: ReporteMensualParams = modo === 'rango'
    ? { desde, hasta, sedeId }
    : { mes, sedeId };
  const periodoLabel = modo === 'rango' ? labelRango(desde, hasta) : labelMes(mes);
  const rangoInvalido = modo === 'rango' && (!desde || !hasta || hasta < desde);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getSedesJornada().then(setSedes).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    if (rangoInvalido) return;
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, mes, desde, hasta, filtroSede]);

  async function cargar() {
    setLoading(true);
    try {
      const data = await getReporteMensual(params);
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
  const empleadosConExceso = empleadosFiltrados.filter((e) => e.dias_excedidos > 0 || e.periodos_excedidos > 0).length;

  async function exportarResumen() {
    setExportando('resumen');
    try {
      await exportarReporteMensualResumen(params);
    } finally {
      setExportando(null);
    }
  }

  async function exportarConsolidado() {
    setExportando('consolidado');
    try {
      await exportarReporteMensualConsolidado(params);
    } finally {
      setExportando(null);
    }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-6 print:px-0 print:py-2">

        {empleadoDetalle ? (
          <DetalleEmpleadoMes
            emp={empleadoDetalle}
            params={params}
            mesLabel={periodoLabel}
            onVolver={() => setEmpleadoDetalle(null)}
            onCambio={cargar}
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
                  Reporte de asistencia
                </h1>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{periodoLabel}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <button type="button" onClick={() => window.print()}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                  Imprimir
                </button>
                <button type="button" onClick={exportarResumen} disabled={!reporte || exportando !== null}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                  {exportando === 'resumen' ? 'Generando…' : 'Exportar Excel (resumen)'}
                </button>
                <button type="button" onClick={exportarConsolidado} disabled={!reporte || exportando !== null}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                  {exportando === 'consolidado' ? 'Generando…' : 'Exportar Excel (todos, detalle diario)'}
                </button>
              </div>
            </div>

            {/* Modo de periodo */}
            <div className="mb-3 flex flex-wrap items-center gap-2 print:hidden">
              <div className="flex overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700">
                <button type="button" onClick={() => setModo('mes')}
                  className={`px-3 py-1.5 text-xs font-semibold ${modo === 'mes' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                  Mes completo
                </button>
                <button type="button" onClick={() => setModo('rango')}
                  className={`px-3 py-1.5 text-xs font-semibold ${modo === 'rango' ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                  Periodo personalizado
                </button>
              </div>
              {modo === 'rango' && (
                <>
                  <button type="button" onClick={() => { setDesde(lunesDeSemanaActual()); setHasta(sumarDias(lunesDeSemanaActual(), 6)); }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                    Semana actual
                  </button>
                  <button type="button" onClick={() => { setDesde(sumarDias(hoyISO(), -14)); setHasta(hoyISO()); }}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                    Últimos 15 días
                  </button>
                </>
              )}
            </div>

            {/* Filtros */}
            <div className="mb-5 flex flex-wrap items-end gap-3 print:hidden">
              {modo === 'mes' ? (
                <>
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
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex flex-col text-xs text-slate-500 dark:text-slate-400">
                    Desde
                    <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                      className="mt-0.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                  </label>
                  <label className="flex flex-col text-xs text-slate-500 dark:text-slate-400">
                    Hasta
                    <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                      className="mt-0.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
                  </label>
                  {rangoInvalido && (
                    <span className="text-xs text-red-500">La fecha &quot;hasta&quot; debe ser igual o posterior a &quot;desde&quot;.</span>
                  )}
                </div>
              )}

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
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5 print:grid-cols-5 print:gap-2">
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
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs text-slate-400">Con exceso de extras (Ley 2466)</p>
                  <p className={`mt-0.5 text-xl font-bold ${empleadosConExceso > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-300 dark:text-slate-600'}`}>
                    {empleadosConExceso}
                  </p>
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
                  {busqueda ? 'Sin resultados para esa búsqueda.' : 'No hay empleados con Nuestro Horario activo para este periodo.'}
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
                        <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Extra</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Novedades</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Exceso Ley 2466</th>
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
                            <td className="px-3 py-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                              {extraTotalMin(e.recargos_totales) > 0 ? formatMinutos(extraTotalMin(e.recargos_totales)) : '—'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {novedades > 0 ? (
                                <span className="inline-block rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                  {novedades}
                                </span>
                              ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {(e.dias_excedidos > 0 || e.periodos_excedidos > 0) ? (
                                <span className="inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400" title="Supera 2h extra/día o 12h extra/semana">
                                  ⚠ {e.dias_excedidos}d
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
