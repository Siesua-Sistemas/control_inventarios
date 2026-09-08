"use client";

import { useEffect, useState } from 'react';
import {
  RegistroJornadaOut,
  editarRegistroJornada,
  fijarAlmuerzoManual,
  getRegistrosEmpleado,
  quitarAlmuerzoManual,
  registrarEntradaManual,
  registrarSalidaManual,
} from '@/lib/api';

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota',
  });
}

function toBogotaFechaInput(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

function toBogotaHoraInput(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

/**
 * Editor de marcaciones (entrada/salida) de un empleado en un día puntual:
 * permite corregir la hora de un registro existente, y agregar una entrada
 * o salida manual cuando falta. Reutilizable desde cualquier pantalla que
 * necesite esta corrección (reporte semanal, dashboard, etc.).
 */
export function EditarRegistrosModal({
  empleadoId,
  nombres,
  apellidos,
  sede,
  fecha,
  almuerzoMin,
  almuerzoManual,
  onCambio,
  onClose,
}: {
  empleadoId: number;
  nombres: string;
  apellidos: string;
  sede?: string | null;
  fecha: string; // "YYYY-MM-DD"
  almuerzoMin: number;
  almuerzoManual: boolean;
  onCambio: () => void;
  onClose: () => void;
}) {
  const [registros, setRegistros] = useState<RegistroJornadaOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRegistrosEmpleado(empleadoId, fecha)
      .then(setRegistros)
      .finally(() => setLoading(false));
  }, [empleadoId, fecha]);

  const entradas = registros.filter((r) => r.tipo === 'entrada').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const salidas = registros.filter((r) => r.tipo === 'salida').sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const hoyBog = new Date(new Date().toLocaleString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 10) + 'T00:00:00');
  const fechaDia = new Date(fecha + 'T00:00:00');
  const esDiaPasado = fechaDia < hoyBog;
  const esHoyOPasado = fechaDia <= hoyBog;
  const necesitaSalida = entradas.length > salidas.length;

  const mostrarFormSalida = esDiaPasado && necesitaSalida;
  const mostrarFormEntrada = esHoyOPasado && entradas.length === 0;

  const [horaSalida, setHoraSalida] = useState('17:00');
  const [guardandoSalida, setGuardandoSalida] = useState(false);
  const [errorSalida, setErrorSalida] = useState('');

  async function handleSalidaManual(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoSalida(true);
    setErrorSalida('');
    try {
      await registrarSalidaManual(empleadoId, fecha, horaSalida);
      onCambio();
      onClose();
    } catch (err) {
      setErrorSalida(err instanceof Error ? err.message : 'Error al registrar la salida');
    } finally {
      setGuardandoSalida(false);
    }
  }

  const [horaEntrada, setHoraEntrada] = useState('08:00');
  const [guardandoEntrada, setGuardandoEntrada] = useState(false);
  const [errorEntrada, setErrorEntrada] = useState('');

  async function handleEntradaManual(e: React.FormEvent) {
    e.preventDefault();
    setGuardandoEntrada(true);
    setErrorEntrada('');
    try {
      await registrarEntradaManual(empleadoId, fecha, horaEntrada, { sede: sede ?? undefined });
      onCambio();
      onClose();
    } catch (err) {
      setErrorEntrada(err instanceof Error ? err.message : 'Error al registrar la entrada');
    } finally {
      setGuardandoEntrada(false);
    }
  }

  const [editando, setEditando] = useState<number | null>(null);
  const [editFecha, setEditFecha] = useState('');
  const [editHora, setEditHora] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');

  function iniciarEdicion(r: RegistroJornadaOut) {
    setEditando(r.id);
    setEditFecha(toBogotaFechaInput(r.timestamp));
    setEditHora(toBogotaHoraInput(r.timestamp));
    setErrorEdicion('');
  }

  async function handleGuardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (editando == null) return;
    setGuardandoEdicion(true);
    setErrorEdicion('');
    try {
      await editarRegistroJornada(editando, editFecha, editHora);
      onCambio();
      onClose();
    } catch (err) {
      setErrorEdicion(err instanceof Error ? err.message : 'Error al guardar el cambio');
    } finally {
      setGuardandoEdicion(false);
    }
  }

  const [editandoAlmuerzo, setEditandoAlmuerzo] = useState(false);
  const [almuerzoInput, setAlmuerzoInput] = useState(String(almuerzoMin));
  const [guardandoAlmuerzo, setGuardandoAlmuerzo] = useState(false);
  const [errorAlmuerzo, setErrorAlmuerzo] = useState('');

  async function handleGuardarAlmuerzo(e: React.FormEvent) {
    e.preventDefault();
    const minutos = Number(almuerzoInput);
    if (!Number.isFinite(minutos) || minutos < 0) {
      setErrorAlmuerzo('Ingresa un número de minutos válido');
      return;
    }
    setGuardandoAlmuerzo(true);
    setErrorAlmuerzo('');
    try {
      await fijarAlmuerzoManual(empleadoId, fecha, minutos);
      onCambio();
      onClose();
    } catch (err) {
      setErrorAlmuerzo(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setGuardandoAlmuerzo(false);
    }
  }

  async function handleQuitarAlmuerzoManual() {
    setGuardandoAlmuerzo(true);
    setErrorAlmuerzo('');
    try {
      await quitarAlmuerzoManual(empleadoId, fecha);
      onCambio();
      onClose();
    } catch (err) {
      setErrorAlmuerzo(err instanceof Error ? err.message : 'Error al revertir a automático');
    } finally {
      setGuardandoAlmuerzo(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
              {new Date(fecha + 'T12:00:00Z').toLocaleDateString('es-CO', {
                weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC',
              })}
            </p>
            <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
              {nombres} {apellidos}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2 px-5 py-4 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
            </div>
          ) : registros.length === 0 ? (
            <p className="text-center text-sm text-slate-400">Sin registros este día</p>
          ) : (
            registros
              .slice()
              .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
              .map((r) => (
                editando === r.id ? (
                  <form key={r.id} onSubmit={handleGuardarEdicion}
                    className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3 dark:border-cyan-900/40 dark:bg-cyan-900/10">
                    <p className="mb-2 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                      Editando {r.tipo === 'entrada' ? 'ingreso' : 'salida'}
                    </p>
                    <div className="flex items-center gap-2">
                      <input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} required
                        className="flex-1 rounded-lg border border-cyan-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-cyan-400 focus:outline-none dark:border-cyan-800 dark:bg-slate-800 dark:text-slate-200" />
                      <input type="time" value={editHora} onChange={(e) => setEditHora(e.target.value)} required
                        className="w-24 rounded-lg border border-cyan-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-cyan-400 focus:outline-none dark:border-cyan-800 dark:bg-slate-800 dark:text-slate-200" />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="submit" disabled={guardandoEdicion}
                        className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950">
                        {guardandoEdicion ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button type="button" onClick={() => setEditando(null)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                        Cancelar
                      </button>
                    </div>
                    {errorEdicion && (
                      <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errorEdicion}</p>
                    )}
                  </form>
                ) : (
                  <div key={r.id} className="flex items-center gap-3">
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
                    <span className="text-sm tabular-nums font-medium text-slate-700 dark:text-slate-200">
                      {formatHora(r.timestamp)}
                    </span>
                    <button type="button" onClick={() => iniciarEdicion(r)}
                      className="rounded p-1 text-slate-300 hover:bg-slate-100 hover:text-cyan-600 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-cyan-400"
                      aria-label="Editar registro">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                      </svg>
                    </button>
                  </div>
                )
              ))
          )}
        </div>

        {mostrarFormSalida && (
          <form onSubmit={handleSalidaManual} className="border-t border-amber-200/80 bg-amber-50/60 px-5 py-4 dark:border-amber-900/40 dark:bg-amber-900/10">
            <div className="mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Sin salida registrada — ingresa la hora de salida
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={horaSalida}
                onChange={(e) => setHoraSalida(e.target.value)}
                required
                className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 dark:border-amber-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <button
                type="submit"
                disabled={guardandoSalida}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950"
              >
                {guardandoSalida ? 'Guardando…' : 'Registrar'}
              </button>
            </div>
            {errorSalida && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errorSalida}</p>
            )}
          </form>
        )}

        {mostrarFormEntrada && (
          <form onSubmit={handleEntradaManual} className="border-t border-emerald-200/80 bg-emerald-50/60 px-5 py-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
            <div className="mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Sin entrada registrada ese día — ingresa la hora de entrada
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={horaEntrada}
                onChange={(e) => setHoraEntrada(e.target.value)}
                required
                className="flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20 dark:border-emerald-700 dark:bg-slate-800 dark:text-slate-200"
              />
              <button
                type="submit"
                disabled={guardandoEntrada}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950"
              >
                {guardandoEntrada ? 'Guardando…' : 'Registrar'}
              </button>
            </div>
            {errorEntrada && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errorEntrada}</p>
            )}
          </form>
        )}

        <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
          {editandoAlmuerzo ? (
            <form onSubmit={handleGuardarAlmuerzo} className="rounded-lg border border-cyan-200 bg-cyan-50/60 p-2.5 dark:border-cyan-900/40 dark:bg-cyan-900/10">
              <p className="mb-1.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-400">Minutos de almuerzo a descontar</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={almuerzoInput}
                  onChange={(e) => setAlmuerzoInput(e.target.value)}
                  required
                  className="w-20 rounded-lg border border-cyan-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-cyan-400 focus:outline-none dark:border-cyan-800 dark:bg-slate-800 dark:text-slate-200"
                />
                <button type="submit" disabled={guardandoAlmuerzo}
                  className="rounded-lg bg-cyan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950">
                  Guardar
                </button>
                {almuerzoManual && (
                  <button type="button" onClick={handleQuitarAlmuerzoManual} disabled={guardandoAlmuerzo}
                    className="rounded-lg px-2.5 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50 disabled:opacity-50 dark:text-violet-400 dark:hover:bg-violet-900/20">
                    Usar automático
                  </button>
                )}
                <button type="button" onClick={() => setEditandoAlmuerzo(false)}
                  className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
                  Cancelar
                </button>
              </div>
              {errorAlmuerzo && (
                <p className="mt-1.5 text-[10px] text-red-600 dark:text-red-400">{errorAlmuerzo}</p>
              )}
            </form>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Almuerzo: <span className="font-semibold text-slate-700 dark:text-slate-200">{almuerzoMin} min</span>
                {almuerzoManual && <span className="ml-1 text-violet-500 dark:text-violet-400">(fijado a mano)</span>}
              </p>
              <button type="button"
                onClick={() => { setAlmuerzoInput(String(almuerzoMin)); setEditandoAlmuerzo(true); }}
                className="rounded p-0.5 text-slate-300 hover:bg-slate-200 hover:text-cyan-600 dark:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-cyan-400"
                aria-label="Editar almuerzo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
