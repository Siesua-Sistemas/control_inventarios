"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { PhotoGrid } from '@/components/photo-grid';
import {
  MOTIVOS_BAJA,
  createBaja,
  deleteBajaFoto,
  getEquipment,
  isAuthenticated,
  uploadBajaFoto,
  type BajaFotoOut,
  type EquipmentRow,
} from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Step = 'form' | 'evidencia' | 'listo';

export default function DarDeBajaPage() {
  const { id } = useParams<{ id: string }>();
  const equipmentId = Number(id);
  const router = useRouter();

  const [equipo, setEquipo] = useState<EquipmentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('form');

  const [motivo, setMotivo] = useState('');
  const [motivoDetalle, setMotivoDetalle] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  const [bajaId, setBajaId] = useState<number | null>(null);
  const [fotos, setFotos] = useState<BajaFotoOut[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    getEquipment(equipmentId)
      .then(setEquipo)
      .catch(() => setError('No se pudo cargar el equipo.'))
      .finally(() => setLoading(false));
  }, [equipmentId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!motivo) { setFormMsg('Selecciona un motivo.'); return; }
    if (motivo === 'otro' && !motivoDetalle.trim()) { setFormMsg('Describe el motivo.'); return; }
    setSaving(true);
    setFormMsg('');
    try {
      const baja = await createBaja({
        equipment_id: equipmentId,
        motivo,
        motivo_detalle: motivoDetalle.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
      });
      setBajaId(baja.id);
      setFotos(baja.fotos);
      setStep('evidencia');
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : 'Error al registrar la solicitud');
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadPhoto(file: File) {
    if (!bajaId) return;
    setUploadingPhoto(true);
    try {
      const foto = await uploadBajaFoto(bajaId, file);
      setFotos((prev) => [...prev, foto]);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeletePhoto(fotoId: number) {
    if (!bajaId) return;
    await deleteBajaFoto(bajaId, fotoId);
    setFotos((prev) => prev.filter((f) => f.id !== fotoId));
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-slate-600 dark:text-slate-400">Cargando equipo...</p>
        </main>
      </>
    );
  }

  if (error || !equipo) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
          <p className="rounded-md bg-red-100 px-4 py-2 text-red-700 dark:bg-red-500/20 dark:text-red-200">{error || 'Equipo no encontrado'}</p>
          <Link href="/equipos" className="text-cyan-600 hover:underline dark:text-cyan-400">Volver a equipos</Link>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <nav className="mb-6 text-sm text-slate-500">
          <Link href={`/equipos/${equipmentId}/hoja-de-vida`} className="hover:text-cyan-600 dark:hover:text-cyan-400">
            {equipo.codigo_interno}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 dark:text-slate-300">Dar de baja</span>
        </nav>

        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-red-600 dark:text-red-400">Baja de equipo</p>
          <h1 className="mt-1 text-3xl font-bold">{equipo.marca} {equipo.modelo}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500">{equipo.codigo_interno} · S/N {equipo.serial}</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/40 dark:bg-slate-900">
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Esta solicitud queda <strong>pendiente de aprobación</strong> por un supervisor. El equipo no se elimina —
                si se aprueba, queda marcado como <strong>Dado de baja</strong>.
              </p>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Motivo *</label>
                <select
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">— Selecciona un motivo —</option>
                  {MOTIVOS_BAJA.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {motivo === 'otro' ? 'Describe el motivo *' : 'Detalle (opcional)'}
                </label>
                <textarea
                  rows={3}
                  value={motivoDetalle}
                  onChange={(e) => setMotivoDetalle(e.target.value)}
                  required={motivo === 'otro'}
                  placeholder={motivo === 'otro' ? 'Explica por qué se da de baja este equipo' : 'Detalles adicionales del motivo seleccionado'}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Observaciones</label>
                <textarea
                  rows={2}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Notas adicionales (opcional)"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-red-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                />
              </div>

              {formMsg && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{formMsg}</p>}

              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Continuar → agregar evidencia'}
                </button>
                <Link href={`/equipos/${equipmentId}/hoja-de-vida`} className="rounded-md bg-slate-200 px-5 py-2 text-sm text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                  Cancelar
                </Link>
              </div>
            </form>
          )}

          {step === 'evidencia' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Sube al menos una foto que respalde el motivo de la baja. El supervisor no podrá aprobarla sin evidencia.
              </p>
              <PhotoGrid
                photos={fotos}
                apiBase={API_BASE}
                onUpload={handleUploadPhoto}
                onDelete={handleDeletePhoto}
                uploading={uploadingPhoto}
              />
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">{fotos.length} foto{fotos.length !== 1 ? 's' : ''} cargada{fotos.length !== 1 ? 's' : ''}</span>
                <button
                  type="button"
                  onClick={() => setStep('listo')}
                  disabled={fotos.length === 0}
                  className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Finalizar solicitud
                </button>
              </div>
            </div>
          )}

          {step === 'listo' && (
            <div className="space-y-4 text-center">
              <p className="text-2xl">✅</p>
              <p className="font-semibold text-slate-800 dark:text-slate-200">Solicitud de baja enviada</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Queda pendiente de aprobación. Te avisaremos cuando un supervisor la revise.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Link href={`/equipos/${equipmentId}/hoja-de-vida`} className="rounded-md bg-slate-200 px-5 py-2 text-sm text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                  Volver a la hoja de vida
                </Link>
                <Link href="/equipos/bajas" className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500">
                  Ver solicitudes de baja
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
