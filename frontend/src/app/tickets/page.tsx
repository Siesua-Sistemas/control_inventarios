"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { useAuth } from '@/components/auth-provider';
import { ImageFile, ImageGallery } from '@/components/image-picker';
import {
  ComentarioOut,
  TicketOut,
  TicketUpdate,
  addComentario,
  isAuthenticated,
  listTickets,
  updateTicket,
  uploadImagenesTicket,
} from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const ESTADOS: { value: string; label: string; color: string }[] = [
  { value: 'abierto', label: 'Abierto', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  { value: 'en_revision', label: 'En revisión', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  { value: 'en_proceso', label: 'En proceso', color: 'bg-blue-200 text-blue-800 dark:bg-blue-800/40 dark:text-blue-200' },
  { value: 'pendiente_usuario', label: 'Pendiente usuario', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
  { value: 'resuelto', label: 'Resuelto', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { value: 'cerrado', label: 'Cerrado', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' },
];

const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];

const PRIO_COLOR: Record<string, string> = {
  Baja: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  Media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Alta: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Crítica': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function estadoColor(estado: string) {
  return ESTADOS.find((e) => e.value === estado)?.color ?? 'bg-slate-100 text-slate-600';
}
function estadoLabel(estado: string) {
  return ESTADOS.find((e) => e.value === estado)?.label ?? estado;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TicketsPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const [tickets, setTickets] = useState<TicketOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TicketOut | null>(null);

  // Filters
  const [filterSede, setFilterSede] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterDoc, setFilterDoc] = useState('');

  // Ticket management
  const [mgmtEstado, setMgmtEstado] = useState('');
  const [mgmtPrioridad, setMgmtPrioridad] = useState('');
  const [mgmtResolucion, setMgmtResolucion] = useState('');
  const [mgmtSaving, setMgmtSaving] = useState(false);

  // Comments
  const [comentario, setComentario] = useState('');
  const [esInterno, setEsInterno] = useState(true);
  const [commentSaving, setCommentSaving] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (!hasPermission('tickets:read')) { router.replace('/inicio'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSede, filterEstado, filterCat, filterDoc]);

  async function load() {
    setLoading(true);
    try {
      const data = await listTickets({
        sede: filterSede || undefined,
        estado: filterEstado || undefined,
        categoria: filterCat || undefined,
        documento: filterDoc || undefined,
      });
      setTickets(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  const openTicket = (t: TicketOut) => {
    setSelected(t);
    setMgmtEstado(t.estado);
    setMgmtPrioridad(t.prioridad);
    setMgmtResolucion(t.resolucion ?? '');
    setComentario('');
    setEsInterno(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    setMgmtSaving(true);
    try {
      const body: TicketUpdate = {};
      if (mgmtEstado !== selected.estado) body.estado = mgmtEstado;
      if (mgmtPrioridad !== selected.prioridad) body.prioridad = mgmtPrioridad;
      if (mgmtResolucion !== (selected.resolucion ?? '')) body.resolucion = mgmtResolucion;
      const updated = await updateTicket(selected.id, body);
      setSelected(updated);
      setTickets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    } finally {
      setMgmtSaving(false);
    }
  };

  const handleComment = async () => {
    if (!selected || !comentario.trim()) return;
    setCommentSaving(true);
    try {
      const nuevo = await addComentario(selected.id, { contenido: comentario.trim(), es_interno: esInterno });
      const updatedSelected = { ...selected, comentarios: [...selected.comentarios, nuevo] };
      setSelected(updatedSelected);
      setTickets((prev) => prev.map((t) => t.id === selected.id ? updatedSelected : t));
      setComentario('');
    } finally {
      setCommentSaving(false);
    }
  };

  const canWrite = hasPermission('tickets:write');

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Soporte</p>
          <h1 className="mt-1 text-3xl font-bold">Tickets <span className="ml-2 text-lg font-normal text-slate-500">({total})</span></h1>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap gap-3">
          <input placeholder="Sede..." value={filterSede} onChange={(e) => setFilterSede(e.target.value)} className="w-36" />
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="w-44">
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="w-40">
            <option value="">Todas las categorías</option>
            {['Incidente', 'Solicitud', 'Consulta'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <div className="relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              placeholder="Buscar por cédula..."
              value={filterDoc}
              onChange={(e) => setFilterDoc(e.target.value)}
              className="w-48 pl-8"
            />
          </div>
          {(filterSede || filterEstado || filterCat || filterDoc) && (
            <button
              onClick={() => { setFilterSede(''); setFilterEstado(''); setFilterCat(''); setFilterDoc(''); }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <div className={`flex gap-4 ${selected ? 'lg:flex-row' : ''}`}>
          {/* Table */}
          <div className={`${selected ? 'hidden lg:block lg:w-1/2' : 'w-full'} overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-3">Nro</th>
                  <th className="px-4 py-3">Empleado</th>
                  <th className="px-4 py-3">Sede</th>
                  <th className="px-4 py-3">Asunto</th>
                  <th className="px-4 py-3">Prioridad</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Cargando…</td></tr>
                ) : tickets.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin tickets</td></tr>
                ) : tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => openTicket(t)}
                    className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${selected?.id === t.id ? 'bg-cyan-50 dark:bg-cyan-900/10' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.numero}</td>
                    <td className="px-4 py-3 font-medium">{t.empleado_nombre}</td>
                    <td className="px-4 py-3 text-slate-500">{t.sede}</td>
                    <td className="max-w-xs truncate px-4 py-3">{t.asunto}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIO_COLOR[t.prioridad] ?? ''}`}>{t.prioridad}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoColor(t.estado)}`}>{estadoLabel(t.estado)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Drawer */}
          {selected && (
            <div className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:w-1/2 lg:overflow-y-auto lg:max-h-[calc(100vh-12rem)]">
              <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div>
                  <p className="font-mono text-xs text-slate-400">{selected.numero}</p>
                  <h2 className="font-semibold">{selected.asunto}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">{selected.empleado_nombre} · {selected.sede} · {selected.documento_identidad}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-5 px-5 py-4">
                {/* Meta */}
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoColor(selected.estado)}`}>{estadoLabel(selected.estado)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIO_COLOR[selected.prioridad] ?? ''}`}>{selected.prioridad}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">{selected.categoria}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-700">{selected.tipo_solicitud}</span>
                </div>

                {/* Descripción */}
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-slate-500">Descripción</p>
                  <p className="whitespace-pre-wrap text-sm">{selected.descripcion}</p>
                </div>

                {/* Equipos */}
                {selected.equipos.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase text-slate-500">Equipos relacionados</p>
                    <div className="space-y-1">
                      {selected.equipos.map((e) => (
                        <Link
                          key={e.id}
                          href={`/equipos/${e.id}/hoja-de-vida`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm transition-colors hover:border-cyan-200 hover:bg-cyan-50 dark:border-slate-800 dark:bg-slate-800/50 dark:hover:border-cyan-800 dark:hover:bg-cyan-900/20"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs text-slate-400 shrink-0">{e.codigo_interno}</span>
                            <span className="truncate">{e.marca} {e.modelo}</span>
                            <span className="text-xs text-slate-400 shrink-0">{e.tipo}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-xs text-slate-400">{e.estado}</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 text-slate-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolución */}
                {selected.resolucion && (
                  <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-900/20">
                    <p className="mb-1 text-xs font-medium uppercase text-emerald-700 dark:text-emerald-400">Resolución</p>
                    <p className="whitespace-pre-wrap text-sm">{selected.resolucion}</p>
                  </div>
                )}

                {/* Comentarios */}
                {selected.comentarios.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-slate-500">Comentarios</p>
                    <div className="space-y-2">
                      {selected.comentarios.map((c: ComentarioOut) => (
                        <div key={c.id} className={`rounded-lg px-3 py-2 text-sm ${c.es_interno ? 'bg-amber-50 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-slate-50 dark:bg-slate-800'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-xs">{c.autor_nombre}</span>
                            <div className="flex items-center gap-2">
                              {c.es_interno && <span className="text-xs text-amber-600 dark:text-amber-400">Interno</span>}
                              <span className="text-xs text-slate-400">{formatDate(c.created_at)}</span>
                            </div>
                          </div>
                          <p className="whitespace-pre-wrap">{c.contenido}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add comment */}
                {canWrite && (
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <p className="mb-2 text-xs font-medium uppercase text-slate-500">Agregar comentario</p>
                    <textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      rows={3}
                      placeholder="Escribe un comentario..."
                      className="w-full"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={esInterno} onChange={(e) => setEsInterno(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                        Interno (solo TI)
                      </label>
                      <button
                        onClick={handleComment}
                        disabled={commentSaving || !comentario.trim()}
                        className="rounded-lg bg-cyan-600 px-3 py-1 text-xs text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 disabled:opacity-50"
                      >
                        {commentSaving ? 'Enviando…' : 'Enviar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Management */}
                {canWrite && (
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <p className="mb-3 text-xs font-medium uppercase text-slate-500">Gestión del ticket</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label>Estado</label>
                        <select value={mgmtEstado} onChange={(e) => setMgmtEstado(e.target.value)}>
                          {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>Prioridad</label>
                        <select value={mgmtPrioridad} onChange={(e) => setMgmtPrioridad(e.target.value)}>
                          {PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label>Resolución</label>
                      <textarea
                        value={mgmtResolucion}
                        onChange={(e) => setMgmtResolucion(e.target.value)}
                        rows={2}
                        placeholder="Describe cómo se resolvió..."
                        className="w-full"
                      />
                    </div>
                    <button
                      onClick={handleSave}
                      disabled={mgmtSaving}
                      className="mt-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 disabled:opacity-50"
                    >
                      {mgmtSaving ? 'Guardando…' : 'Guardar cambios'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
