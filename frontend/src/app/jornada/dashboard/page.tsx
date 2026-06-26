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
  storageUrl,
} from '@/lib/api';
import { NavBar } from '@/components/nav-bar';
import { useAuth } from '@/components/auth-provider';

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

function FotoThumb({ url, label, onClick }: { url: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700"
      title={`Ver foto ${label}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="h-10 w-10 object-cover transition-opacity group-hover:opacity-75" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}
          className="h-4 w-4 opacity-0 drop-shadow group-hover:opacity-100">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
        </svg>
      </div>
    </button>
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
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  useEffect(() => {
    getRegistrosEmpleado(emp.empleado_id, fecha)
      .then(setRegistros)
      .finally(() => setLoading(false));
  }, [emp.empleado_id, fecha]);

  const cfg = ESTADO_CFG[emp.estado];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-0 sm:px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {fotoAmpliada && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFotoAmpliada(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotoAmpliada} alt="Evidencia" className="max-h-[90vh] max-w-full rounded-xl object-contain" />
        </div>
      )}

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="font-bold">{emp.nombres} {emp.apellidos}</h2>
              <EstadoBadge estado={emp.estado} />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {[emp.cargo, emp.sede].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Resumen del día */}
          {emp.total_minutos !== null && (
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Tiempo en sede</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-200">{formatMinutos(emp.total_minutos)}</p>
              </div>
            </div>
          )}

          {/* Timeline de registros */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Registros del día
            </p>
            {loading ? (
              <div className="flex justify-center py-8">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
              </div>
            ) : registros.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sin registros</p>
            ) : (
              <ol className="relative ml-2 border-l border-slate-200 dark:border-slate-700">
                {registros.map((r) => {
                  const isEntrada = r.tipo === 'entrada';
                  const fotoUrl = storageUrl(r.foto_url);
                  return (
                    <li key={r.id} className="mb-5 ml-5">
                      <span className={`absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-900 ${isEntrada ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                        {isEntrada ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0110.5 3h6a2.25 2.25 0 012.25 2.25v13.5A2.25 2.25 0 0116.5 21h-6a2.25 2.25 0 01-2.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                          </svg>
                        )}
                      </span>

                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className={`text-sm font-semibold ${isEntrada ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                              {isEntrada ? 'Entrada' : 'Salida'}
                            </span>
                            <span className="font-mono text-sm text-slate-500">{formatHora(r.timestamp)}</span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-400">
                            {r.latitud && (
                              <span>📍 {r.latitud.toFixed(5)}, {r.longitud?.toFixed(5)}</span>
                            )}
                            {r.ip_publica && <span>🌐 {r.ip_publica}</span>}
                          </div>
                          {r.dispositivo && (
                            <p className="mt-0.5 text-xs text-slate-400 truncate max-w-[240px]">
                              📱 {r.dispositivo.split(' ').slice(0, 4).join(' ')}
                            </p>
                          )}
                        </div>
                        {fotoUrl && (
                          <button type="button" onClick={() => setFotoAmpliada(fotoUrl)}
                            className="shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={fotoUrl} alt="Evidencia" className="h-16 w-16 object-cover hover:opacity-80 transition-opacity" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fila de tabla ─────────────────────────────────────────────────────────────

function EmpleadoRow({
  emp,
  onSelect,
  onFoto,
}: {
  emp: EmpleadoAsistenciaOut;
  onSelect: () => void;
  onFoto: (url: string) => void;
}) {
  const entradaFoto = storageUrl(emp.entrada?.foto_url ?? null);
  const salidaFoto  = storageUrl(emp.salida?.foto_url ?? null);

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
          <div className="flex items-center gap-2">
            {entradaFoto && (
              <FotoThumb url={entradaFoto} label="entrada"
                onClick={() => onFoto(entradaFoto!)} />
            )}
            <span className="font-mono text-sm text-emerald-700 dark:text-emerald-400">
              {formatHora(emp.entrada.timestamp)}
            </span>
          </div>
        ) : (
          <span className="text-sm text-slate-300 dark:text-slate-600">—</span>
        )}
      </td>

      {/* Salida */}
      <td className="px-3 py-3">
        {emp.salida ? (
          <div className="flex items-center gap-2">
            {salidaFoto && (
              <FotoThumb url={salidaFoto} label="salida"
                onClick={() => onFoto(salidaFoto!)} />
            )}
            <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
              {formatHora(emp.salida.timestamp)}
            </span>
          </div>
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
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

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
      const result = await getAsistencia({ fecha, sede: sedeFilter || undefined });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const empleadosFiltrados = (data?.empleados ?? []).filter((e) => {
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

  const puedeVer = hasPermission('jornada:read');

  return (
    <>
      <NavBar />
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Mi Jornada</p>
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
                  {sedes.map((s) => (
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>
                  ))}
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
                <SummaryCard label="Esperados" value={data.total_empleados}
                  sub={sedeFilter ? `Sede ${sedeFilter}` : 'Todos'}
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
                        {e === 'presente' ? data.presentes : e === 'completo' ? data.completos : data.ausentes}
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
                          onFoto={setFotoAmpliada}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal foto ampliada (tabla) */}
        {fotoAmpliada && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setFotoAmpliada(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoAmpliada} alt="Evidencia" className="max-h-[90vh] max-w-full rounded-2xl object-contain" />
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
