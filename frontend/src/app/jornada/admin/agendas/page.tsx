"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { EmpleadoAgendaRow, getEmpleadoAgendas, quitarEmpleadoAgenda, setEmpleadoAgenda } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';

function FilaAgenda({ row, onSaved }: { row: EmpleadoAgendaRow; onSaved: (agenda: string | null) => void }) {
  const [valor, setValor] = useState(row.agenda ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = valor.trim() !== (row.agenda ?? '');

  const guardar = async () => {
    setSaving(true);
    setError('');
    try {
      const limpio = valor.trim();
      if (!limpio) {
        await quitarEmpleadoAgenda(row.empleado_id, row.sede);
        onSaved(null);
      } else {
        await setEmpleadoAgenda(row.empleado_id, row.sede, limpio);
        onSaved(limpio);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-slate-100 dark:border-slate-800">
      <td className="px-4 py-2.5">
        <p className="font-medium text-slate-800 dark:text-slate-100">{row.nombres} {row.apellidos}</p>
        {row.cargo && <p className="text-xs text-slate-400">{row.cargo}</p>}
      </td>
      <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">{row.sede}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Ej: MEDICA, ESTETICA, LASER…"
            className="w-full min-w-[10rem]"
          />
          <button
            type="button"
            onClick={guardar}
            disabled={saving || !dirty}
            className="shrink-0 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-40 dark:bg-cyan-500 dark:text-slate-950"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </td>
    </tr>
  );
}

export default function AgendasAdminPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const puedeAdmin = hasPermission('jornada:admin');

  const [rows, setRows] = useState<EmpleadoAgendaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroSede, setFiltroSede] = useState('');

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    try {
      const data = await getEmpleadoAgendas();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  const sedes = useMemo(() => Array.from(new Set(rows.map((r) => r.sede))).sort(), [rows]);
  const filtradas = filtroSede ? rows.filter((r) => r.sede === filtroSede) : rows;

  const actualizarFila = (empleadoId: number, sede: string, agenda: string | null) => {
    setRows((prev) => prev.map((r) => (r.empleado_id === empleadoId && r.sede === sede ? { ...r, agenda } : r)));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button type="button" onClick={() => router.back()}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-700 dark:text-cyan-300">Nuestro Horario · Admin</p>
            <h1 className="text-lg font-bold">Agendas por profesional</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-4">
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800 dark:border-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-200">
          Asigna la <strong>Agenda</strong> (ESTETICA, LASER, MEDICA, …) que cada profesional cubre en cada sede.
          Esto permite cruzar el tiempo real registrado en Jornada con el reporte de ocupación de Looker Studio.
          Debe escribirse igual a como aparece la Agenda en ese reporte.
        </div>

        {!puedeAdmin ? (
          <p className="text-sm text-slate-500">No tienes permiso para administrar esta sección.</p>
        ) : (
          <>
            {sedes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setFiltroSede('')}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${filtroSede === '' ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950' : 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'}`}>
                  Todas las sedes
                </button>
                {sedes.map((s) => (
                  <button key={s} type="button" onClick={() => setFiltroSede(s)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${filtroSede === s ? 'bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950' : 'border border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              {loading ? (
                <div className="flex justify-center py-12">
                  <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500" />
                </div>
              ) : filtradas.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-400">No hay empleados en jornada asignados a sedes.</p>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                      <th className="px-4 py-2.5">Profesional</th>
                      <th className="px-4 py-2.5">Sede</th>
                      <th className="px-4 py-2.5">Agenda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((row) => (
                      <FilaAgenda
                        key={`${row.empleado_id}-${row.sede}`}
                        row={row}
                        onSaved={(agenda) => actualizarFila(row.empleado_id, row.sede, agenda)}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
