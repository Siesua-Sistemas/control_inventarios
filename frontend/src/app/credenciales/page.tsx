"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import {
  createCredencial,
  deleteCredencial,
  isAuthenticated,
  listCredenciales,
  listEquipment,
  revealCredencialPassword,
  updateCredencial,
  type CredencialCreatePayload,
  type CredencialRow,
  type CredencialUpdatePayload,
  type EquipmentRow,
} from '@/lib/api';

const PAGE_SIZE = 50;

interface EquipoBrief {
  id: number;
  codigo_interno: string;
  marca: string;
  modelo: string;
  tipo?: string;
}

const TIPO_LABELS: Record<string, string> = { equipo: 'Equipo', cuenta: 'Cuenta' };

const TIPO_BADGE_CLASSES: Record<string, string> = {
  equipo: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  cuenta: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
};

const EMPTY_FORM = {
  tipo: 'cuenta' as 'cuenta' | 'equipo',
  nombre: '',
  usuario: '',
  password: '',
  url: '',
  notas: '',
};

export default function CredencialesPage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canWrite = authLoading || hasPermission('credenciales:write');
  const canDelete = authLoading || hasPermission('credenciales:delete');

  const [items, setItems] = useState<CredencialRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);

  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPwd, setShowPwd] = useState(false);
  const [selectedEq, setSelectedEq] = useState<EquipoBrief | null>(null);
  const [eqSearch, setEqSearch] = useState('');
  const [eqResults, setEqResults] = useState<EquipmentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const nombreRef = useRef<HTMLInputElement>(null);

  const [revealed, setRevealed] = useState<Record<number, string>>({});
  const [revealing, setRevealing] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<number | null>(null);

  const load = async (p = page, q = search, tipo = filterTipo) => {
    setLoading(true); setError('');
    try {
      const r = await listCredenciales({
        search: q || undefined,
        tipo: tipo || undefined,
        skip: p * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setItems(r.items);
      setTotal(r.total);
      setPage(p);
    } catch (e) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    load();
  }, [router]);

  useEffect(() => {
    if (!authLoading && !hasPermission('credenciales:read')) {
      router.replace('/inicio');
    }
  }, [authLoading, hasPermission, router]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    load(0, search, filterTipo);
  };

  const clearFilters = () => {
    setSearch(''); setFilterTipo('');
    load(0, '', '');
  };

  const goPage = (p: number) => load(p);

  // ── Búsqueda de equipo (debounced) ────────────────────────────────────────
  useEffect(() => {
    if (!eqSearch.trim()) { setEqResults([]); return; }
    const timer = setTimeout(() => {
      listEquipment({ search: eqSearch }).then((r) => setEqResults(r.items)).catch(() => setEqResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [eqSearch]);

  function openNew() {
    setShowForm(true);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowPwd(false);
    setSelectedEq(null);
    setEqSearch('');
    setEqResults([]);
    setFormMsg('');
    setTimeout(() => nombreRef.current?.focus(), 50);
  }

  function openEdit(c: CredencialRow) {
    setShowForm(true);
    setEditingId(c.id);
    setForm({
      tipo: c.tipo === 'equipo' ? 'equipo' : 'cuenta',
      nombre: c.nombre,
      usuario: c.usuario ?? '',
      password: '',
      url: c.url ?? '',
      notas: c.notas ?? '',
    });
    setShowPwd(false);
    if (c.tipo === 'equipo' && c.equipment_id) {
      setSelectedEq({
        id: c.equipment_id,
        codigo_interno: c.equipment_codigo ?? '',
        marca: c.equipment_marca ?? '',
        modelo: c.equipment_modelo ?? '',
      });
    } else {
      setSelectedEq(null);
    }
    setEqSearch('');
    setEqResults([]);
    setFormMsg('');
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.tipo === 'equipo' && !selectedEq) { setFormMsg('Selecciona un equipo.'); return; }
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
        if (form.tipo === 'equipo' && selectedEq) payload.equipment_id = selectedEq.id;
        await updateCredencial(editingId, payload);
      } else {
        const payload: CredencialCreatePayload = {
          tipo: form.tipo,
          nombre: form.nombre,
          usuario: form.usuario || null,
          password: form.password,
          url: form.url || null,
          notas: form.notas || null,
          equipment_id: form.tipo === 'equipo' ? selectedEq!.id : null,
        };
        await createCredencial(payload);
      }
      closeForm();
      await load(editingId ? page : 0);
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
      setTotal((t) => t - 1);
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

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Sistemario</p>
            <h1 className="mt-1 text-3xl font-bold">Credenciales</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Claves de cuentas, aplicaciones y accesos de equipos.
            </p>
          </div>
          {canWrite && !showForm && (
            <button onClick={openNew} className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              + Nueva credencial
            </button>
          )}
        </div>

        {/* Formulario nueva/editar credencial */}
        {showForm && (
          <div className="mb-6 rounded-2xl border border-cyan-300 bg-cyan-50 p-6 dark:border-cyan-900/50 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold">{editingId ? 'Editar credencial' : 'Nueva credencial'}</h3>
              <button onClick={closeForm} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">✕ Cerrar</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tipo */}
              <div className="space-y-1">
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Tipo</label>
                {editingId ? (
                  <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                    {TIPO_LABELS[form.tipo]}
                  </span>
                ) : (
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value as 'cuenta' | 'equipo' }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="cuenta">Cuenta / Aplicación (correo, cloud, software...)</option>
                    <option value="equipo">Equipo del inventario (acceso local / admin)</option>
                  </select>
                )}
              </div>

              {/* Selector de equipo */}
              {form.tipo === 'equipo' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Equipo *
                  </label>
                  {selectedEq ? (
                    <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 shrink-0">{selectedEq.codigo_interno}</span>
                        <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{selectedEq.marca} {selectedEq.modelo}</span>
                        {selectedEq.tipo && <span className="text-xs text-slate-500 shrink-0">{selectedEq.tipo}</span>}
                      </div>
                      <button type="button" onClick={() => setSelectedEq(null)}
                        className="ml-3 shrink-0 text-xs text-slate-500 hover:text-red-600 dark:hover:text-red-400">✕</button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar por código, serial, marca, modelo..."
                        value={eqSearch}
                        onChange={(e) => setEqSearch(e.target.value)}
                        autoComplete="off"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-600"
                      />
                      {eqResults.length > 0 && (
                        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950 shadow-xl">
                          {eqResults.slice(0, 10).map((eq) => (
                            <li key={eq.id}>
                              <button type="button" onClick={() => { setSelectedEq(eq); setEqSearch(''); setEqResults([]); }}
                                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
                                <span className="font-mono text-xs text-cyan-600 dark:text-cyan-400 w-20 shrink-0">{eq.codigo_interno}</span>
                                <span className="font-medium text-slate-800 dark:text-slate-200">{eq.marca} {eq.modelo}</span>
                                <span className="ml-auto text-xs text-slate-500 shrink-0">{eq.tipo}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Nombre */}
              <div className="space-y-1">
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-400">Nombre / Descripción *</label>
                <input
                  ref={nombreRef}
                  type="text"
                  placeholder={
                    form.tipo === 'equipo' ? 'Ej: Acceso administrador local'
                    : 'Ej: Correo corporativo, AWS, Office 365...'
                  }
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
                    placeholder="usuario@dominio.com"
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
                  placeholder="Información adicional, recuperación, preguntas de seguridad..."
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

        {/* Filtros */}
        <form onSubmit={handleFilter} className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Buscar</label>
            <input type="text" placeholder="Nombre / descripción..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Tipo</label>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Todos</option>
              <option value="cuenta">Cuenta</option>
              <option value="equipo">Equipo</option>
            </select>
          </div>
          <button type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors">
            Buscar
          </button>
          {(search || filterTipo) && (
            <button type="button" onClick={clearFilters}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
              Limpiar
            </button>
          )}
        </form>

        {error && <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>}

        {/* Tabla */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 dark:bg-slate-950 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Equipo</th>
                <th className="px-4 py-3">Usuario</th>
                <th className="px-4 py-3">Contraseña</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3">Creado por</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center text-slate-500">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
                </td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-slate-500">No hay credenciales registradas.</td></tr>
              ) : items.map((c) => (
                <tr key={c.id} className="border-t border-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{c.nombre}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_BADGE_CLASSES[c.tipo] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300'}`}>
                      {TIPO_LABELS[c.tipo] ?? c.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.tipo === 'equipo' && c.equipment_id ? (
                      <Link href={`/equipos/${c.equipment_id}/hoja-de-vida`} className="hover:underline">
                        <span className="font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">{c.equipment_codigo}</span>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{c.equipment_marca} {c.equipment_modelo}</p>
                      </Link>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-600">—</span>
                    )}
                  </td>
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
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{c.created_by_nombre}</td>
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

        {/* Paginación */}
        {!loading && (
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{total} credencial{total !== 1 ? 'es' : ''} en total</span>
            {total > PAGE_SIZE && (
              <div className="flex items-center gap-2">
                <button onClick={() => goPage(page - 1)} disabled={page === 0}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors">
                  ← Anterior
                </button>
                <span>Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}</span>
                <button onClick={() => goPage(page + 1)} disabled={(page + 1) * PAGE_SIZE >= total}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors">
                  Siguiente →
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
