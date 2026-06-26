"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import {
  ComentarioPortalOut,
  EquipoBrief,
  RedWifiOut,
  TicketPortalDetailOut,
  TicketPortalOut,
  VerificarResponse,
  addComentarioPortal,
  crearTicketPublico,
  getTicketPortalDetail,
  getTicketsPortal,
  logWifiVista,
  uploadImagenesPortal,
  verificarEmpleado,
} from '@/lib/api';
import { ImageFile, ImageGallery, ImagePicker } from '@/components/image-picker';

const CATEGORIAS = ['Incidente', 'Solicitud', 'Consulta'];
const TIPOS_SOLICITUD = ['Hardware', 'Software', 'Red', 'Acceso', 'Otro'];
const PRIORIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];

const ESTADO_BADGE: Record<string, string> = {
  abierto:           'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  en_revision:       'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
  en_proceso:        'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  pendiente_usuario: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  resuelto:          'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  cerrado:           'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};
const ESTADO_LABEL: Record<string, string> = {
  abierto: 'Abierto', en_revision: 'En revisión', en_proceso: 'En proceso',
  pendiente_usuario: 'Pend. usuario', resuelto: 'Resuelto', cerrado: 'Cerrado',
};
const PRIORIDAD_DOT: Record<string, string> = {
  Urgente: 'bg-red-500', Crítica: 'bg-red-500', Alta: 'bg-orange-500',
  Media: 'bg-amber-400', Baja: 'bg-slate-400',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── WifiCard ─────────────────────────────────────────────────────────────────

function WifiCard({ red, documento }: { red: RedWifiOut; documento: string }) {
  const [visible, setVisible] = useState(false);

  const reveal = () => {
    if (!visible) logWifiVista(documento, red.id).catch(() => {});
    setVisible((v) => !v);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm">{red.nombre_red}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {red.sede}{red.tipo_red ? ` · ${red.tipo_red}` : ''}
          </p>
        </div>
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
          </svg>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <code className="flex-1 rounded bg-white px-2 py-1 text-sm font-mono dark:bg-slate-900">
          {visible ? red.contrasena : '••••••••••••'}
        </code>
        <button type="button" onClick={reveal} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
          {visible ? 'Ocultar' : 'Ver'}
        </button>
      </div>
      {red.descripcion && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{red.descripcion}</p>}
    </div>
  );
}

// ── TicketDetailModal ─────────────────────────────────────────────────────────

function TicketDetailModal({
  ticket,
  documento,
  onClose,
  onComentarioAdded,
}: {
  ticket: TicketPortalDetailOut;
  documento: string;
  onClose: () => void;
  onComentarioAdded: (c: ComentarioPortalOut) => void;
}) {
  const [comentario, setComentario] = useState('');
  const [adjuntos, setAdjuntos] = useState<ImageFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comentario.trim()) return;
    setSaving(true);
    setError('');
    try {
      const nuevo = await addComentarioPortal(ticket.id, documento, comentario.trim());
      if (adjuntos.length > 0) {
        await uploadImagenesPortal(ticket.id, documento, adjuntos.map((a) => a.file)).catch(() => {});
      }
      onComentarioAdded(nuevo);
      setComentario('');
      setAdjuntos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSaving(false);
    }
  };

  const estadoCls = ESTADO_BADGE[ticket.estado] ?? 'bg-slate-100 text-slate-600';
  const estadoLbl = ESTADO_LABEL[ticket.estado] ?? ticket.estado;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-0 sm:px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="min-w-0 flex-1 pr-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-slate-400">{ticket.numero}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoCls}`}>{estadoLbl}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {ticket.categoria} · {ticket.tipo_solicitud}
              </span>
            </div>
            <h2 className="text-base font-semibold leading-snug">{ticket.asunto}</h2>
            {ticket.asignado_a_nombre && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Atendido por: {ticket.asignado_a_nombre}</p>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Descripción */}
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Descripción</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{ticket.descripcion}</p>
          </div>

          {/* Fotos adjuntas */}
          {ticket.imagenes.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Fotos adjuntas ({ticket.imagenes.length})
              </p>
              <ImageGallery urls={ticket.imagenes.map((i) => i.url)} />
            </div>
          )}

          {/* Resolución */}
          {ticket.resolucion && (
            <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/20">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Resolución del equipo TI</p>
              <p className="whitespace-pre-wrap text-sm text-emerald-900 dark:text-emerald-200">{ticket.resolucion}</p>
            </div>
          )}

          {/* Comentarios */}
          {ticket.comentarios.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Conversación ({ticket.comentarios.length})
              </p>
              <div className="space-y-2">
                {ticket.comentarios.map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{c.autor_nombre}</span>
                      <span className="text-xs text-slate-400">{formatDate(c.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{c.contenido}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agregar comentario */}
          <form onSubmit={handleEnviar} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {ticket.estado === 'pendiente_usuario' ? 'Tu respuesta es requerida' : 'Agregar comentario o consulta'}
            </p>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              placeholder="Escribe tu consulta o respuesta aquí…"
              className="w-full"
            />
            <ImagePicker images={adjuntos} onChange={setAdjuntos} maxFiles={3} className="mt-3" />
            {error && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                disabled={saving || (!comentario.trim() && adjuntos.length === 0)}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950"
              >
                {saving ? 'Enviando…' : 'Enviar mensaje'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── TicketRow ────────────────────────────────────────────────────────────────

function TicketRow({ t, onClick }: { t: TicketPortalOut; onClick: () => void }) {
  const dot = PRIORIDAD_DOT[t.prioridad] ?? PRIORIDAD_DOT.Media;
  const badge = ESTADO_BADGE[t.estado] ?? 'bg-slate-100 text-slate-600';
  const label = ESTADO_LABEL[t.estado] ?? t.estado;
  const fecha = new Date(t.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  const isPendiente = t.estado === 'pendiente_usuario';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3 transition-shadow hover:shadow-md dark:hover:shadow-slate-900
        ${isPendiente
          ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-900/20'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50'
        }`}
    >
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">{t.numero}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>{label}</span>
          {isPendiente && (
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white">Requiere tu respuesta</span>
          )}
        </div>
        <p className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{t.asunto}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span>{fecha}</span>
          {t.asignado_a_nombre
            ? <span>→ {t.asignado_a_nombre}</span>
            : <span className="text-amber-500">Sin asignar</span>}
        </div>
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-1 h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </button>
  );
}

// ── MisTickets ───────────────────────────────────────────────────────────────

function MisTickets({ documento }: { documento: string }) {
  const [tickets, setTickets] = useState<TicketPortalOut[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TicketPortalDetailOut | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    getTicketsPortal(documento).then(setTickets).catch(() => {});
  }, [documento]);

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const d = await getTicketPortalDetail(id);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleComentarioAdded = (c: ComentarioPortalOut) => {
    if (!detail) return;
    setDetail({ ...detail, comentarios: [...detail.comentarios, c] });
  };

  const closeModal = () => {
    setSelectedId(null);
    setDetail(null);
    // Refrescar la lista para actualizar badges de estado
    getTicketsPortal(documento).then(setTickets).catch(() => {});
  };

  return (
    <>
      {(selectedId !== null) && (
        loadingDetail
          ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-500" />
            </div>
          )
          : detail && (
            <TicketDetailModal
              ticket={detail}
              documento={documento}
              onClose={closeModal}
              onComentarioAdded={handleComentarioAdded}
            />
          )
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 text-cyan-600 dark:text-cyan-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          <h2 className="font-semibold">Mis tickets recientes</h2>
          {tickets.length > 0 && (
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {tickets.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No tienes tickets registrados aún.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <TicketRow key={t.id} t={t} onClick={() => openDetail(t.id)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── PortalContent ────────────────────────────────────────────────────────────

function PortalContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [step, setStep] = useState<'input' | 'portal' | 'confirmacion'>('input');
  const [documento, setDocumento] = useState('');
  const [data, setData] = useState<VerificarResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [categoria, setCategoria] = useState('Incidente');
  const [tipoSolicitud, setTipoSolicitud] = useState('Hardware');
  const [asunto, setAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState('Media');
  const [selectedEquipos, setSelectedEquipos] = useState<number[]>([]);
  const [ticketImagenes, setTicketImagenes] = useState<ImageFile[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const [ticketNumero, setTicketNumero] = useState('');

  const docParam = searchParams.get('doc');
  useEffect(() => {
    if (docParam && step === 'input') {
      setDocumento(docParam);
      verificar(docParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docParam]);

  async function verificar(doc: string) {
    setLoading(true);
    setError('');
    try {
      const result = await verificarEmpleado(doc);
      setData(result);
      setStep('portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar');
    } finally {
      setLoading(false);
    }
  }

  const handleVerificar = async (e: React.FormEvent) => {
    e.preventDefault();
    await verificar(documento.trim());
  };

  const toggleEquipo = (id: number) => {
    setSelectedEquipos((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketLoading(true);
    setTicketError('');
    try {
      const result = await crearTicketPublico({
        documento,
        categoria,
        tipo_solicitud: tipoSolicitud,
        asunto,
        descripcion,
        prioridad,
        equipment_ids: selectedEquipos,
      });
      if (ticketImagenes.length > 0) {
        await uploadImagenesPortal(result.id, documento, ticketImagenes.map((i) => i.file)).catch(() => {});
      }
      setTicketNumero(result.numero);
      setStep('confirmacion');
    } catch (err) {
      setTicketError(err instanceof Error ? err.message : 'Error al crear ticket');
    } finally {
      setTicketLoading(false);
    }
  };

  const resetTicket = () => {
    setAsunto(''); setDescripcion(''); setCategoria('Incidente');
    setTipoSolicitud('Hardware'); setPrioridad('Media');
    setSelectedEquipos([]); setTicketImagenes([]); setTicketError('');
    setStep('portal');
  };

  const allEquipos: (EquipoBrief & { origen: string })[] = [
    ...(data?.equipos_asignados ?? []).map((e) => ({ ...e, origen: 'Asignado' })),
    ...(data?.equipos_bodega ?? []).map((e) => ({ ...e, origen: e.bodega_nombre ?? 'Bodega' })),
  ];

  // ── Step: input ─────────────────────────────────────────────────────────

  if (step === 'input') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Portal empleados</p>
          <h1 className="mt-2 text-2xl font-bold">Ingreso</h1>
          <p className="mt-2 mb-6 text-sm text-slate-600 dark:text-slate-300">Ingresa tu número de cédula para acceder.</p>
          <form onSubmit={handleVerificar} className="space-y-4">
            <div>
              <label htmlFor="doc">Número de documento</label>
              <input id="doc" type="text" value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Ej: 12345678" required />
            </div>
            {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>}
            <button type="submit" className="w-full py-3 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400" disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar'}
            </button>
            <button type="button" onClick={() => router.push('/login')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
              ← Volver al inicio de sesión
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ── Step: confirmacion ───────────────────────────────────────────────────

  if (step === 'confirmacion') {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm items-center justify-center px-4">
        <div className="w-full rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-2xl dark:border-emerald-700 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8 text-emerald-600 dark:text-emerald-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">¡Ticket creado!</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">Tu solicitud fue registrada con el número</p>
          <p className="mt-1 text-2xl font-mono font-bold text-cyan-700 dark:text-cyan-400">{ticketNumero}</p>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">El equipo de soporte la atenderá pronto.</p>
          <div className="mt-6 flex flex-col gap-2">
            <button onClick={resetTicket} className="w-full py-2 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950">
              Crear otro ticket
            </button>
            <button onClick={() => setStep('portal')} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400">
              Ver mis tickets
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ── Step: portal ─────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Portal empleados</p>
            <h1 className="mt-0.5 text-lg font-bold">
              {data?.empleado.nombres} {data?.empleado.apellidos}
              <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                · {data?.empleado.sede} · {data?.empleado.cargo}
              </span>
            </h1>
          </div>
          <button type="button" onClick={() => { setStep('input'); setDocumento(''); setData(null); }} className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            ← Cambiar documento
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* WiFi (1 col) + Formulario ticket (2 cols) */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 text-cyan-600 dark:text-cyan-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
              </svg>
              <h2 className="font-semibold">Redes WiFi</h2>
            </div>
            {data?.redes_wifi.length === 0
              ? <p className="text-sm text-slate-500 dark:text-slate-400">No hay redes WiFi registradas.</p>
              : <div className="space-y-3">{data?.redes_wifi.map((red) => <WifiCard key={red.id} red={red} documento={documento} />)}</div>
            }
          </div>

          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 text-cyan-600 dark:text-cyan-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" />
              </svg>
              <h2 className="font-semibold">Crear ticket de soporte</h2>
            </div>
            <form onSubmit={handleTicket} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="cat">Categoría</label>
                  <select id="cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="tipo">Tipo</label>
                  <select id="tipo" value={tipoSolicitud} onChange={(e) => setTipoSolicitud(e.target.value)}>
                    {TIPOS_SOLICITUD.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="prio">Prioridad</label>
                  <select id="prio" value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                    {PRIORIDADES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="asunto">Asunto</label>
                <input id="asunto" type="text" value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Descripción breve del problema o solicitud" required className="w-full" />
              </div>
              <div>
                <label htmlFor="desc">Descripción detallada</label>
                <textarea id="desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} placeholder="Describe con detalle el problema: qué ocurre, desde cuándo, qué has intentado…" required className="w-full" />
              </div>
              {allEquipos.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Equipos relacionados <span className="font-normal text-slate-500">(opcional)</span></label>
                  <div className="grid gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-800">
                    {allEquipos.map((eq) => (
                      <label key={eq.id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" checked={selectedEquipos.includes(eq.id)} onChange={() => toggleEquipo(eq.id)} className="h-4 w-4 rounded border-slate-300" />
                        <span className="font-mono text-xs text-slate-500">{eq.codigo_interno}</span>
                        <span className="truncate">{eq.marca} {eq.modelo}</span>
                        <span className="ml-auto shrink-0 text-xs text-slate-400">{eq.origen}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {/* Imágenes adjuntas */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Fotos del problema <span className="font-normal text-slate-500">(opcional)</span>
                </label>
                <ImagePicker images={ticketImagenes} onChange={setTicketImagenes} maxFiles={5} />
              </div>

              {ticketError && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{ticketError}</p>}
              <button type="submit" className="w-full py-3 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400" disabled={ticketLoading}>
                {ticketLoading ? 'Enviando...' : 'Enviar ticket'}
              </button>
            </form>
          </div>
        </div>

        {/* Mis tickets recientes (full width) */}
        <MisTickets documento={documento} />
      </div>
    </main>
  );
}

export default function PortalPage() {
  return (
    <Suspense>
      <PortalContent />
    </Suspense>
  );
}
