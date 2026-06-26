"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { DatePickerPresets } from '@/components/date-picker-presets';
import { MantenimientoModal } from '@/components/mantenimiento-modal';
import { NavBar } from '@/components/nav-bar';
import { PhotoGrid } from '@/components/photo-grid';
import { SignaturePad } from '@/components/signature-pad';
import {
  addPaso,
  aprobarMantenimiento,
  createCredencial,
  createEquipment,
  createMantenimiento,
  deleteCredencial,
  deleteEquipmentDocumento,
  deleteEquipmentPhoto,
  deleteMantenimiento,
  deleteMantenimientoPhoto,
  deletePaso,
  firmarTecnico,
  getEquipmentProfile,
  isAuthenticated,
  listCredenciales,
  listEquipment,
  listEquipmentTipos,
  listHistorial,
  listMantenimientos,
  revealCredencialPassword,
  setEquipmentParent,
  updateCredencial,
  updateEquipmentSpecs,
  updateMantenimiento,
  updatePaso,
  uploadEquipmentDocumento,
  uploadEquipmentPhoto,
  uploadMantenimientoPhoto,
  type AsignacionRow,
  type CredencialCreatePayload,
  type CredencialRow,
  type CredencialUpdatePayload,
  type EquipmentBrief,
  type EquipmentDocumentoOut,
  type EquipmentPhotoOut,
  type EquipmentProfile,
  type EquipmentTipo,
  type MantenimientoPayload,
  type MantenimientoRow,
  type PasoRow,
  type SpecField,
} from '@/lib/api';
import { ESTADO_COLORS } from '@/lib/constants';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Tab = 'ficha' | 'perifericos' | 'fotos' | 'documentos' | 'mantenimiento' | 'asignaciones' | 'credenciales';

// ── Ficha técnica tab ─────────────────────────────────────────────────────────

function FichaTab({
  profile,
  onSave,
}: {
  profile: EquipmentProfile;
  onSave: (specs: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(profile.equipment.specs ?? {});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const template = profile.specs_template;

  if (template.length === 0) {
    return (
      <div className="py-12 text-center text-slate-600 dark:text-slate-400">
        No hay ficha técnica definida para el tipo <strong>{profile.equipment.tipo}</strong>.
      </div>
    );
  }

  function renderField(field: SpecField) {
    const val = form[field.key];

    if (field.type === 'boolean') {
      return (
        <label key={field.key} className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 accent-cyan-400"
            checked={!!val}
            onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.checked }))}
          />
          <span>{field.label}</span>
        </label>
      );
    }

    if (field.type === 'scale') {
      const min = field.min ?? 1;
      const max = field.max ?? 5;
      const nums = Array.from({ length: max - min + 1 }, (_, i) => i + min);
      return (
        <div key={field.key} className="space-y-1">
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">{field.label}</label>
          <div className="flex gap-2">
            {nums.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm((p) => ({ ...p, [field.key]: n }))}
                className={`h-9 w-9 rounded-md border text-sm font-semibold transition-colors ${
                  val === n
                    ? 'border-cyan-500 bg-cyan-100 text-cyan-700 dark:border-cyan-400 dark:bg-cyan-500/20 dark:text-cyan-300'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-cyan-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (field.type === 'select' && field.options) {
      return (
        <div key={field.key} className="space-y-1">
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">{field.label}</label>
          <select
            value={(val as string) ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, [field.key]: e.target.value }))}
          >
            <option value="">-- Seleccionar --</option>
            {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-1">
        <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">{field.label}</label>
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={(val as string | number) ?? ''}
          placeholder={field.placeholder ?? ''}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              [field.key]: field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value,
            }))
          }
        />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      await onSave(form);
      setMsg('Ficha guardada correctamente.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      {template.map((field) => renderField(field))}
      {msg && (
        <p className={`rounded-md px-3 py-2 text-sm ${msg.includes('Error') ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'}`}>
          {msg}
        </p>
      )}
      <button type="submit" disabled={saving} className="bg-cyan-500 text-slate-950 font-semibold px-6 py-2 rounded-md hover:bg-cyan-400 disabled:opacity-50">
        {saving ? 'Guardando...' : 'Guardar ficha'}
      </button>
    </form>
  );
}

// ── Periféricos tab ────────────────────────────────────────────────────────────

function PerifeicosTab({
  equipmentId,
  profile,
  onRefresh,
}: {
  equipmentId: number;
  profile: EquipmentProfile;
  onRefresh: () => void;
}) {
  const [equipos, setEquipos] = useState<EquipmentBrief[]>([]);
  const [tiposPeriferico, setTiposPeriferico] = useState<EquipmentTipo[]>([]);
  const [parentSearch, setParentSearch] = useState('');
  const [childSearch, setChildSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Quick-create: nuevo periférico genérico
  const [showPerifModal, setShowPerifModal] = useState(false);
  const [perifForm, setPerifForm] = useState({ tipo: 'Accesorio', serial: '', marca: '', modelo: '' });
  const [perifSaving, setPerifSaving] = useState(false);

  // Quick-create: cargador
  const [showCargModal, setShowCargModal] = useState(false);
  const [cargForm, setCargForm] = useState({ marca: '', potencia: '' });
  const [cargSaving, setCargSaving] = useState(false);

  useEffect(() => {
    listEquipment().then((r) => setEquipos(r.items as unknown as EquipmentBrief[]));
    listEquipmentTipos().then((r) => {
      const active = r.items.filter((t) => t.es_periferico && t.activo);
      setTiposPeriferico(active);
      if (active.length && !active.some((t) => t.nombre === perifForm.tipo)) {
        setPerifForm((p) => ({ ...p, tipo: active[0].nombre }));
      }
    }).catch(() => null);
  }, []);

  const available = equipos.filter(
    (e) => e.id !== equipmentId && !profile.children.some((c) => c.id === e.id)
  );

  const filteredForParent = available.filter(
    (e) =>
      e.id.toString().includes(parentSearch) ||
      e.codigo_interno.toLowerCase().includes(parentSearch.toLowerCase()) ||
      e.marca.toLowerCase().includes(parentSearch.toLowerCase()) ||
      e.modelo.toLowerCase().includes(parentSearch.toLowerCase())
  );

  const filteredForChild = available.filter(
    (e) =>
      e.codigo_interno.toLowerCase().includes(childSearch.toLowerCase()) ||
      e.marca.toLowerCase().includes(childSearch.toLowerCase()) ||
      e.modelo.toLowerCase().includes(childSearch.toLowerCase())
  );

  const parentBase = {
    sede: profile.equipment.sede,
    bodega_id: profile.equipment.bodega_id,
    ubicacion: profile.equipment.ubicacion,
    estado: 'En bodega' as const,
    criticidad: 'Baja' as const,
    imei: null, placa: null, empleado_id: null, parent_equipment_id: null,
    fecha_compra: null, valor: null, proveedor: null,
    numero_factura: null, garantia_vence: null, observaciones: null, specs: null,
    fecha_calibracion: null, vencimiento_calibracion: null, frecuencia_calibracion_meses: null,
  };

  async function assignParent(parentId: number | null) {
    setLoading(true);
    setMsg('');
    try {
      await setEquipmentParent(equipmentId, parentId);
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function assignChild(childId: number) {
    setLoading(true);
    setMsg('');
    try {
      await setEquipmentParent(childId, equipmentId);
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function removeChild(childId: number) {
    setLoading(true);
    setMsg('');
    try {
      await setEquipmentParent(childId, null);
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePeiferico(e: React.FormEvent) {
    e.preventDefault();
    if (!perifForm.serial.trim() || !perifForm.marca.trim() || !perifForm.modelo.trim()) return;
    setPerifSaving(true);
    setMsg('');
    try {
      const eq = await createEquipment({ ...parentBase, ...perifForm });
      await setEquipmentParent(eq.id, equipmentId);
      setShowPerifModal(false);
      setPerifForm({ tipo: 'Accesorio', serial: '', marca: '', modelo: '' });
      listEquipment().then((r) => setEquipos(r.items as unknown as EquipmentBrief[]));
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al crear periférico');
    } finally {
      setPerifSaving(false);
    }
  }

  async function handleCreateCargador(e: React.FormEvent) {
    e.preventDefault();
    if (!cargForm.marca.trim() || !cargForm.potencia) return;
    setCargSaving(true);
    setMsg('');
    try {
      const serial = `CARG-${Date.now()}`;
      const eq = await createEquipment({
        ...parentBase,
        tipo: 'Accesorio',
        serial,
        marca: cargForm.marca,
        modelo: `Cargador ${cargForm.potencia}W`,
        specs: { potencia_w: Number(cargForm.potencia) },
      });
      await setEquipmentParent(eq.id, equipmentId);
      setShowCargModal(false);
      setCargForm({ marca: '', potencia: '' });
      listEquipment().then((r) => setEquipos(r.items as unknown as EquipmentBrief[]));
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al crear cargador');
    } finally {
      setCargSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {msg && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{msg}</p>}

      {/* Parent */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Equipo padre</h3>
        {profile.parent ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400">{profile.parent.codigo_interno}</span>
              <span className="ml-2 text-slate-800 dark:text-slate-200">{profile.parent.marca} {profile.parent.modelo}</span>
              <span className="ml-2 text-xs text-slate-500">{profile.parent.tipo}</span>
            </div>
            <button
              onClick={() => assignParent(null)}
              disabled={loading}
              className="rounded-md bg-red-100 px-3 py-1 text-xs text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/40 disabled:opacity-50"
            >
              Desvincular
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Sin equipo padre asignado.</p>
            <input
              type="text"
              placeholder="Buscar equipo padre..."
              value={parentSearch}
              onChange={(e) => setParentSearch(e.target.value)}
              className="w-full"
            />
            {parentSearch && (
              <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-sm">
                {filteredForParent.slice(0, 10).map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => { setParentSearch(''); assignParent(e.id); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400">{e.codigo_interno}</span>
                      <span>{e.marca} {e.modelo}</span>
                      <span className="ml-auto text-xs text-slate-500">{e.tipo}</span>
                    </button>
                  </li>
                ))}
                {filteredForParent.length === 0 && <li className="px-3 py-2 text-slate-500">Sin resultados</li>}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Children */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Periféricos / Accesorios asociados ({profile.children.length})
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowCargModal(true); setShowPerifModal(false); }}
              className="rounded-md bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/40"
            >
              ⚡ Nuevo cargador
            </button>
            <button
              type="button"
              onClick={() => { setShowPerifModal(true); setShowCargModal(false); }}
              className="rounded-md bg-cyan-100 px-3 py-1.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:hover:bg-cyan-500/40"
            >
              + Nuevo periférico
            </button>
          </div>
        </div>

        {/* Modal: Nuevo periférico */}
        {showPerifModal && (
          <form onSubmit={handleCreatePeiferico} className="mb-4 rounded-lg border border-cyan-300 bg-cyan-50 p-4 space-y-3 dark:border-cyan-800/50 dark:bg-slate-950">
            <p className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">Crear periférico y asociar</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs text-slate-600 dark:text-slate-400">Tipo</label>
                <select value={perifForm.tipo} onChange={(e) => setPerifForm((p) => ({ ...p, tipo: e.target.value }))}>
                  {tiposPeriferico.map((t) => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-600 dark:text-slate-400">Serial *</label>
                <input
                  type="text"
                  placeholder="Ej: SN-ABC123"
                  value={perifForm.serial}
                  onChange={(e) => setPerifForm((p) => ({ ...p, serial: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-600 dark:text-slate-400">Marca *</label>
                <input
                  type="text"
                  placeholder="Ej: Logitech"
                  value={perifForm.marca}
                  onChange={(e) => setPerifForm((p) => ({ ...p, marca: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-600 dark:text-slate-400">Modelo *</label>
                <input
                  type="text"
                  placeholder="Ej: MX Master 3"
                  value={perifForm.modelo}
                  onChange={(e) => setPerifForm((p) => ({ ...p, modelo: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={perifSaving} className="rounded-md bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
                {perifSaving ? 'Creando...' : 'Crear y asociar'}
              </button>
              <button type="button" onClick={() => setShowPerifModal(false)} className="rounded-md bg-slate-200 px-4 py-1.5 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Modal: Nuevo cargador */}
        {showCargModal && (
          <form onSubmit={handleCreateCargador} className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3 dark:border-amber-800/50 dark:bg-slate-950">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">⚡ Crear cargador y asociar</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs text-slate-600 dark:text-slate-400">Marca *</label>
                <input
                  type="text"
                  placeholder="Ej: Lenovo, Apple, Samsung"
                  value={cargForm.marca}
                  onChange={(e) => setCargForm((p) => ({ ...p, marca: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-600 dark:text-slate-400">Potencia (W) *</label>
                <input
                  type="number"
                  min="1"
                  placeholder="Ej: 65"
                  value={cargForm.potencia}
                  onChange={(e) => setCargForm((p) => ({ ...p, potencia: e.target.value }))}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">El serial se generará automáticamente. Podrás editarlo luego.</p>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={cargSaving} className="rounded-md bg-amber-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-50">
                {cargSaving ? 'Creando...' : 'Crear y asociar'}
              </button>
              <button type="button" onClick={() => setShowCargModal(false)} className="rounded-md bg-slate-200 px-4 py-1.5 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {profile.children.length > 0 && (
          <ul className="mb-4 space-y-2">
            {profile.children.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
                <div>
                  <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400">{c.codigo_interno}</span>
                  <span className="ml-2 text-slate-800 dark:text-slate-200">{c.marca} {c.modelo}</span>
                  <span className="ml-2 text-xs text-slate-500">{c.tipo}</span>
                </div>
                <button
                  onClick={() => removeChild(c.id)}
                  disabled={loading}
                  className="rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/40 disabled:opacity-50"
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <input
            type="text"
            placeholder="O buscar un equipo existente para asociar..."
            value={childSearch}
            onChange={(e) => setChildSearch(e.target.value)}
            className="w-full"
          />
          {childSearch && (
            <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 text-sm">
              {filteredForChild.slice(0, 10).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => { setChildSearch(''); assignChild(e.id); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400">{e.codigo_interno}</span>
                    <span>{e.marca} {e.modelo}</span>
                    <span className="ml-auto text-xs text-slate-500">{e.tipo}</span>
                  </button>
                </li>
              ))}
              {filteredForChild.length === 0 && <li className="px-3 py-2 text-slate-500">Sin resultados</li>}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Fotos tab ─────────────────────────────────────────────────────────────────

function FotosTab({
  equipmentId,
  photos,
  onRefresh,
}: {
  equipmentId: number;
  photos: EquipmentPhotoOut[];
  onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleUpload(file: File) {
    setUploading(true);
    setMsg('');
    try {
      await uploadEquipmentPhoto(equipmentId, file);
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId: number) {
    if (!window.confirm('¿Eliminar esta foto?')) return;
    try {
      await deleteEquipmentPhoto(equipmentId, photoId);
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{msg}</p>}

      <PhotoGrid
        photos={photos}
        apiBase={API_BASE}
        onUpload={handleUpload}
        onDelete={handleDelete}
        uploading={uploading}
      />
    </div>
  );
}

// ── Mantenimiento tab ─────────────────────────────────────────────────────────

const EMPTY_MANT: MantenimientoPayload = {
  equipment_id: 0,
  tipo: 'Preventivo',
  fecha: new Date().toISOString().split('T')[0],
  tecnico: '',
  descripcion: '',
  costo: undefined,
  observaciones: '',
  proximo_mantenimiento: '',
  prioridad: 'Media',
};

const PRIORIDAD_BADGE: Record<string, string> = {
  Alta: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  Media: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  Baja: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

const ESTADO_OT_BADGE: Record<string, string> = {
  programado: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  realizado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  cancelado: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  pendiente_aprobacion: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  aprobado: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  rechazado: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
};

function ChecklistSection({
  mantenimientoId,
  pasos,
  canWrite,
  onRefresh,
}: {
  mantenimientoId: number;
  pasos: PasoRow[];
  canWrite: boolean;
  onRefresh: () => void;
}) {
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);
  const total = pasos.length;
  const done = pasos.filter((p) => p.completado).length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newDesc.trim()) return;
    setAdding(true);
    try {
      await addPaso(mantenimientoId, newDesc.trim(), total);
      setNewDesc('');
      onRefresh();
    } finally { setAdding(false); }
  }

  async function toggle(paso: PasoRow) {
    await updatePaso(mantenimientoId, paso.id, { completado: !paso.completado });
    onRefresh();
  }

  async function remove(pasoId: number) {
    await deletePaso(mantenimientoId, pasoId);
    onRefresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Checklist {total > 0 && <span className="ml-1 text-slate-400">({done}/{total})</span>}
        </h5>
        {total > 0 && (
          <div className="h-1.5 w-24 rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-1.5 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>
      {pasos.map((paso) => (
        <div key={paso.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/40">
          <input
            type="checkbox"
            checked={paso.completado}
            onChange={() => toggle(paso)}
            className="h-4 w-4 accent-emerald-500 cursor-pointer"
          />
          <span className={`flex-1 text-sm ${paso.completado ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>
            {paso.descripcion}
          </span>
          {canWrite && (
            <button type="button" onClick={() => remove(paso.id)} className="text-xs text-slate-400 hover:text-red-500">✕</button>
          )}
        </div>
      ))}
      {canWrite && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            placeholder="Agregar paso..."
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="flex-1 text-sm"
          />
          <button type="submit" disabled={adding || !newDesc.trim()} className="rounded-md bg-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-700 dark:text-slate-200">
            {adding ? '...' : 'Agregar'}
          </button>
        </form>
      )}
    </div>
  );
}

function MantenimientoTab({ equipmentId }: { equipmentId: number }) {
  const { loading: authLoading, hasPermission } = useAuth();
  const canView = authLoading || hasPermission('mantenimientos:read');
  const canWrite = authLoading || hasPermission('mantenimientos:write');
  const canDelete = authLoading || hasPermission('mantenimientos:delete');
  const canApprove = authLoading || hasPermission('mantenimientos:approve');
  const canUpdate = authLoading || hasPermission('mantenimientos:update');
  const [records, setRecords] = useState<MantenimientoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MantenimientoPayload>({ ...EMPTY_MANT, equipment_id: equipmentId });
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [viewing, setViewing] = useState<MantenimientoRow | null>(null);

  // Firma técnico
  const [showFirma, setShowFirma] = useState(false);
  const [firmaTecnico, setFirmaTecnico] = useState<string | null>(null);
  const [firmando, setFirmando] = useState(false);

  // Aprobación
  const [showAprobacion, setShowAprobacion] = useState(false);
  const [firmaSupervisor, setFirmaSupervisor] = useState<string | null>(null);
  const [comentarioAprobacion, setComentarioAprobacion] = useState('');
  const [aprobando, setAprobando] = useState(false);

  async function fetchRecords() {
    setLoading(true);
    try {
      const r = await listMantenimientos(equipmentId);
      setRecords(r.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRecords(); }, [equipmentId]);

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_MANT, equipment_id: equipmentId });
    setShowForm(true);
    setMsg('');
    setMsgOk(false);
  }

  function openEdit(r: MantenimientoRow) {
    setEditing(r.id);
    setForm({
      equipment_id: equipmentId,
      tipo: r.tipo,
      fecha: r.fecha.split('T')[0],
      tecnico: r.tecnico ?? '',
      descripcion: r.descripcion,
      costo: r.costo ? Number(r.costo) : undefined,
      observaciones: r.observaciones ?? '',
      proximo_mantenimiento: r.proximo_mantenimiento ?? '',
      prioridad: r.prioridad ?? 'Media',
    });
    setShowFirma(false);
    setFirmaTecnico(null);
    setShowAprobacion(false);
    setFirmaSupervisor(null);
    setComentarioAprobacion('');
    setShowForm(true);
    setMsg('');
    setMsgOk(false);
  }

  async function handleFirmarTecnico() {
    if (!editing || !firmaTecnico) return;
    setFirmando(true);
    try {
      await firmarTecnico(editing, firmaTecnico);
      setShowFirma(false);
      setFirmaTecnico(null);
      await fetchRecords();
      setMsgOk(true);
      setMsg('Enviado a aprobación del supervisor.');
    } catch (err) {
      setMsgOk(false);
      setMsg(err instanceof Error ? err.message : 'Error al firmar');
    } finally {
      setFirmando(false);
    }
  }

  async function handleAprobar(aprobado: boolean) {
    if (!editing) return;
    setAprobando(true);
    try {
      await aprobarMantenimiento(editing, { aprobado, firma_supervisor: firmaSupervisor ?? undefined, comentario: comentarioAprobacion || undefined });
      setShowAprobacion(false);
      setFirmaSupervisor(null);
      setComentarioAprobacion('');
      await fetchRecords();
      setMsgOk(true);
      setMsg(aprobado ? 'Orden de trabajo aprobada.' : 'Orden de trabajo rechazada.');
    } catch (err) {
      setMsgOk(false);
      setMsg(err instanceof Error ? err.message : 'Error al procesar aprobación');
    } finally {
      setAprobando(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    const payload = {
      ...form,
      tecnico: form.tecnico || undefined,
      observaciones: form.observaciones || undefined,
      proximo_mantenimiento: form.proximo_mantenimiento || undefined,
      costo: form.costo ?? undefined,
    };
    try {
      if (editing !== null) {
        await updateMantenimiento(editing, payload);
        setShowForm(false);
        setEditing(null);
        setMsg('');
        setMsgOk(false);
      } else {
        const created = await createMantenimiento(payload);
        setEditing(created.id);
        setMsgOk(true);
        setMsg('Registro guardado. Puedes agregar fotos a continuación.');
      }
      await fetchRecords();
    } catch (err) {
      setMsgOk(false);
      setMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('¿Eliminar este registro de mantenimiento?')) return;
    try {
      await deleteMantenimiento(id);
      await fetchRecords();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  async function handleUploadPhoto(file: File) {
    if (editing === null) return;
    setUploadingPhoto(true);
    try {
      await uploadMantenimientoPhoto(editing, file);
      await fetchRecords();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al subir foto');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeletePhoto(photoId: number) {
    if (editing === null) return;
    try {
      await deleteMantenimientoPhoto(editing, photoId);
      await fetchRecords();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al eliminar foto');
    }
  }

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{msg}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
          Registros de mantenimiento ({records.length})
        </h3>
        <button onClick={openNew} className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
          + Nuevo registro
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 max-w-xl dark:border-slate-700 dark:bg-slate-900">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200">{editing !== null ? 'Editar mantenimiento' : 'Nuevo mantenimiento'}</h4>

          {editing !== null && records.find((r) => r.id === editing)?.estado === 'pendiente_aprobacion' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              Esta OT está pendiente de aprobación. Puedes editar los detalles; el supervisor verá los cambios al aprobar.
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}>
                <option value="Preventivo">Preventivo</option>
                <option value="Correctivo">Correctivo</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Prioridad</label>
              <select value={form.prioridad ?? 'Media'} onChange={(e) => setForm((p) => ({ ...p, prioridad: e.target.value }))}>
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))} required />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Técnico</label>
            <input
              type="text"
              placeholder="Nombre del técnico"
              value={form.tecnico ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, tecnico: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Descripción *</label>
            <textarea
              rows={3}
              placeholder="Descripción del trabajo realizado"
              value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              required
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Costo (opcional)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.costo ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, costo: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Próximo mantenimiento</label>
              <DatePickerPresets
                value={form.proximo_mantenimiento ?? ''}
                onChange={(v) => setForm((p) => ({ ...p, proximo_mantenimiento: v }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Observaciones</label>
            <input
              type="text"
              placeholder="Notas adicionales"
              value={form.observaciones ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))}
            />
          </div>

          {editing !== null && (() => {
            const current = records.find((r) => r.id === editing);
            return (
              <>
                <div className="space-y-1">
                  <h5 className="text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Fotos</h5>
                  <PhotoGrid
                    photos={current?.fotos ?? []}
                    apiBase={API_BASE}
                    onUpload={handleUploadPhoto}
                    onDelete={handleDeletePhoto}
                    uploading={uploadingPhoto}
                  />
                </div>

                <ChecklistSection
                  mantenimientoId={editing}
                  pasos={current?.pasos ?? []}
                  canWrite={canWrite}
                  onRefresh={fetchRecords}
                />

                {/* Firma técnico — solo si no está ya en pendiente_aprobacion/aprobado */}
                {canWrite && current && !['pendiente_aprobacion', 'aprobado'].includes(current.estado) && (
                  <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                    <h5 className="text-xs font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Firma del técnico
                    </h5>
                    {current.firma_tecnico ? (
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">✓ Firmado</p>
                    ) : (
                      <>
                        {!showFirma ? (
                          <button type="button" onClick={() => setShowFirma(true)} className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400">
                            Firmar y enviar a aprobación
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <SignaturePad label="Firma del técnico" name="firma_tecnico" onChange={setFirmaTecnico} />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={!firmaTecnico || firmando}
                                onClick={handleFirmarTecnico}
                                className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50"
                              >
                                {firmando ? 'Enviando...' : 'Confirmar firma'}
                              </button>
                              <button type="button" onClick={() => { setShowFirma(false); setFirmaTecnico(null); }} className="rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Aprobación supervisor */}
                {canApprove && current?.estado === 'pendiente_aprobacion' && (
                  <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-500/30 dark:bg-cyan-500/10">
                    <h5 className="text-xs font-medium uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                      Aprobación del supervisor
                    </h5>
                    {current.firma_tecnico && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Firma técnico:</span>
                        <img src={current.firma_tecnico} alt="Firma técnico" className="h-10 rounded border border-slate-200 bg-white dark:border-slate-700" />
                      </div>
                    )}
                    {!showAprobacion ? (
                      <button type="button" onClick={() => setShowAprobacion(true)} className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                        Revisar y aprobar
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Firma del supervisor</label>
                          <SignaturePad label="Firma del supervisor" name="firma_supervisor" onChange={setFirmaSupervisor} />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Comentario (opcional)</label>
                          <input
                            type="text"
                            placeholder="Observaciones de aprobación..."
                            value={comentarioAprobacion}
                            onChange={(e) => setComentarioAprobacion(e.target.value)}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" disabled={aprobando} onClick={() => handleAprobar(true)} className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50">
                            {aprobando ? '...' : 'Aprobar'}
                          </button>
                          <button type="button" disabled={aprobando} onClick={() => handleAprobar(false)} className="rounded-md bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 disabled:opacity-50">
                            Rechazar
                          </button>
                          <button type="button" onClick={() => setShowAprobacion(false)} className="rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Estado aprobado/rechazado informativo */}
                {current && ['aprobado', 'rechazado'].includes(current.estado) && (
                  <div className={`rounded-xl border p-3 text-sm ${current.estado === 'aprobado' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'}`}>
                    {current.estado === 'aprobado' ? '✓ Aprobado' : '✕ Rechazado'}
                    {current.aprobado_por_nombre && <span className="ml-2 text-xs opacity-75">por {current.aprobado_por_nombre}</span>}
                    {current.comentario_aprobacion && <p className="mt-1 text-xs opacity-75">{current.comentario_aprobacion}</p>}
                  </div>
                )}
              </>
            );
          })()}

          {msg && (
            <p className={`rounded-md px-3 py-2 text-sm ${msgOk ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200'}`}>
              {msg}
            </p>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
              {saving ? 'Guardando...' : (editing !== null ? 'Actualizar' : 'Registrar')}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); setShowFirma(false); setFirmaTecnico(null); setShowAprobacion(false); setMsg(''); setMsgOk(false); }} className="rounded-md bg-slate-200 px-5 py-2 text-sm text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
              Cerrar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-600 dark:text-slate-400">Cargando registros...</p>
      ) : records.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">No hay registros de mantenimiento.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Técnico</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Checklist</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Próximo</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const total = r.pasos?.length ?? 0;
                const done = r.pasos?.filter((p) => p.completado).length ?? 0;
                return (
                <tr key={r.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.tipo === 'Correctivo' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'}`}>
                      {r.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORIDAD_BADGE[r.prioridad ?? 'Media'] ?? PRIORIDAD_BADGE.Media}`}>
                      {r.prioridad ?? 'Media'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{r.fecha.split('T')[0]}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{r.tecnico ?? '—'}</td>
                  <td className="px-4 py-3 max-w-xs text-slate-700 dark:text-slate-300 truncate" title={r.descripcion}>{r.descripcion}</td>
                  <td className="px-4 py-3">
                    {total > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-slate-200 dark:bg-slate-700">
                          <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${(done / total) * 100}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{done}/{total}</span>
                      </div>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_OT_BADGE[r.estado] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {r.estado.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">{r.proximo_mantenimiento ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {canView && (
                        <button onClick={() => setViewing(r)} className="rounded-md bg-slate-200 px-2 py-1 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                          Ver
                        </button>
                      )}
                      {(canWrite || canUpdate) && r.estado !== 'aprobado' && (
                        <button onClick={() => openEdit(r)} className="rounded-md bg-slate-200 px-2 py-1 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                          Editar
                        </button>
                      )}
                      {r.estado === 'aprobado' && (
                        <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" title="OT aprobada — solo lectura">
                          ✓ Aprobado
                        </span>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(r.id)} className="rounded-md bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/40">
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewing && <MantenimientoModal mantenimiento={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ── Asignaciones tab ─────────────────────────────────────────────────────────

const TIPO_ASIG_BADGE: Record<string, string> = {
  'Entrega': 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30',
  'Devolución': 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
  'Traslado': 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30',
};

function AsignacionesTab({ equipmentId }: { equipmentId: number }) {
  const [items, setItems] = useState<AsignacionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listHistorial({ equipment_id: equipmentId, limit: 100 })
      .then((r) => setItems(r.items))
      .finally(() => setLoading(false));
  }, [equipmentId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-slate-500">
        <p>Sin movimientos registrados para este equipo.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Empleado / Destino</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Registrado por</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/30 transition-colors">
              <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                {new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIPO_ASIG_BADGE[m.tipo] ?? 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
                  {m.tipo}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                {m.empleado_nombre
                  ? <><p className="text-slate-800 dark:text-slate-200">{m.empleado_nombre}</p>{m.empleado_cedula && <p className="text-xs text-slate-500">{m.empleado_cedula}</p>}</>
                  : m.bodega_destino_nombre
                  ? <p className="text-slate-600 dark:text-slate-400">{m.bodega_destino_nombre}</p>
                  : <span className="text-slate-400 dark:text-slate-600">—</span>}
              </td>
              <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                {m.estado_antes && <span className="text-slate-400 dark:text-slate-600">{m.estado_antes} → </span>}
                <span className="text-slate-700 dark:text-slate-300">{m.estado_despues}</span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{m.created_by_nombre}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Credenciales tab ──────────────────────────────────────────────────────────

const EMPTY_CRED_FORM = { nombre: '', usuario: '', password: '', url: '', notas: '' };

function CredencialesTab({ equipmentId }: { equipmentId: number }) {
  const { loading: authLoading, hasPermission } = useAuth();
  const canWrite = authLoading || hasPermission('credenciales:write');
  const canDelete = authLoading || hasPermission('credenciales:delete');

  const [items, setItems] = useState<CredencialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_CRED_FORM);
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const [revealing, setRevealing] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<number | null>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const r = await listCredenciales({ equipment_id: equipmentId, tipo: 'equipo' });
      setItems(r.items);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [equipmentId]);

  function openNew() {
    setShowForm(true);
    setEditingId(null);
    setForm(EMPTY_CRED_FORM);
    setShowPwd(false);
    setFormMsg('');
  }

  function openEdit(c: CredencialRow) {
    setShowForm(true);
    setEditingId(c.id);
    setForm({ nombre: c.nombre, usuario: c.usuario ?? '', password: '', url: c.url ?? '', notas: c.notas ?? '' });
    setShowPwd(false);
    setFormMsg('');
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId && !form.password.trim()) { setFormMsg('La contraseña es obligatoria.'); return; }
    setSaving(true); setFormMsg('');
    try {
      if (editingId) {
        const payload: CredencialUpdatePayload = {
          nombre: form.nombre,
          usuario: form.usuario || null,
          url: form.url || null,
          notas: form.notas || null,
        };
        if (form.password.trim()) payload.password = form.password;
        await updateCredencial(editingId, payload);
      } else {
        const payload: CredencialCreatePayload = {
          tipo: 'equipo',
          nombre: form.nombre,
          equipment_id: equipmentId,
          usuario: form.usuario || null,
          password: form.password,
          url: form.url || null,
          notas: form.notas || null,
        };
        await createCredencial(payload);
      }
      closeForm();
      await load();
    } catch (err) {
      setFormMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: CredencialRow) {
    if (!window.confirm(`¿Eliminar la credencial "${c.nombre}"?`)) return;
    try {
      await deleteCredencial(c.id);
      setItems((prev) => prev.filter((x) => x.id !== c.id));
    } catch (err) { setError(err instanceof Error ? err.message : 'Error al eliminar'); }
  }

  async function handleReveal(id: number) {
    if (revealed[id]) {
      setRevealed((prev) => { const next = { ...prev }; delete next[id]; return next; });
      return;
    }
    setRevealing((prev) => ({ ...prev, [id]: true }));
    try {
      const password = await revealCredencialPassword(id);
      setRevealed((prev) => ({ ...prev, [id]: password }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al revelar la contraseña');
    } finally {
      setRevealing((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleCopy(id: number, password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard no disponible */ }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>}

      {canWrite && !showForm && (
        <button onClick={openNew} className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
          + Agregar credencial
        </button>
      )}

      {showForm && (
        <div className="rounded-2xl border border-cyan-300 bg-cyan-50 p-6 dark:border-cyan-900/50 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-base font-semibold">{editingId ? 'Editar credencial' : 'Nueva credencial'}</h3>
            <button onClick={closeForm} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">✕ Cerrar</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Nombre / Descripción *</label>
              <input
                type="text"
                placeholder="Ej: Acceso administrador local"
                value={form.nombre}
                onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Usuario</label>
                <input
                  type="text"
                  placeholder="administrador"
                  value={form.usuario}
                  onChange={(e) => setForm((p) => ({ ...p, usuario: e.target.value }))}
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Contraseña {editingId ? '' : '*'}
                </label>
                <div className="flex gap-2">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    placeholder={editingId ? 'Dejar en blanco para no cambiar' : 'Contraseña'}
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    autoComplete="new-password"
                    required={!editingId}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                  />
                  <button type="button" onClick={() => setShowPwd((s) => !s)}
                    className="shrink-0 rounded-lg border border-slate-300 px-3 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                    {showPwd ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">URL (opcional)</label>
              <input
                type="text"
                placeholder="https://..."
                value={form.url}
                onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Notas</label>
              <textarea
                rows={2}
                placeholder="Información adicional..."
                value={form.notas}
                onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>
            {formMsg && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{formMsg}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="rounded-md bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear credencial'}
              </button>
              <button type="button" onClick={closeForm} className="rounded-md bg-slate-200 px-5 py-2 text-sm text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          <p>Sin credenciales registradas para este equipo.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Contraseña</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{c.nombre}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.usuario ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {revealed[c.id] ?? '••••••••'}
                      </span>
                      <button onClick={() => handleReveal(c.id)} disabled={revealing[c.id]}
                        className="rounded-md bg-slate-200 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 disabled:opacity-50">
                        {revealing[c.id] ? '...' : revealed[c.id] ? 'Ocultar' : 'Ver'}
                      </button>
                      {revealed[c.id] && (
                        <button onClick={() => handleCopy(c.id, revealed[c.id])}
                          className="rounded-md bg-cyan-100 px-2 py-0.5 text-xs text-cyan-700 hover:bg-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20">
                          {copied === c.id ? '✓' : 'Copiar'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-[160px] truncate">
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" title={c.url}
                        className="text-cyan-600 hover:underline dark:text-cyan-400">{c.url}</a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 max-w-[200px] truncate text-slate-700 dark:text-slate-300" title={c.notas ?? ''}>{c.notas ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {canWrite && (
                        <button onClick={() => openEdit(c)}
                          className="rounded-md bg-slate-200 px-3 py-1 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                          Editar
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(c)}
                          className="rounded-md bg-red-100 px-3 py-1 text-xs text-red-700 hover:bg-red-200 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20">
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Documentos tab ───────────────────────────────────────────────────────────

const TIPOS_DOC = ['Manual', 'Certificado', 'Factura', 'Garantía', 'Contrato', 'Otro'];

function DocumentosTab({
  equipmentId,
  documentos,
  onRefresh,
}: {
  equipmentId: number;
  documentos: EquipmentDocumentoOut[];
  onRefresh: () => void;
}) {
  const { loading: authLoading, hasPermission } = useAuth();
  const canWrite = authLoading || hasPermission('equipment:write');
  const [uploading, setUploading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [tipoDoc, setTipoDoc] = useState('Manual');
  const [msg, setMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg('');
    try {
      await uploadEquipmentDocumento(equipmentId, file, nombre || file.name, tipoDoc);
      setNombre('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al subir el documento');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: EquipmentDocumentoOut) {
    if (!window.confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    try {
      await deleteEquipmentDocumento(equipmentId, doc.id);
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  function docIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['doc', 'docx'].includes(ext ?? '')) return '📝';
    if (['xls', 'xlsx'].includes(ext ?? '')) return '📊';
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext ?? '')) return '🖼';
    return '📎';
  }

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{msg}</p>}

      {canWrite && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">Subir documento</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Nombre del documento</label>
              <input
                type="text"
                placeholder="Ej: Manual de usuario HP EliteBook"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Tipo</label>
              <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className="w-full">
                {TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <label className={`cursor-pointer rounded-md px-4 py-2 text-sm font-medium transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''} bg-cyan-500 text-slate-950 hover:bg-cyan-400`}>
              {uploading ? 'Subiendo...' : '+ Seleccionar archivo'}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
            <span className="text-xs text-slate-500">PDF, Word, Excel, imágenes · máx. 20 MB</span>
          </div>
        </div>
      )}

      {documentos.length === 0 ? (
        <p className="py-8 text-center text-slate-500">No hay documentos adjuntos.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wider text-slate-600 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 hidden sm:table-cell">Fecha</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documentos.map((doc) => (
                <tr key={doc.id} className="border-t border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <a
                      href={`${API_BASE}${doc.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-cyan-600 hover:underline dark:text-cyan-400"
                    >
                      <span className="text-base">{docIcon(doc.filename)}</span>
                      <span className="font-medium">{doc.nombre}</span>
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {doc.tipo_doc}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-xs text-slate-500">
                    {new Date(doc.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={`${API_BASE}${doc.url}`}
                        download={doc.nombre}
                        className="rounded-md bg-slate-200 px-3 py-1 text-xs text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                      >
                        Descargar
                      </a>
                      {canWrite && (
                        <button
                          onClick={() => handleDelete(doc)}
                          className="rounded-md bg-red-100 px-3 py-1 text-xs text-red-700 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/40"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HojaDeVidaPage() {
  const { id } = useParams<{ id: string }>();
  const equipmentId = Number(id);
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canViewCredenciales = authLoading || hasPermission('credenciales:read');

  const [profile, setProfile] = useState<EquipmentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('ficha');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    fetchProfile();
  }, [equipmentId]);

  async function fetchProfile() {
    setLoading(true);
    setError('');
    try {
      const data = await getEquipmentProfile(equipmentId);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar hoja de vida');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-slate-600 dark:text-slate-400">Cargando hoja de vida...</p>
        </main>
      </>
    );
  }

  if (error || !profile) {
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

  const eq = profile.equipment;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ficha', label: 'Ficha técnica' },
    { id: 'perifericos', label: `Periféricos (${profile.children.length})` },
    { id: 'fotos', label: `Fotos (${profile.photos.length})` },
    { id: 'documentos', label: `Documentos (${profile.documentos.length})` },
    { id: 'mantenimiento', label: 'Mantenimiento' },
    { id: 'asignaciones', label: 'Asignaciones' },
    ...(canViewCredenciales ? [{ id: 'credenciales' as Tab, label: 'Credenciales' }] : []),
  ];

  return (
    <>
      <NavBar />
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-slate-500">
          <Link href="/equipos" className="hover:text-cyan-600 dark:hover:text-cyan-400">Equipos</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 dark:text-slate-300">{eq.codigo_interno}</span>
        </nav>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">{eq.tipo}</p>
            <h1 className="mt-1 text-3xl font-bold">{eq.marca} {eq.modelo}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">

              <span className="text-slate-500">·</span>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-400">S/N: {eq.serial}</span>
              <span className="font-mono text-sm text-cyan-600 dark:text-cyan-400">{eq.codigo_interno}</span>

              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_COLORS[eq.estado] ?? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                {eq.estado}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                eq.criticidad === 'Alta' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' :
                eq.criticidad === 'Baja' ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' :
                'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
              }`}>
                {eq.criticidad}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-500">
              {eq.sede && <span>Sede: <span className="text-slate-700 dark:text-slate-300">{eq.sede}</span></span>}
              {eq.ubicacion && <span>Ubicación: <span className="text-slate-700 dark:text-slate-300">{eq.ubicacion}</span></span>}
              {eq.garantia_vence && <span>Garantía hasta: <span className="text-slate-700 dark:text-slate-300">{eq.garantia_vence}</span></span>}
              {eq.vencimiento_calibracion && (() => {
                const dias = Math.ceil((new Date(eq.vencimiento_calibracion).getTime() - Date.now()) / 86400000);
                const cls = dias < 0 ? 'text-red-600 dark:text-red-400' : dias <= 30 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300';
                return (
                  <span>Calibración vence: <span className={cls}>{eq.vencimiento_calibracion}{dias < 0 ? ` (vencida ${Math.abs(dias)}d)` : dias <= 30 ? ` (en ${dias}d)` : ''}</span></span>
                );
              })()}
            </div>
          </div>
          <Link
            href={`/equipos/${equipmentId}/editar`}
            className="rounded-md bg-slate-200 px-4 py-2 text-sm text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
          >
            Editar equipo
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-300'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1">
          {tab === 'ficha' && (
            <FichaTab
              profile={profile}
              onSave={async (specs) => {
                await updateEquipmentSpecs(equipmentId, specs);
                await fetchProfile();
              }}
            />
          )}
          {tab === 'perifericos' && (
            <PerifeicosTab
              equipmentId={equipmentId}
              profile={profile}
              onRefresh={fetchProfile}
            />
          )}
          {tab === 'fotos' && (
            <FotosTab
              equipmentId={equipmentId}
              photos={profile.photos}
              onRefresh={fetchProfile}
            />
          )}
          {tab === 'documentos' && (
            <DocumentosTab
              equipmentId={equipmentId}
              documentos={profile.documentos}
              onRefresh={fetchProfile}
            />
          )}
          {tab === 'mantenimiento' && (
            <MantenimientoTab equipmentId={equipmentId} />
          )}
          {tab === 'asignaciones' && (
            <AsignacionesTab equipmentId={equipmentId} />
          )}
          {tab === 'credenciales' && canViewCredenciales && (
            <CredencialesTab equipmentId={equipmentId} />
          )}
        </div>
      </main>
    </>
  );
}
