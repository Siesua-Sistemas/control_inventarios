"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  AsistenciaResponse,
  EmpleadoAsistenciaOut,
  EmpleadoMesOut,
  RegistroJornadaOut,
  ReporteMensualOut,
  SedeJornadaOut,
  getAsistencia,
  getRegistrosEmpleado,
  getReporteMensual,
  getSedesJornada,
  isAuthenticated,
} from '@/lib/api';
import { NavBar } from '@/components/nav-bar';
import { useAuth } from '@/components/auth-provider';
import { AuditoriaModal } from '@/components/auditoria-modal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoy(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD
}

function mesActual(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7);
}

function labelMesActual(): string {
  return new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
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

function formatMinutos(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const DIAS_SEMANA_CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function diasCompletosDelMes(inicio: string, fin: string): string[] {
  const dias: string[] = [];
  let cursor = new Date(inicio + 'T00:00:00Z');
  const fechaFin = new Date(fin + 'T00:00:00Z');
  while (cursor <= fechaFin) {
    dias.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return dias;
}

// 0 = Lunes ... 6 = Domingo
function offsetSemana(fecha: string): number {
  return (new Date(fecha + 'T12:00:00Z').getUTCDay() + 6) % 7;
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

const ESTADO_CFG = {
  presente: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    label: 'En sede',
  },
  completo: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    label: 'Salió',
  },
  ausente: {
    dot: 'bg-red-400',
    badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    label: 'Ausente',
  },
} as const;

function EstadoBadge({ estado }: { estado: 'presente' | 'completo' | 'ausente' }) {
  const cfg = ESTADO_CFG[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function SummaryCard({
  label, value, sub, color,
}: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900 ${color}`}>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-4xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// ── Modal detalle empleado (auditoría) ───────────────────────────────────────

function DetalleModal({
  emp,
  fecha,
  onClose,
}: {
  emp: EmpleadoAsistenciaOut;
  fecha: string;
  onClose: () => void;
}) {
  const [registros, setRegistros] = useState<RegistroJornadaOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRegistrosEmpleado(emp.empleado_id, fecha)
      .then(setRegistros)
      .finally(() => setLoading(false));
  }, [emp.empleado_id, fecha]);

  return (
    <AuditoriaModal
      nombres={emp.nombres}
      apellidos={emp.apellidos}
      cargo={emp.cargo}
      sede={emp.sede}
      estado={emp.estado}
      tiempoSedeLabel={emp.total_minutos !== null ? formatMinutos(emp.total_minutos) : null}
      registros={registros}
      loading={loading}
      onClose={onClose}
    />
  );
}

// ── Tarjeta de sede ───────────────────────────────────────────────────────────

type EstadoSede = 'abierta' | 'cerrada' | 'sin_actividad';

const ESTADO_SEDE_CFG: Record<EstadoSede, { badge: string; label: string; border: string }> = {
  abierta: {
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    label: 'Abierta',
    border: 'border-emerald-200 dark:border-emerald-900/40',
  },
  cerrada: {
    badge: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    label: 'Cerrada',
    border: 'border-slate-200 dark:border-slate-800',
  },
  sin_actividad: {
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    label: 'Sin actividad',
    border: 'border-amber-200 dark:border-amber-900/40',
  },
};

function SedeCard({
  nombre, esHomeOffice, empleados, onSelect, onOcultar,
}: {
  nombre: string;
  esHomeOffice: boolean;
  empleados: EmpleadoAsistenciaOut[];
  onSelect: () => void;
  onOcultar: () => void;
}) {
  const total = empleados.length;
  const presentes = empleados.filter((e) => e.estado === 'presente').length;
  const completos = empleados.filter((e) => e.estado === 'completo').length;
  const ausentes = empleados.filter((e) => e.estado === 'ausente').length;

  const entradas = empleados.map((e) => e.entrada?.timestamp).filter((t): t is string => !!t);
  const salidas = empleados.map((e) => e.salida?.timestamp).filter((t): t is string => !!t);
  const apertura = entradas.length ? entradas.reduce((a, b) => (a < b ? a : b)) : null;
  const nadiePresente = presentes === 0;
  const cierre = nadiePresente && completos > 0 && salidas.length ? salidas.reduce((a, b) => (a > b ? a : b)) : null;

  const estadoSede: EstadoSede = presentes > 0 ? 'abierta' : cierre ? 'cerrada' : 'sin_actividad';
  const cfg = ESTADO_SEDE_CFG[estadoSede];

  const tiempoAbiertoMin = apertura
    ? Math.max(0, Math.round(((cierre ? new Date(cierre) : new Date()).getTime() - new Date(apertura).getTime()) / 60000))
    : null;

  return (
    <div className={`relative rounded-2xl border bg-white shadow-sm dark:bg-slate-900 ${cfg.border}`}>
      <button type="button"
        onClick={(e) => { e.stopPropagation(); onOcultar(); }}
        title="Ocultar esta sede del dashboard"
        aria-label="Ocultar esta sede"
        className="absolute right-2 top-2 z-10 rounded-full p-1 text-slate-300 hover:bg-slate-100 hover:text-red-500 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-red-400">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <button type="button" onClick={onSelect}
        className="w-full p-5 text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {esHomeOffice && '🏠 '}{nombre}
          </p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{presentes}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">En sede</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{completos}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Completó</p>
          </div>
          <div>
            <p className={`text-2xl font-bold ${ausentes > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-300 dark:text-slate-600'}`}>{ausentes}</p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Ausente</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center dark:border-slate-800">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Apertura</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
              {apertura ? formatHora(apertura) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Cierre</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
              {cierre ? formatHora(cierre) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Tiempo abierta</p>
            <p className="mt-1 font-mono text-sm font-semibold text-cyan-700 dark:text-cyan-400">
              {tiempoAbiertoMin != null ? formatMinutos(tiempoAbiertoMin) : '—'}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-slate-400">{total} colaborador{total !== 1 ? 'es' : ''} asignado{total !== 1 ? 's' : ''}</p>
      </button>
    </div>
  );
}

// ── Modal de detalle por sede (drill-down) ───────────────────────────────────

function SedeDetalleModal({
  nombre, empleados, onClose, onSelectEmpleado,
}: {
  nombre: string;
  empleados: EmpleadoAsistenciaOut[];
  onClose: () => void;
  onSelectEmpleado: (emp: EmpleadoAsistenciaOut) => void;
}) {
  const ordenEstado = { ausente: 0, presente: 1, completo: 2 };
  const ordenados = [...empleados].sort((a, b) => ordenEstado[a.estado] - ordenEstado[b.estado]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{nombre}</p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {ordenados.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Sin colaboradores asignados</p>
          ) : (
            ordenados.map((emp) => (
              <button key={emp.empleado_id} type="button" onClick={() => onSelectEmpleado(emp)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {emp.nombres} {emp.apellidos}
                  </p>
                  {emp.cargo && <p className="truncate text-xs text-slate-400">{emp.cargo}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {emp.entrada ? formatHora(emp.entrada.timestamp) : '—'}
                    {' → '}
                    {emp.salida ? formatHora(emp.salida.timestamp) : '—'}
                  </span>
                  <EstadoBadge estado={emp.estado} />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Calendario de sedes: días abierta / cerrada en el mes ────────────────────

interface EstadoDiaSede {
  fecha: string;
  tieneDatos: boolean; // false = día futuro, aún sin transcurrir
  abierta: boolean;
  apertura: string | null;
  cierre: string | null;
  disponibleMin: number;
}

function calcularEstadoDiaSede(empleados: EmpleadoMesOut[], fecha: string): EstadoDiaSede {
  let minEntrada: string | null = null;
  let maxSalida: string | null = null;
  let tieneDatos = false;
  for (const e of empleados) {
    const dia = e.dias.find((d) => d.fecha === fecha);
    if (!dia) continue;
    tieneDatos = true;
    for (const r of dia.registros) {
      if (r.tipo === 'entrada' && (!minEntrada || r.timestamp < minEntrada)) minEntrada = r.timestamp;
      if (r.tipo === 'salida' && (!maxSalida || r.timestamp > maxSalida)) maxSalida = r.timestamp;
    }
  }
  const disponibleMin = minEntrada && maxSalida
    ? Math.max(0, Math.round((new Date(maxSalida).getTime() - new Date(minEntrada).getTime()) / 60000))
    : 0;
  return { fecha, tieneDatos, abierta: disponibleMin > 0, apertura: minEntrada, cierre: maxSalida, disponibleMin };
}

function SeccionCalendarioSedes({
  reporteMes, grupos,
}: {
  reporteMes: ReporteMensualOut;
  grupos: { nombre: string; esHomeOffice: boolean; empleados: EmpleadoMesOut[] }[];
}) {
  const [seleccion, setSeleccion] = useState<{ sede: string; estado: EstadoDiaSede } | null>(null);
  const diasCompletos = diasCompletosDelMes(reporteMes.mes_inicio, reporteMes.mes_fin);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Calendario de sedes · {labelMesActual()}
        </p>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Abierta
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-slate-200 dark:bg-slate-700" /> Cerrada
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-slate-300 dark:border-slate-600" /> Pendiente
          </span>
        </div>
        <Link href="/jornada/reporte-mensual" className="text-xs font-medium text-cyan-600 hover:underline dark:text-cyan-400">
          Ver informe completo →
        </Link>
      </div>

      {diasCompletos.length === 0 ? (
        <p className="text-sm text-slate-400">Sin datos este mes.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-max space-y-1">
            {/* Encabezado de días de la semana (compartido para todas las sedes) */}
            <div className="flex items-center gap-3">
              <div className="w-32 shrink-0" />
              <div className="flex items-center gap-[3px]">
                {diasCompletos.map((f) => (
                  <span key={f}
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center text-[8px] font-bold uppercase text-slate-400 ${offsetSemana(f) === 0 ? 'ml-2' : ''}`}>
                    {DIAS_SEMANA_CORTO[offsetSemana(f)][0]}
                  </span>
                ))}
              </div>
            </div>

            {grupos.map(({ nombre, esHomeOffice, empleados }) => {
              const estados = diasCompletos.map((f) => calcularEstadoDiaSede(empleados, f));
              const diasAbiertos = estados.filter((d) => d.abierta).length;
              const diasTranscurridos = estados.filter((d) => d.tieneDatos).length;
              const tiempoDisponibleTotal = estados.reduce((a, d) => a + d.disponibleMin, 0);

              return (
                <div key={nombre} className="flex items-center gap-3 py-0.5">
                  <p className="w-32 shrink-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300" title={nombre}>
                    {esHomeOffice && '🏠 '}{nombre}
                  </p>
                  <div className="flex items-center gap-[3px]">
                    {estados.map((estado) => {
                      const clase = !estado.tieneDatos
                        ? 'border border-dashed border-slate-200 dark:border-slate-700'
                        : estado.abierta
                        ? 'bg-emerald-500 hover:bg-emerald-600'
                        : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600';
                      return (
                        <button
                          key={estado.fecha}
                          type="button"
                          disabled={!estado.tieneDatos}
                          onClick={() => setSeleccion({ sede: `${esHomeOffice ? '🏠 ' : ''}${nombre}`, estado })}
                          title={estado.tieneDatos ? `${estado.fecha} · ${estado.abierta ? 'Abierta' : 'Cerrada'}` : `${estado.fecha} · Pendiente`}
                          className={`h-3.5 w-3.5 shrink-0 rounded-sm transition-colors disabled:cursor-default ${offsetSemana(estado.fecha) === 0 ? 'ml-2' : ''} ${clase}`}
                        />
                      );
                    })}
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-3 whitespace-nowrap text-xs">
                    <span className="text-slate-400">{diasAbiertos}/{diasTranscurridos}d</span>
                    <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                      {tiempoDisponibleTotal > 0 ? formatMinutos(tiempoDisponibleTotal) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Popup resumen del día seleccionado */}
      {seleccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSeleccion(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                  {seleccion.sede}
                </p>
                <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
                  {new Date(seleccion.estado.fecha + 'T12:00:00Z').toLocaleDateString('es-CO', {
                    weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC',
                  })}
                </p>
              </div>
              <button onClick={() => setSeleccion(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {seleccion.estado.abierta ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Apertura</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                    {seleccion.estado.apertura ? formatHora(seleccion.estado.apertura) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Cierre</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                    {seleccion.estado.cierre ? formatHora(seleccion.estado.cierre) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Tiempo disponible</span>
                  <span className="font-semibold text-cyan-700 dark:text-cyan-400">
                    {formatMinutos(seleccion.estado.disponibleMin)}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Sin actividad este día.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const HOME_OFFICE_KEY = '__home_office__';

export default function JornadaDashboardPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<AsistenciaResponse | null>(null);
  const [sedes, setSedes] = useState<SedeJornadaOut[]>([]);
  const [reporteMes, setReporteMes] = useState<ReporteMensualOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(hoy());

  const [selectedEmp, setSelectedEmp] = useState<EmpleadoAsistenciaOut | null>(null);
  const [sedeDetalle, setSedeDetalle] = useState<string | null>(null); // key de sede/grupo seleccionado
  const [sedesOcultas, setSedesOcultas] = useState<string[]>([]);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem('dashboard_sedes_ocultas');
      if (guardado) setSedesOcultas(JSON.parse(guardado));
    } catch {
      // ignore
    }
  }, []);

  function ocultarSede(nombre: string) {
    setSedesOcultas((prev) => {
      const next = prev.includes(nombre) ? prev : [...prev, nombre];
      try { localStorage.setItem('dashboard_sedes_ocultas', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function mostrarTodasSedes() {
    setSedesOcultas([]);
    try { localStorage.removeItem('dashboard_sedes_ocultas'); } catch { /* ignore */ }
  }

  const sedesEmpresa = sedes.filter((s) => s.tipo === 'empresa');
  const nombresHomeOffice = new Set(sedes.filter((s) => s.tipo === 'home_office').map((s) => s.nombre));
  const hayHomeOffice = nombresHomeOffice.size > 0;

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getSedesJornada().then(setSedes).catch(() => {});
    getReporteMensual({ mes: mesActual() }).then(setReporteMes).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  async function cargar() {
    setLoading(true);
    try {
      const result = await getAsistencia({ fecha });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const puedeVer = hasPermission('jornada:read');

  // Agrupar empleados del día por sede/grupo para las tarjetas y el drill-down
  const empleados = data?.empleados ?? [];
  const gruposSede = new Map<string, EmpleadoAsistenciaOut[]>();
  for (const s of sedesEmpresa) gruposSede.set(s.nombre, []);
  if (hayHomeOffice) gruposSede.set(HOME_OFFICE_KEY, []);
  const sinSede: EmpleadoAsistenciaOut[] = [];
  for (const e of empleados) {
    if (e.sede && nombresHomeOffice.has(e.sede)) {
      gruposSede.get(HOME_OFFICE_KEY)!.push(e);
    } else if (e.sede && gruposSede.has(e.sede)) {
      gruposSede.get(e.sede)!.push(e);
    } else {
      sinSede.push(e);
    }
  }

  const empleadosSedeDetalle = sedeDetalle === HOME_OFFICE_KEY
    ? (gruposSede.get(HOME_OFFICE_KEY) ?? [])
    : sedeDetalle === '__sin_sede__'
    ? sinSede
    : sedeDetalle
    ? (gruposSede.get(sedeDetalle) ?? [])
    : [];
  const nombreSedeDetalle = sedeDetalle === HOME_OFFICE_KEY
    ? '🏠 Home Office'
    : sedeDetalle === '__sin_sede__'
    ? 'Sin sede asignada'
    : sedeDetalle ?? '';

  // Agrupar empleados del mes por sede/grupo para el calendario de aperturas/cierres
  const gruposCalendario: { nombre: string; esHomeOffice: boolean; empleados: EmpleadoMesOut[] }[] = [];
  if (reporteMes) {
    for (const s of sedesEmpresa) {
      if (sedesOcultas.includes(s.nombre)) continue;
      gruposCalendario.push({
        nombre: s.nombre,
        esHomeOffice: false,
        empleados: reporteMes.empleados.filter((e) => e.sede === s.nombre),
      });
    }
    if (hayHomeOffice && !sedesOcultas.includes('Home Office')) {
      gruposCalendario.push({
        nombre: 'Home Office',
        esHomeOffice: true,
        empleados: reporteMes.empleados.filter((e) => e.sede && nombresHomeOffice.has(e.sede)),
      });
    }
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Nuestro Horario</p>
            <h1 className="mt-0.5 text-2xl font-bold">Dashboard de Jornada</h1>
            {data && (
              <p className="mt-0.5 text-sm capitalize text-slate-500 dark:text-slate-400">
                {formatFecha(data.fecha)}
              </p>
            )}
          </div>
        </div>

        {!puedeVer ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-12 w-12 text-slate-300 dark:text-slate-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="font-semibold text-slate-600 dark:text-slate-400">Sin acceso</p>
            <p className="text-sm text-slate-400">Necesitas el permiso <code>jornada:read</code></p>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">

            {/* Selector de fecha */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Fecha</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                  <button type="button" onClick={() => setFecha(hoy())}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                    Hoy
                  </button>
                </div>
              </div>
              <button type="button" onClick={cargar}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Actualizar
              </button>
            </div>

            {/* Personal: KPIs del día */}
            {data && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <SummaryCard label="Personal esperado" value={data.total_empleados}
                  sub="Con jornada activa"
                  color="border-slate-200 dark:border-slate-800" />
                <SummaryCard label="En sede" value={data.presentes}
                  sub="Entrada sin salida"
                  color="border-emerald-200 dark:border-emerald-800" />
                <SummaryCard label="Completaron" value={data.completos}
                  sub="Jornada cerrada"
                  color="border-blue-200 dark:border-blue-800" />
                <SummaryCard label="Ausentes" value={data.ausentes}
                  sub="Sin registros"
                  color="border-red-200 dark:border-red-800" />
              </div>
            )}

            {/* Sedes: aperturas, cierres y personal por sede */}
            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Sedes
                </p>
                {sedesOcultas.length > 0 && (
                  <button type="button" onClick={mostrarTodasSedes}
                    className="text-xs font-medium text-cyan-600 hover:underline dark:text-cyan-400">
                    {sedesOcultas.length} sede{sedesOcultas.length !== 1 ? 's' : ''} oculta{sedesOcultas.length !== 1 ? 's' : ''} · Mostrar todas
                  </button>
                )}
              </div>
              {loading ? (
                <div className="flex justify-center py-12">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
                </div>
              ) : !data ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                  No fue posible cargar los datos.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {sedesEmpresa.filter((s) => !sedesOcultas.includes(s.nombre)).map((s) => (
                    <SedeCard key={s.id} nombre={s.nombre} esHomeOffice={false}
                      empleados={gruposSede.get(s.nombre) ?? []}
                      onSelect={() => setSedeDetalle(s.nombre)}
                      onOcultar={() => ocultarSede(s.nombre)} />
                  ))}
                  {hayHomeOffice && !sedesOcultas.includes('Home Office') && (
                    <SedeCard nombre="Home Office" esHomeOffice
                      empleados={gruposSede.get(HOME_OFFICE_KEY) ?? []}
                      onSelect={() => setSedeDetalle(HOME_OFFICE_KEY)}
                      onOcultar={() => ocultarSede('Home Office')} />
                  )}
                  {sinSede.length > 0 && !sedesOcultas.includes('Sin sede asignada') && (
                    <SedeCard nombre="Sin sede asignada" esHomeOffice={false}
                      empleados={sinSede}
                      onSelect={() => setSedeDetalle('__sin_sede__')}
                      onOcultar={() => ocultarSede('Sin sede asignada')} />
                  )}
                </div>
              )}
            </div>

            {/* Calendario de sedes: días abierta/cerrada en el mes */}
            {reporteMes && (
              <SeccionCalendarioSedes reporteMes={reporteMes} grupos={gruposCalendario} />
            )}
          </div>
        )}

        {/* Modal drill-down de sede */}
        {sedeDetalle && (
          <SedeDetalleModal
            nombre={nombreSedeDetalle}
            empleados={empleadosSedeDetalle}
            onClose={() => setSedeDetalle(null)}
            onSelectEmpleado={(emp) => setSelectedEmp(emp)}
          />
        )}

        {/* Modal detalle/auditoría de un empleado */}
        {selectedEmp && (
          <DetalleModal
            emp={selectedEmp}
            fecha={fecha}
            onClose={() => setSelectedEmp(null)}
          />
        )}
      </main>
    </>
  );
}
