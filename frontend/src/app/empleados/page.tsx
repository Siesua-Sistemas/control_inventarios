"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import {
  EquipoAsignadoOut,
  EmpleadoRow,
  getEmpleadoEquipos,
  isAuthenticated,
  listEmpleados,
  toggleEmpleadoEstado,
} from '@/lib/api';

const PAGE_SIZE = 50;

// ── Modal de retiro ───────────────────────────────────────────────────────────

function ModalRetiro({
  emp,
  onClose,
  onConfirm,
}: {
  emp: EmpleadoRow;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [equipos, setEquipos] = useState<EquipoAsignadoOut[] | null>(null);
  const [errorEquipos, setErrorEquipos] = useState('');
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    getEmpleadoEquipos(emp.id)
      .then(setEquipos)
      .catch((e) => {
        setErrorEquipos(e instanceof Error ? e.message : 'Error al consultar equipos');
        setEquipos([]);
      })
      .finally(() => setLoading(false));
  }, [emp.id]);

  async function handleInactivar() {
    setGuardando(true);
    try {
      await toggleEmpleadoEstado(emp.id, false);
      onConfirm();
    } catch {
      setGuardando(false);
    }
  }

  const tieneEquipos = (equipos?.length ?? 0) > 0;
  const puedeInactivar = !tieneEquipos || confirmado;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
              Retiro de empleado
            </p>
            <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
              {emp.nombres} {emp.apellidos}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{emp.cedula}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Equipos asignados */}
        <div className="px-5 py-4">
          {errorEquipos && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/50 dark:bg-red-900/10 dark:text-red-400">
              No se pudieron cargar los equipos: {errorEquipos}
            </div>
          )}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
              Verificando equipos asignados…
            </div>
          ) : tieneEquipos ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/50 dark:bg-amber-900/10">
              <div className="mb-2 flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {equipos!.length} equipo{equipos!.length > 1 ? 's' : ''} asignado{equipos!.length > 1 ? 's' : ''}
                </p>
              </div>
              <ul className="space-y-1">
                {equipos!.map((eq) => (
                  <li key={eq.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{eq.nombre}</span>
                    <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      {eq.serial && <span className="font-mono">{eq.serial}</span>}
                      <span className={`rounded-full px-1.5 py-0.5 font-medium ${
                        eq.estado === 'Prestado'
                          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                          : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                      }`}>{eq.estado}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
                Se recomienda gestionar las devoluciones en{' '}
                <Link href="/asignaciones" className="underline hover:no-underline" onClick={onClose}>
                  Asignaciones
                </Link>{' '}
                antes de inactivar.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800/50 dark:bg-emerald-900/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Sin equipos asignados — listo para retiro.
              </p>
            </div>
          )}

          {/* Paz y salvo info */}
          <div className="mt-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Paz y salvo:</span> Si se requiere generar un acta firmada de devolución de equipos, hazlo desde{' '}
              <Link href="/asignaciones" className="text-cyan-600 underline dark:text-cyan-400" onClick={onClose}>
                Asignaciones
              </Link>{' '}
              antes de inactivar al empleado.
            </p>
          </div>

          {/* Confirmación si hay equipos */}
          {tieneEquipos && (
            <label className="mt-3 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={confirmado}
                onChange={(e) => setConfirmado(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-red-500"
              />
              <span className="text-xs text-slate-600 dark:text-slate-300">
                Confirmo que los equipos fueron gestionados o que el retiro procede bajo mi responsabilidad.
              </span>
            </label>
          )}
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleInactivar}
            disabled={!puedeInactivar || guardando || loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 dark:bg-red-700 dark:hover:bg-red-600"
          >
            {guardando ? 'Procesando…' : 'Inactivar empleado'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function EmpleadosPage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canWrite = authLoading || hasPermission('empleados:write');

  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [modalRetiro, setModalRetiro] = useState<EmpleadoRow | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    fetch_();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function fetch_(q?: string, p = 0, inactive = includeInactive) {
    setLoading(true); setError('');
    try {
      const r = await listEmpleados({
        search: q ?? search,
        skip: p * PAGE_SIZE,
        limit: PAGE_SIZE,
        include_inactive: inactive,
      });
      setEmpleados(r.items);
      setTotal(r.total);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  function goPage(p: number) { fetch_(undefined, p); }

  function toggleInactivos() {
    const next = !includeInactive;
    setIncludeInactive(next);
    fetch_(undefined, 0, next);
  }

  async function handleActivar(emp: EmpleadoRow) {
    if (!window.confirm(`¿Reactivar a "${emp.nombre_completo}"?`)) return;
    setToggling(emp.id);
    try {
      const updated = await toggleEmpleadoEstado(emp.id, true);
      setEmpleados((prev) => prev.map((e) => e.id === emp.id ? updated : e));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reactivar');
    } finally {
      setToggling(null);
    }
  }

  function handleRetiroConfirm() {
    setModalRetiro(null);
    fetch_();
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Gestión</p>
            <h1 className="mt-1 text-3xl font-bold">Empleados</h1>
          </div>
          {canWrite && (
            <Link
              href="/empleados/nuevo"
              className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400"
            >
              + Nuevo empleado
            </Link>
          )}
        </div>

        {/* Barra de búsqueda + toggle inactivos */}
        <div className="mb-4 flex flex-wrap gap-2">
          <form onSubmit={(e) => { e.preventDefault(); fetch_(); }} className="flex flex-1 gap-2">
            <input
              className="flex-1"
              placeholder="Buscar por nombre o cédula..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="px-4 py-2">Buscar</button>
            {search && (
              <button
                type="button"
                className="bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 px-3"
                onClick={() => { setSearch(''); fetch_(''); }}
              >
                ✕
              </button>
            )}
          </form>
          <button
            type="button"
            onClick={toggleInactivos}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              includeInactive
                ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            {includeInactive ? 'Mostrando inactivos' : 'Ver inactivos'}
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-950 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Cédula</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Sede</th>
                {includeInactive && <th className="px-4 py-3">Estado</th>}
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={includeInactive ? 6 : 5} className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">
                    Cargando...
                  </td>
                </tr>
              ) : empleados.length === 0 ? (
                <tr>
                  <td colSpan={includeInactive ? 6 : 5} className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">
                    No hay empleados registrados.
                  </td>
                </tr>
              ) : empleados.map((emp) => (
                <tr
                  key={emp.id}
                  className={`border-t border-slate-200 dark:border-slate-800 ${
                    emp.is_active
                      ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      : 'bg-slate-50/60 opacity-70 dark:bg-slate-800/20'
                  }`}
                >
                  <td className="px-4 py-3 font-medium">
                    {emp.nombre_completo}
                    {emp.en_jornada && (
                      <span className="ml-2 rounded-full bg-cyan-100 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                        Jornada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{emp.cedula}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{emp.cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{emp.sede ?? '—'}</td>
                  {includeInactive && (
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        emp.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {emp.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      <div className="flex justify-end gap-2">
                        {emp.is_active ? (
                          <>
                            <Link
                              href={`/empleados/${emp.id}/editar`}
                              className="rounded-md bg-slate-200 px-3 py-1 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                            >
                              Editar
                            </Link>
                            <button
                              onClick={() => setModalRetiro(emp)}
                              className="rounded-md bg-red-100 px-3 py-1 text-xs text-red-700 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                            >
                              Retiro
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleActivar(emp)}
                            disabled={toggling === emp.id}
                            className="rounded-md bg-emerald-100 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                          >
                            {toggling === emp.id ? '…' : 'Activar'}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && empleados.length > 0 && (
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>{total} empleado{total !== 1 ? 's' : ''}</span>
            {total > PAGE_SIZE && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => goPage(page - 1)}
                  disabled={page === 0}
                  className="rounded-md bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  ← Anterior
                </button>
                <span>Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}</span>
                <button
                  type="button"
                  onClick={() => goPage(page + 1)}
                  disabled={(page + 1) * PAGE_SIZE >= total}
                  className="rounded-md bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de retiro */}
      {modalRetiro && (
        <ModalRetiro
          emp={modalRetiro}
          onClose={() => setModalRetiro(null)}
          onConfirm={handleRetiroConfirm}
        />
      )}
    </>
  );
}
