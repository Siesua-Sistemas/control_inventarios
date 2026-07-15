"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import { deleteBodega, isAuthenticated, listBodegas, updateBodega, type BodegaRow } from '@/lib/api';

const DOMINIOS = ['IT', 'Bioingeniería', 'General'] as const;

const DOMINIO_COLORS: Record<string, string> = {
  IT: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  'Bioingeniería': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  General: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

type BodegaGroup = {
  key: string;
  nombre: string;
  sede: string;
  responsable: string | null;
  descripcion: string | null;
  bodegas: BodegaRow[];
};

type EditState = {
  id: number;
  nombre: string;
  sede: string;
  responsable: string;
  descripcion: string;
  dominio: string;
};

function groupBodegas(items: BodegaRow[]): BodegaGroup[] {
  const map = new Map<string, BodegaGroup>();
  for (const b of items) {
    const key = `${b.nombre}||${b.sede}`;
    if (!map.has(key)) {
      map.set(key, { key, nombre: b.nombre, sede: b.sede, responsable: b.responsable, descripcion: b.descripcion, bodegas: [] });
    }
    map.get(key)!.bodegas.push(b);
  }
  return Array.from(map.values());
}

export default function BodegasPage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const canWrite = authLoading || hasPermission('bodegas:write');
  const canDelete = authLoading || hasPermission('bodegas:delete');

  const [bodegas, setBodegas] = useState<BodegaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    listBodegas()
      .then((r) => setBodegas(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }, [router]);

  function openEdit(b: BodegaRow) {
    setEditState({
      id: b.id,
      nombre: b.nombre,
      sede: b.sede,
      responsable: b.responsable ?? '',
      descripcion: b.descripcion ?? '',
      dominio: b.dominio,
    });
    setEditError('');
  }

  async function handleSave() {
    if (!editState) return;
    setSaving(true);
    setEditError('');
    try {
      const updated = await updateBodega(editState.id, {
        nombre: editState.nombre.trim(),
        sede: editState.sede.trim(),
        responsable: editState.responsable.trim() || null,
        descripcion: editState.descripcion.trim() || null,
        dominio: editState.dominio,
      });
      setBodegas((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
      setEditState(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(b: BodegaRow) {
    if (!window.confirm(`¿Eliminar la bodega "${b.nombre}" (${b.dominio})?`)) return;
    try {
      await deleteBodega(b.id);
      setBodegas((prev) => prev.filter((x) => x.id !== b.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  const groups = groupBodegas(bodegas);

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Inventario</p>
            <h1 className="mt-1 text-3xl font-bold">Bodegas</h1>
          </div>
          {canWrite ? (
            <Link href="/bodegas/nuevo" className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-400">
              + Nueva bodega
            </Link>
          ) : null}
        </div>

        {error && <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <p className="col-span-3 py-10 text-center text-slate-600 dark:text-slate-400">Cargando bodegas...</p>
          ) : groups.length === 0 ? (
            <p className="col-span-3 py-10 text-center text-slate-600 dark:text-slate-400">No hay bodegas registradas.</p>
          ) : (
            groups.map((g) => {
              const totalEquipos = g.bodegas.reduce((s, b) => s + b.total_equipos, 0);
              const isMulti = g.bodegas.length > 1;

              return (
                <div key={g.key} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  {/* Header */}
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{g.nombre}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{g.sede}</p>
                    </div>
                    <span className="rounded-full bg-cyan-100 px-3 py-1 text-sm font-bold text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400 shrink-0">
                      {totalEquipos}
                    </span>
                  </div>

                  {/* Info compartida */}
                  {g.responsable && <p className="mb-1 text-xs text-slate-500">Responsable: {g.responsable}</p>}
                  {g.descripcion && <p className="mb-2 text-xs text-slate-500">{g.descripcion}</p>}

                  {/* Filas por dominio */}
                  <div className="mb-3 space-y-2">
                    {g.bodegas.map((b) => (
                      <div key={b.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${DOMINIO_COLORS[b.dominio] ?? DOMINIO_COLORS.General}`}>
                          {b.dominio}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{b.total_equipos} equipo{b.total_equipos !== 1 ? 's' : ''}</span>
                        <div className="ml-auto flex gap-1.5">
                          <Link
                            href={`/bodegas/${b.id}/inventario`}
                            className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            Ver
                          </Link>
                          {canWrite && (
                            <button
                              onClick={() => openEdit(b)}
                              className="rounded px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50 dark:text-cyan-400 dark:hover:bg-cyan-500/10"
                            >
                              Editar
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(b)}
                              className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Botón inventario único cuando solo hay un dominio */}
                  {!isMulti && (
                    <Link
                      href={`/bodegas/${g.bodegas[0].id}/inventario`}
                      className="block w-full rounded-md bg-slate-200 py-1.5 text-center text-xs font-medium text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Ver inventario completo
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Modal de edición */}
      {editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-slate-100">Editar bodega</h2>

            {editError && (
              <p className="mb-3 rounded bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{editError}</p>
            )}

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Nombre</label>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={editState.nombre}
                  onChange={(e) => setEditState({ ...editState, nombre: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Sede</label>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={editState.sede}
                  onChange={(e) => setEditState({ ...editState, sede: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Dominio</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={editState.dominio}
                  onChange={(e) => setEditState({ ...editState, dominio: e.target.value })}
                >
                  {DOMINIOS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Responsable</label>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={editState.responsable}
                  onChange={(e) => setEditState({ ...editState, responsable: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Descripción</label>
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={editState.descripcion}
                  onChange={(e) => setEditState({ ...editState, descripcion: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setEditState(null)}
                disabled={saving}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
