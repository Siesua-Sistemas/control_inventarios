"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  AsistenciaResponse,
  EmpleadoAsistenciaOut,
  RegistroJornadaOut,
  SedeJornadaOut,
  getAsistencia,
  getRegistrosEmpleado,
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

// ── Modal detalle empleado ────────────────────────────────────────────────────

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

// ── Fila de tabla ─────────────────────────────────────────────────────────────

function EmpleadoRow({
  emp,
  onSelect,
}: {
  emp: EmpleadoAsistenciaOut;
  onSelect: () => void;
}) {
  return (
    <tr
      className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
      onClick={onSelect}
    >
      {/* Empleado */}
      <td className="py-3 pl-4 pr-3">
        <p className="font-semibold text-sm text-slate-900 dark:text-slate-50">
          {emp.nombres} {emp.apellidos}
        </p>
        {emp.cargo && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{emp.cargo}</p>
        )}
      </td>

      {/* Sede */}
      <td className="hidden px-3 py-3 sm:table-cell">
        <span className="text-sm text-slate-600 dark:text-slate-400">{emp.sede ?? '—'}</span>
      </td>

      {/* Entrada */}
      <td className="px-3 py-3">
        {emp.entrada ? (
          <span className="font-mono text-sm text-emerald-700 dark:text-emerald-400">
            {formatHora(emp.entrada.timestamp)}
          </span>
        ) : (
          <span className="text-sm text-slate-300 dark:text-slate-600">—</span>
        )}
      </td>

      {/* Salida */}
      <td className="px-3 py-3">
        {emp.salida ? (
          <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
            {formatHora(emp.salida.timestamp)}
          </span>
        ) : (
          <span className="text-sm text-slate-300 dark:text-slate-600">—</span>
        )}
      </td>

      {/* Tiempo */}
      <td className="hidden px-3 py-3 md:table-cell">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {emp.total_minutos !== null ? formatMinutos(emp.total_minutos) : '—'}
        </span>
      </td>

      {/* Estado */}
      <td className="py-3 pl-3 pr-4">
        <EstadoBadge estado={emp.estado} />
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const HOME_OFFICE_KEY = '__home_office__';

export default function JornadaDashboardPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const [data, setData] = useState<AsistenciaResponse | null>(null);
  const [sedes, setSedes] = useState<SedeJornadaOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(hoy());
  const [sedeFilter, setSedeFilter] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'presente' | 'completo' | 'ausente'>('todos');
  const [busqueda, setBusqueda] = useState('');

  const [selectedEmp, setSelectedEmp] = useState<EmpleadoAsistenciaOut | null>(null);

  const sedesEmpresa = sedes.filter((s) => s.tipo === 'empresa');
  const nombresHomeOffice = new Set(sedes.filter((s) => s.tipo === 'home_office').map((s) => s.nombre));
  const hayHomeOffice = nombresHomeOffice.size > 0;

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getSedesJornada().then(setSedes).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!isAuthenticated()) return;
    cargar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, sedeFilter]);

  async function cargar() {
    setLoading(true);
    try {
      // HOME OFFICE agrupa todas las sedes remotas; la API recibe sin filtro de sede
      const sedeApi = sedeFilter === HOME_OFFICE_KEY ? undefined : (sedeFilter || undefined);
      const result = await getAsistencia({ fecha, sede: sedeApi });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const empleadosFiltrados = (data?.empleados ?? []).filter((e) => {
    // Filtro sede: si es HOME OFFICE, solo empleados cuya sede sea una sede home_office
    if (sedeFilter === HOME_OFFICE_KEY) {
      if (!e.sede || !nombresHomeOffice.has(e.sede)) return false;
    }
    if (filtroEstado !== 'todos' && e.estado !== filtroEstado) return false;
    if (busqueda) {
      const q = busqueda.toLowerCase();
      const nombre = `${e.nombres} ${e.apellidos}`.toLowerCase();
      if (!nombre.includes(q) && !(e.cargo ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Ordenar: ausentes primero, luego presentes, luego completos
  const ordenEstado = { ausente: 0, presente: 1, completo: 2 };
  const empleadosOrdenados = [...empleadosFiltrados].sort(
    (a, b) => ordenEstado[a.estado] - ordenEstado[b.estado],
  );

  // Cuando el filtro es HOME OFFICE, la API trae todos → recalcular contadores client-side
  const baseHomeOffice = sedeFilter === HOME_OFFICE_KEY && data
    ? (data.empleados ?? []).filter((e) => e.sede && nombresHomeOffice.has(e.sede))
    : null;
  const resumenTotal     = baseHomeOffice ? baseHomeOffice.length                                    : data?.total_empleados ?? 0;
  const resumenPresentes = baseHomeOffice ? baseHomeOffice.filter((e) => e.estado === 'presente').length : data?.presentes ?? 0;
  const resumenCompletos = baseHomeOffice ? baseHomeOffice.filter((e) => e.estado === 'completo').length : data?.completos ?? 0;
  const resumenAusentes  = baseHomeOffice ? baseHomeOffice.filter((e) => e.estado === 'ausente').length  : data?.ausentes ?? 0;

  const puedeVer = hasPermission('jornada:read');

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Nuestro Horario</p>
            <h1 className="mt-0.5 text-2xl font-bold">Control de Asistencia</h1>
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
          <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">

            {/* Filtros */}
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

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Sede</label>
                <select
                  value={sedeFilter}
                  onChange={(e) => setSedeFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="">Todas las sedes</option>
                  {sedesEmpresa.map((s) => (
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                  ))}
                  {hayHomeOffice && (
                    <option value={HOME_OFFICE_KEY}>🏠 Home Office</option>
                  )}
                </select>
              </div>

              <div className="flex-1 min-w-[180px]">
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Buscar</label>
                <input
                  type="text"
                  placeholder="Nombre o cargo…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
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

            {/* Tarjetas resumen */}
            {data && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <SummaryCard label="Esperados" value={resumenTotal}
                  sub={sedeFilter === HOME_OFFICE_KEY ? 'Home Office' : sedeFilter ? `Sede ${sedeFilter}` : 'Todos'}
                  color="border-slate-200 dark:border-slate-800" />
                <SummaryCard label="En sede" value={resumenPresentes}
                  sub="Entrada sin salida"
                  color="border-emerald-200 dark:border-emerald-800" />
                <SummaryCard label="Completaron" value={resumenCompletos}
                  sub="Jornada cerrada"
                  color="border-blue-200 dark:border-blue-800" />
                <SummaryCard label="Ausentes" value={resumenAusentes}
                  sub="Sin registros"
                  color="border-red-200 dark:border-red-800" />
              </div>
            )}

            {/* Filtros de estado rápidos */}
            <div className="flex flex-wrap gap-2">
              {(['todos', 'presente', 'completo', 'ausente'] as const).map((e) => {
                const labels = { todos: 'Todos', presente: 'En sede', completo: 'Completaron', ausente: 'Ausentes' };
                return (
                  <button key={e} type="button" onClick={() => setFiltroEstado(e)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      filtroEstado === e
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                    }`}>
                    {labels[e]}
                    {data && e !== 'todos' && (
                      <span className="ml-1.5 opacity-60">
                        {e === 'presente' ? resumenPresentes : e === 'completo' ? resumenCompletos : resumenAusentes}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tabla */}
            {loading ? (
              <div className="flex justify-center py-16">
                <span className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
              </div>
            ) : !data ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
                <p className="text-slate-500 dark:text-slate-400">No fue posible cargar los datos.</p>
              </div>
            ) : empleadosOrdenados.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
                <p className="text-slate-500 dark:text-slate-400">
                  {busqueda ? 'Sin resultados para esa búsqueda.' : 'No hay empleados en esta vista.'}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {empleadosOrdenados.length} colaborador{empleadosOrdenados.length !== 1 ? 'es' : ''}
                  </p>
                  <p className="text-xs text-slate-400">Haz clic en una fila para ver detalles</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="py-3 pl-4 pr-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Colaborador
                        </th>
                        <th className="hidden px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 sm:table-cell">
                          Sede
                        </th>
                        <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Entrada
                        </th>
                        <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Salida
                        </th>
                        <th className="hidden px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 md:table-cell">
                          Tiempo
                        </th>
                        <th className="py-3 pl-3 pr-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {empleadosOrdenados.map((emp) => (
                        <EmpleadoRow
                          key={emp.empleado_id}
                          emp={emp}
                          onSelect={() => setSelectedEmp(emp)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal detalle empleado */}
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
