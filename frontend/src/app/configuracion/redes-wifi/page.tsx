"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { NavBar } from '@/components/nav-bar';
import { useAuth } from '@/components/auth-provider';
import {
  RedWifiAdminOut,
  RedWifiCreate,
  createRedWifi,
  deleteRedWifi,
  isAuthenticated,
  listRedesWifi,
  updateRedWifi,
} from '@/lib/api';

const TIPOS_RED = ['Corporativa', 'Visitantes', 'IoT', 'Backup', 'Otro'];

function MaskPassword({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-sm">{show ? value : '••••••••'}</span>
      <button type="button" onClick={() => setShow((v) => !v)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
        {show ? 'Ocultar' : 'Ver'}
      </button>
    </div>
  );
}

const EMPTY_FORM: RedWifiCreate = { sede: '', nombre_red: '', tipo_red: '', contrasena: '', descripcion: '' };

export default function RedesWifiPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();

  const [redes, setRedes] = useState<RedWifiAdminOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<RedWifiCreate & { is_active: boolean }>>({});
  const [newForm, setNewForm] = useState<RedWifiCreate>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (!hasPermission('wifi:write')) { router.replace('/inicio'); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    try {
      setRedes(await listRedesWifi());
    } finally {
      setLoading(false);
    }
  }

  const startEdit = (r: RedWifiAdminOut) => {
    setEditId(r.id);
    setEditData({ sede: r.sede, nombre_red: r.nombre_red, tipo_red: r.tipo_red ?? '', contrasena: r.contrasena, descripcion: r.descripcion ?? '', is_active: r.is_active });
  };

  const cancelEdit = () => { setEditId(null); setEditData({}); };

  const saveEdit = async () => {
    if (!editId) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateRedWifi(editId, editData);
      setRedes((prev) => prev.map((r) => r.id === editId ? updated : r));
      cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta red WiFi?')) return;
    try {
      await deleteRedWifi(id);
      setRedes((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await createRedWifi(newForm);
      setRedes((prev) => [...prev, created]);
      setNewForm(EMPTY_FORM);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Configuración</p>
          <h1 className="mt-1 text-3xl font-bold">Redes WiFi</h1>
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-3">Sede</th>
                <th className="px-4 py-3">Nombre (SSID)</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Contraseña</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Activa</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Cargando…</td></tr>
              ) : redes.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin redes registradas</td></tr>
              ) : redes.map((r) => (
                editId === r.id ? (
                  <tr key={r.id} className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                    <td className="px-4 py-2">
                      <input value={editData.sede ?? ''} onChange={(e) => setEditData((d) => ({ ...d, sede: e.target.value }))} className="w-full" />
                    </td>
                    <td className="px-4 py-2">
                      <input value={editData.nombre_red ?? ''} onChange={(e) => setEditData((d) => ({ ...d, nombre_red: e.target.value }))} className="w-full" />
                    </td>
                    <td className="px-4 py-2">
                      <select value={editData.tipo_red ?? ''} onChange={(e) => setEditData((d) => ({ ...d, tipo_red: e.target.value || null }))}>
                        <option value="">—</option>
                        {TIPOS_RED.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input value={editData.contrasena ?? ''} onChange={(e) => setEditData((d) => ({ ...d, contrasena: e.target.value }))} className="w-full" />
                    </td>
                    <td className="px-4 py-2">
                      <input value={editData.descripcion ?? ''} onChange={(e) => setEditData((d) => ({ ...d, descripcion: e.target.value }))} className="w-full" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={editData.is_active ?? true} onChange={(e) => setEditData((d) => ({ ...d, is_active: e.target.checked }))} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <button onClick={saveEdit} disabled={saving} className="rounded-lg bg-cyan-600 px-3 py-1 text-xs text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950">
                          {saving ? '…' : 'Guardar'}
                        </button>
                        <button onClick={cancelEdit} className="rounded-lg border border-slate-200 px-3 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-4 py-3">{r.sede}</td>
                    <td className="px-4 py-3 font-medium">{r.nombre_red}</td>
                    <td className="px-4 py-3 text-slate-500">{r.tipo_red ?? '—'}</td>
                    <td className="px-4 py-3"><MaskPassword value={r.contrasena} /></td>
                    <td className="max-w-xs truncate px-4 py-3 text-slate-500">{r.descripcion ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                        {r.is_active ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(r)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
                          Editar
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>

        {/* Create form */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 font-semibold">Agregar red WiFi</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <label>Sede <span className="text-red-500">*</span></label>
              <input value={newForm.sede} onChange={(e) => setNewForm((f) => ({ ...f, sede: e.target.value }))} required />
            </div>
            <div>
              <label>Nombre (SSID) <span className="text-red-500">*</span></label>
              <input value={newForm.nombre_red} onChange={(e) => setNewForm((f) => ({ ...f, nombre_red: e.target.value }))} required />
            </div>
            <div>
              <label>Tipo de red</label>
              <select value={newForm.tipo_red ?? ''} onChange={(e) => setNewForm((f) => ({ ...f, tipo_red: e.target.value || null }))}>
                <option value="">Sin clasificar</option>
                {TIPOS_RED.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>Contraseña <span className="text-red-500">*</span></label>
              <input type="text" value={newForm.contrasena} onChange={(e) => setNewForm((f) => ({ ...f, contrasena: e.target.value }))} required />
            </div>
            <div className="col-span-2">
              <label>Descripción</label>
              <input value={newForm.descripcion ?? ''} onChange={(e) => setNewForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </div>
            <div className="col-span-full">
              <button type="submit" disabled={saving} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 disabled:opacity-50">
                {saving ? 'Guardando…' : '+ Agregar red'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
