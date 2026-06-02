"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import {
  createEquipment,
  createMantenimiento,
  deleteEquipmentPhoto,
  deleteMantenimiento,
  getEquipmentProfile,
  isAuthenticated,
  listEquipment,
  listHistorial,
  listMantenimientos,
  setEquipmentParent,
  updateEquipmentSpecs,
  updateMantenimiento,
  uploadEquipmentPhoto,
  type AsignacionRow,
  type EquipmentBrief,
  type EquipmentPhotoOut,
  type EquipmentProfile,
  type MantenimientoPayload,
  type MantenimientoRow,
  type SpecField,
} from '@/lib/api';
import { ESTADO_COLORS } from '@/lib/constants';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Tab = 'ficha' | 'perifericos' | 'fotos' | 'mantenimiento' | 'asignaciones';

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
      <div className="py-12 text-center text-slate-400">
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
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">{field.label}</label>
          <div className="flex gap-2">
            {nums.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm((p) => ({ ...p, [field.key]: n }))}
                className={`h-9 w-9 rounded-md border text-sm font-semibold transition-colors ${
                  val === n
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                    : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-cyan-600'
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
          <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">{field.label}</label>
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
        <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">{field.label}</label>
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
        <p className={`rounded-md px-3 py-2 text-sm ${msg.includes('Error') ? 'bg-red-500/20 text-red-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
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

const TIPOS_PERIFERICO = ['Accesorio', 'Monitor', 'Audífonos', 'Cámara', 'Red', 'Otro'];

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
    imei: null, placa: null, empleado_id: null, parent_equipment_id: null,
    fecha_compra: null, valor: null, proveedor: null,
    numero_factura: null, garantia_vence: null, observaciones: null, specs: null,
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
      {msg && <p className="rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{msg}</p>}

      {/* Parent */}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Equipo padre</h3>
        {profile.parent ? (
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-xs text-cyan-400">{profile.parent.codigo_interno}</span>
              <span className="ml-2 text-slate-200">{profile.parent.marca} {profile.parent.modelo}</span>
              <span className="ml-2 text-xs text-slate-500">{profile.parent.tipo}</span>
            </div>
            <button
              onClick={() => assignParent(null)}
              disabled={loading}
              className="rounded-md bg-red-500/20 px-3 py-1 text-xs text-red-300 hover:bg-red-500/40 disabled:opacity-50"
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
              <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 text-sm">
                {filteredForParent.slice(0, 10).map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => { setParentSearch(''); assignParent(e.id); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-800"
                    >
                      <span className="font-mono text-xs text-cyan-400">{e.codigo_interno}</span>
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
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Periféricos / Accesorios asociados ({profile.children.length})
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowCargModal(true); setShowPerifModal(false); }}
              className="rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/40"
            >
              ⚡ Nuevo cargador
            </button>
            <button
              type="button"
              onClick={() => { setShowPerifModal(true); setShowCargModal(false); }}
              className="rounded-md bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/40"
            >
              + Nuevo periférico
            </button>
          </div>
        </div>

        {/* Modal: Nuevo periférico */}
        {showPerifModal && (
          <form onSubmit={handleCreatePeiferico} className="mb-4 rounded-lg border border-cyan-800/50 bg-slate-950 p-4 space-y-3">
            <p className="text-sm font-semibold text-cyan-300">Crear periférico y asociar</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Tipo</label>
                <select value={perifForm.tipo} onChange={(e) => setPerifForm((p) => ({ ...p, tipo: e.target.value }))}>
                  {TIPOS_PERIFERICO.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Serial *</label>
                <input
                  type="text"
                  placeholder="Ej: SN-ABC123"
                  value={perifForm.serial}
                  onChange={(e) => setPerifForm((p) => ({ ...p, serial: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Marca *</label>
                <input
                  type="text"
                  placeholder="Ej: Logitech"
                  value={perifForm.marca}
                  onChange={(e) => setPerifForm((p) => ({ ...p, marca: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Modelo *</label>
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
              <button type="button" onClick={() => setShowPerifModal(false)} className="rounded-md bg-slate-700 px-4 py-1.5 text-xs text-slate-200 hover:bg-slate-600">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Modal: Nuevo cargador */}
        {showCargModal && (
          <form onSubmit={handleCreateCargador} className="mb-4 rounded-lg border border-amber-800/50 bg-slate-950 p-4 space-y-3">
            <p className="text-sm font-semibold text-amber-300">⚡ Crear cargador y asociar</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Marca *</label>
                <input
                  type="text"
                  placeholder="Ej: Lenovo, Apple, Samsung"
                  value={cargForm.marca}
                  onChange={(e) => setCargForm((p) => ({ ...p, marca: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Potencia (W) *</label>
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
              <button type="button" onClick={() => setShowCargModal(false)} className="rounded-md bg-slate-700 px-4 py-1.5 text-xs text-slate-200 hover:bg-slate-600">
                Cancelar
              </button>
            </div>
          </form>
        )}

        {profile.children.length > 0 && (
          <ul className="mb-4 space-y-2">
            {profile.children.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
                <div>
                  <span className="font-mono text-xs text-cyan-400">{c.codigo_interno}</span>
                  <span className="ml-2 text-slate-200">{c.marca} {c.modelo}</span>
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
            <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 text-sm">
              {filteredForChild.slice(0, 10).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => { setChildSearch(''); assignChild(e.id); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-800"
                  >
                    <span className="font-mono text-xs text-cyan-400">{e.codigo_interno}</span>
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg('');
    try {
      await uploadEquipmentPhoto(equipmentId, file);
      onRefresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
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
      {msg && <p className="rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{msg}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50"
        >
          {uploading ? 'Subiendo...' : '+ Subir foto'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        <span className="text-xs text-slate-500">JPEG, PNG, WebP o GIF — máx. recomendado 5 MB</span>
      </div>

      {photos.length === 0 ? (
        <p className="text-slate-400">No hay fotos registradas.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
              <img
                src={`${API_BASE}${photo.url}`}
                alt="Foto del equipo"
                className="h-40 w-full object-cover"
              />
              <div className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100 p-2">
                <button
                  onClick={() => handleDelete(photo.id)}
                  className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-500"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
};

function MantenimientoTab({ equipmentId }: { equipmentId: number }) {
  const [records, setRecords] = useState<MantenimientoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MantenimientoPayload>({ ...EMPTY_MANT, equipment_id: equipmentId });
  const [editing, setEditing] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

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
    });
    setShowForm(true);
    setMsg('');
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
      } else {
        await createMantenimiento(payload);
      }
      setShowForm(false);
      setEditing(null);
      await fetchRecords();
    } catch (err) {
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

  return (
    <div className="space-y-6">
      {msg && <p className="rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{msg}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Registros de mantenimiento ({records.length})
        </h3>
        <button onClick={openNew} className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
          + Nuevo registro
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-700 bg-slate-900 p-5 space-y-4 max-w-xl">
          <h4 className="font-semibold text-slate-200">{editing ? 'Editar mantenimiento' : 'Nuevo mantenimiento'}</h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}>
                <option value="Preventivo">Preventivo</option>
                <option value="Correctivo">Correctivo</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">Fecha</label>
              <input type="date" value={form.fecha} onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))} required />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">Técnico</label>
            <input
              type="text"
              placeholder="Nombre del técnico"
              value={form.tecnico ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, tecnico: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">Descripción *</label>
            <textarea
              rows={3}
              placeholder="Descripción del trabajo realizado"
              value={form.descripcion}
              onChange={(e) => setForm((p) => ({ ...p, descripcion: e.target.value }))}
              required
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">Costo (opcional)</label>
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
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">Próximo mantenimiento</label>
              <input
                type="date"
                value={form.proximo_mantenimiento ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, proximo_mantenimiento: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400">Observaciones</label>
            <input
              type="text"
              placeholder="Notas adicionales"
              value={form.observaciones ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, observaciones: e.target.value }))}
            />
          </div>

          {msg && <p className="rounded-md bg-red-500/20 px-3 py-2 text-sm text-red-200">{msg}</p>}

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-md bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
              {saving ? 'Guardando...' : (editing ? 'Actualizar' : 'Registrar')}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md bg-slate-700 px-5 py-2 text-sm text-slate-200 hover:bg-slate-600">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-400">Cargando registros...</p>
      ) : records.length === 0 ? (
        <p className="text-slate-400">No hay registros de mantenimiento.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Técnico</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Costo</th>
                <th className="px-4 py-3">Próximo</th>
                <th className="px-4 py-3">Registrado por</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.tipo === 'Correctivo' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                      {r.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{r.fecha.split('T')[0]}</td>
                  <td className="px-4 py-3 text-slate-300">{r.tecnico ?? '—'}</td>
                  <td className="px-4 py-3 max-w-xs text-slate-300 truncate" title={r.descripcion}>{r.descripcion}</td>
                  <td className="px-4 py-3 text-slate-300">{r.costo ? `$${Number(r.costo).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-slate-300">{r.proximo_mantenimiento ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.created_by_nombre}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(r)} className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-600">
                        Editar
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-300 hover:bg-red-500/40">
                        Eliminar
                      </button>
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

// ── Asignaciones tab ─────────────────────────────────────────────────────────

const TIPO_ASIG_BADGE: Record<string, string> = {
  'Entrega': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Devolución': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Traslado': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />
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
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
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
            <tr key={m.id} className="border-t border-slate-800 hover:bg-slate-800/30 transition-colors">
              <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                {new Date(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TIPO_ASIG_BADGE[m.tipo] ?? 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                  {m.tipo}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                {m.empleado_nombre
                  ? <><p className="text-slate-200">{m.empleado_nombre}</p>{m.empleado_cedula && <p className="text-xs text-slate-500">{m.empleado_cedula}</p>}</>
                  : m.bodega_destino_nombre
                  ? <p className="text-slate-400">{m.bodega_destino_nombre}</p>
                  : <span className="text-slate-600">—</span>}
              </td>
              <td className="px-4 py-3 text-xs text-slate-400">
                {m.estado_antes && <span className="text-slate-600">{m.estado_antes} → </span>}
                <span className="text-slate-300">{m.estado_despues}</span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{m.created_by_nombre}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HojaDeVidaPage() {
  const { id } = useParams<{ id: string }>();
  const equipmentId = Number(id);
  const router = useRouter();

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
          <p className="text-slate-400">Cargando hoja de vida...</p>
        </main>
      </>
    );
  }

  if (error || !profile) {
    return (
      <>
        <NavBar />
        <main className="flex min-h-screen flex-col items-center justify-center gap-4">
          <p className="rounded-md bg-red-500/20 px-4 py-2 text-red-200">{error || 'Equipo no encontrado'}</p>
          <Link href="/equipos" className="text-cyan-400 hover:underline">Volver a equipos</Link>
        </main>
      </>
    );
  }

  const eq = profile.equipment;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ficha', label: 'Ficha técnica' },
    { id: 'perifericos', label: `Periféricos (${profile.children.length})` },
    { id: 'fotos', label: `Fotos (${profile.photos.length})` },
    { id: 'mantenimiento', label: 'Mantenimiento' },
    { id: 'asignaciones', label: 'Asignaciones' },
  ];

  return (
    <>
      <NavBar />
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm text-slate-500">
          <Link href="/equipos" className="hover:text-cyan-400">Equipos</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">{eq.codigo_interno}</span>
        </nav>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">{eq.tipo}</p>
            <h1 className="mt-1 text-3xl font-bold">{eq.marca} {eq.modelo}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              
              <span className="text-slate-500">·</span>
              <span className="font-mono text-xs text-slate-400">S/N: {eq.serial}</span>
              <span className="font-mono text-sm text-cyan-400">{eq.codigo_interno}</span>
              
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_COLORS[eq.estado] ?? 'bg-slate-700 text-slate-300'}`}>
                {eq.estado}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-500">
              {eq.sede && <span>Sede: <span className="text-slate-300">{eq.sede}</span></span>}
              {eq.ubicacion && <span>Ubicación: <span className="text-slate-300">{eq.ubicacion}</span></span>}
              {eq.garantia_vence && <span>Garantía hasta: <span className="text-slate-300">{eq.garantia_vence}</span></span>}
            </div>
          </div>
          <Link
            href={`/equipos/${equipmentId}/editar`}
            className="rounded-md bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600"
          >
            Editar equipo
          </Link>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-slate-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-b-2 border-cyan-400 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
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
          {tab === 'mantenimiento' && (
            <MantenimientoTab equipmentId={equipmentId} />
          )}
          {tab === 'asignaciones' && (
            <AsignacionesTab equipmentId={equipmentId} />
          )}
        </div>
      </main>
    </>
  );
}
