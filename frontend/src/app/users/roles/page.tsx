"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { NavBar } from '@/components/nav-bar';
import {
  createRole,
  isAuthenticated,
  listPermissions,
  listRoles,
  updateRole,
  type PermissionItem,
  type RoleItem,
} from '@/lib/api';

const MODULE_LABELS: Record<string, string> = {
  users: 'Usuarios',
  roles: 'Roles',
  permissions: 'Permisos',
  auth: 'Autenticación',
  equipment: 'Equipos',
  bodegas: 'Bodegas',
  empleados: 'Empleados',
  asignaciones: 'Asignaciones',
  mantenimientos: 'Mantenimientos',
};

const HOME_DASHBOARD_OPTIONS = [
  { value: 'general', label: 'General (Admin IT)' },
  { value: 'inventario', label: 'Inventarios (Compras)' },
  { value: 'entregas', label: 'Entregas (Administrativo)' },
  { value: 'tecnico', label: 'Técnico (Mantenimiento)' },
];

const DOMINIOS_DISPONIBLES = [
  { key: 'IT', label: 'IT (Tecnología)' },
  { key: 'Bioingeniería', label: 'Bioingeniería' },
  { key: 'General', label: 'General' },
];

function groupPermissions(permissions: PermissionItem[]) {
  const groups = new Map<string, PermissionItem[]>();
  for (const permission of permissions) {
    const moduleKey = permission.code.split(':')[0];
    if (!groups.has(moduleKey)) groups.set(moduleKey, []);
    groups.get(moduleKey)!.push(permission);
  }
  return Array.from(groups.entries()).map(([moduleKey, perms]) => ({
    moduleKey,
    label: MODULE_LABELS[moduleKey] ?? moduleKey,
    permissions: perms,
  }));
}

interface RoleEdit {
  name: string;
  description: string;
  homeDashboard: string;
  dominios: string[];
  permissionIds: Set<number>;
}

function emptyEdit(): RoleEdit {
  return { name: '', description: '', homeDashboard: 'general', dominios: ['IT'], permissionIds: new Set() };
}

function PermissionGroups({
  groups,
  permissionIds,
  onToggle,
  onSetGroup,
  disabled,
}: {
  groups: ReturnType<typeof groupPermissions>;
  permissionIds: Set<number>;
  onToggle: (id: number) => void;
  onSetGroup: (permIds: number[], checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const checked = group.permissions.filter((p) => permissionIds.has(p.id)).length;
        const total = group.permissions.length;
        const allChecked = checked === total;
        const permIds = group.permissions.map((p) => p.id);
        return (
          <div key={group.moduleKey} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{group.label}</p>
              <div className="flex items-center gap-2.5">
                <span className={`text-xs tabular-nums ${checked > 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`}>
                  {checked}/{total}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => onSetGroup(permIds, !allChecked)}
                    className="text-xs text-slate-500 underline underline-offset-2 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400"
                  >
                    {allChecked ? 'Quitar todos' : 'Marcar todos'}
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {group.permissions.map((permission) => (
                <label
                  key={permission.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors ${
                    disabled ? 'cursor-default' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={permissionIds.has(permission.id)}
                    onChange={() => onToggle(permission.id)}
                    disabled={disabled}
                    className="accent-cyan-500"
                  />
                  <span className="text-slate-700 dark:text-slate-300">{permission.name}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function RolesPage() {
  const router = useRouter();
  const { loading: authLoading, hasPermission } = useAuth();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [edits, setEdits] = useState<Record<number, RoleEdit>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Record<number, string>>({});
  const [selectedId, setSelectedId] = useState<number | 'new' | null>(null);
  const [newRole, setNewRole] = useState<RoleEdit>(emptyEdit());
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const canWrite = !authLoading && hasPermission('roles:write');
  const groups = useMemo(() => groupPermissions(permissions), [permissions]);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (!authLoading && !hasPermission('roles:read')) { router.replace('/users'); return; }
    if (authLoading) return;

    const load = async () => {
      try {
        const [rolesRes, permsRes] = await Promise.all([listRoles(), listPermissions()]);
        setRoles(rolesRes);
        setPermissions(permsRes);
        const initialEdits: Record<number, RoleEdit> = {};
        for (const role of rolesRes) {
          initialEdits[role.id] = {
            name: role.name,
            description: role.description ?? '',
            homeDashboard: role.home_dashboard,
            dominios: role.dominios ?? ['IT'],
            permissionIds: new Set(role.permissions.map((p) => p.id)),
          };
        }
        setEdits(initialEdits);
        if (rolesRes.length > 0) setSelectedId(rolesRes[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar roles y permisos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router, authLoading, hasPermission]);

  const togglePermission = (id: number | 'new', permissionId: number) => {
    if (id === 'new') {
      setNewRole((c) => {
        const next = new Set(c.permissionIds);
        if (next.has(permissionId)) next.delete(permissionId);
        else next.add(permissionId);
        return { ...c, permissionIds: next };
      });
      return;
    }
    setEdits((current) => {
      const role = current[id];
      if (!role) return current;
      const next = new Set(role.permissionIds);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return { ...current, [id]: { ...role, permissionIds: next } };
    });
  };

  const setGroupPermissions = (id: number | 'new', permIds: number[], checked: boolean) => {
    if (id === 'new') {
      setNewRole((c) => {
        const next = new Set(c.permissionIds);
        for (const pid of permIds) checked ? next.add(pid) : next.delete(pid);
        return { ...c, permissionIds: next };
      });
      return;
    }
    setEdits((current) => {
      const role = current[id];
      if (!role) return current;
      const next = new Set(role.permissionIds);
      for (const pid of permIds) checked ? next.add(pid) : next.delete(pid);
      return { ...current, [id]: { ...role, permissionIds: next } };
    });
  };

  const updateField = (id: number | 'new', field: 'name' | 'description' | 'homeDashboard', value: string) => {
    if (id === 'new') { setNewRole((c) => ({ ...c, [field]: value })); return; }
    setEdits((current) => {
      const role = current[id];
      if (!role) return current;
      return { ...current, [id]: { ...role, [field]: value } };
    });
  };

  const toggleDominio = (id: number | 'new', dominio: string) => {
    const apply = (current: RoleEdit): RoleEdit => {
      const next = current.dominios.includes(dominio)
        ? current.dominios.filter((d) => d !== dominio)
        : [...current.dominios, dominio];
      if (next.length === 0) return current;
      return { ...current, dominios: next };
    };
    if (id === 'new') { setNewRole(apply); return; }
    setEdits((current) => {
      const role = current[id];
      if (!role) return current;
      return { ...current, [id]: apply(role) };
    });
  };

  const handleSave = async (roleId: number) => {
    const edit = edits[roleId];
    if (!edit) return;
    setSavingId(roleId);
    setMessages((c) => ({ ...c, [roleId]: '' }));
    try {
      const updated = await updateRole(roleId, {
        name: edit.name,
        description: edit.description,
        home_dashboard: edit.homeDashboard,
        dominios: edit.dominios,
        permission_ids: Array.from(edit.permissionIds),
      });
      setRoles((c) => c.map((r) => (r.id === roleId ? updated : r)));
      setMessages((c) => ({ ...c, [roleId]: '✓ Guardado' }));
    } catch (err) {
      setMessages((c) => ({ ...c, [roleId]: err instanceof Error ? err.message : 'Error al guardar' }));
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const created = await createRole({
        name: newRole.name,
        description: newRole.description || null,
        home_dashboard: newRole.homeDashboard,
        dominios: newRole.dominios,
        permission_ids: Array.from(newRole.permissionIds),
      });
      setRoles((c) => [...c, created]);
      setEdits((c) => ({
        ...c,
        [created.id]: {
          name: created.name,
          description: created.description ?? '',
          homeDashboard: created.home_dashboard,
          dominios: created.dominios ?? ['IT'],
          permissionIds: new Set(created.permissions.map((p) => p.id)),
        },
      }));
      setNewRole(emptyEdit());
      setSelectedId(created.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No fue posible crear el rol');
    } finally {
      setCreating(false);
    }
  };

  const selectedRole = typeof selectedId === 'number' ? roles.find((r) => r.id === selectedId) : null;
  const selectedEdit = typeof selectedId === 'number' ? edits[selectedId] : selectedId === 'new' ? newRole : null;

  return (
    <>
      <NavBar />
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-10">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Usuarios</p>
          <h1 className="mt-2 text-3xl font-bold">Roles y permisos</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Configura qué módulos y acciones puede ver o gestionar cada perfil.
          </p>
        </div>

        {error ? (
          <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p>
        ) : null}

        {loading ? (
          <p className="text-slate-700 dark:text-slate-300">Cargando...</p>
        ) : (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">

            {/* Sidebar */}
            <aside className="lg:w-52 lg:shrink-0">
              {/* Mobile: horizontal scroll */}
              <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedId(role.id)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedId === role.id
                        ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200'
                        : 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
                    }`}
                  >
                    {role.name}
                  </button>
                ))}
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setSelectedId('new')}
                    className={`shrink-0 rounded-lg border-2 border-dashed px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedId === 'new'
                        ? 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:border-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300'
                        : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-500'
                    }`}
                  >
                    + Nuevo
                  </button>
                )}
              </div>

              {/* Desktop: vertical sticky panel */}
              <div className="hidden lg:block">
                <div className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
                  <p className="mb-2 px-2 pt-1 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Perfiles
                  </p>
                  <ul className="space-y-0.5">
                    {roles.map((role) => {
                      const permCount = edits[role.id]?.permissionIds.size ?? role.permissions.length;
                      return (
                        <li key={role.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(role.id)}
                            className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                              selectedId === role.id
                                ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200'
                                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="block truncate text-sm font-medium">{role.name}</span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              {permCount} permiso{permCount !== 1 ? 's' : ''}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setSelectedId('new')}
                      className={`mt-2 w-full rounded-lg border-2 border-dashed px-3 py-2 text-sm font-medium transition-colors ${
                        selectedId === 'new'
                          ? 'border-cyan-400 bg-cyan-50 text-cyan-700 dark:border-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300'
                          : 'border-slate-200 text-slate-500 hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-700 dark:text-slate-500 dark:hover:border-cyan-600 dark:hover:text-cyan-400'
                      }`}
                    >
                      + Nuevo rol
                    </button>
                  )}
                </div>
              </div>
            </aside>

            {/* Main panel */}
            <div className="min-w-0 flex-1">
              {selectedId === null ? (
                <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                  <p className="text-slate-400 dark:text-slate-500">Selecciona un perfil</p>
                </div>

              ) : selectedId === 'new' ? (
                <form onSubmit={handleCreateRole} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-5 text-lg font-bold text-slate-900 dark:text-slate-100">Nuevo rol</h2>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label htmlFor="new-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
                      <input
                        id="new-name"
                        value={newRole.name}
                        onChange={(e) => updateField('new', 'name', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="new-desc" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción</label>
                      <input
                        id="new-desc"
                        value={newRole.description}
                        onChange={(e) => updateField('new', 'description', e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor="new-home" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Dashboard de inicio</label>
                      <select
                        id="new-home"
                        value={newRole.homeDashboard}
                        onChange={(e) => updateField('new', 'homeDashboard', e.target.value)}
                      >
                        {HOME_DASHBOARD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Áreas de trabajo</p>
                    <div className="flex gap-4">
                      {DOMINIOS_DISPONIBLES.map((d) => (
                        <label key={d.key} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={newRole.dominios.includes(d.key)}
                            onChange={() => toggleDominio('new', d.key)}
                            className="accent-cyan-500"
                          />
                          <span className="text-slate-700 dark:text-slate-300">{d.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Permisos</p>
                    <PermissionGroups
                      groups={groups}
                      permissionIds={newRole.permissionIds}
                      onToggle={(id) => togglePermission('new', id)}
                      onSetGroup={(ids, checked) => setGroupPermissions('new', ids, checked)}
                      disabled={false}
                    />
                  </div>

                  {createError ? (
                    <p className="mt-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{createError}</p>
                  ) : null}

                  <div className="mt-5">
                    <button
                      type="submit"
                      disabled={creating}
                      className="rounded-lg bg-cyan-600 px-5 py-2 font-semibold text-white hover:bg-cyan-700 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                    >
                      {creating ? 'Creando...' : 'Crear rol'}
                    </button>
                  </div>
                </form>

              ) : selectedRole && selectedEdit ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="mb-5 text-lg font-bold text-slate-900 dark:text-slate-100">{selectedRole.name}</h2>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label htmlFor={`name-${selectedRole.id}`} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
                      <input
                        id={`name-${selectedRole.id}`}
                        value={selectedEdit.name}
                        onChange={(e) => updateField(selectedRole.id, 'name', e.target.value)}
                        disabled={!canWrite}
                      />
                    </div>
                    <div>
                      <label htmlFor={`desc-${selectedRole.id}`} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Descripción</label>
                      <input
                        id={`desc-${selectedRole.id}`}
                        value={selectedEdit.description}
                        onChange={(e) => updateField(selectedRole.id, 'description', e.target.value)}
                        disabled={!canWrite}
                      />
                    </div>
                    <div>
                      <label htmlFor={`home-${selectedRole.id}`} className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Dashboard de inicio</label>
                      <select
                        id={`home-${selectedRole.id}`}
                        value={selectedEdit.homeDashboard}
                        onChange={(e) => updateField(selectedRole.id, 'homeDashboard', e.target.value)}
                        disabled={!canWrite}
                      >
                        {HOME_DASHBOARD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Áreas de trabajo</p>
                    <div className="flex gap-4">
                      {DOMINIOS_DISPONIBLES.map((d) => (
                        <label key={d.key} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedEdit.dominios.includes(d.key)}
                            onChange={() => toggleDominio(selectedRole.id, d.key)}
                            disabled={!canWrite}
                            className="accent-cyan-500"
                          />
                          <span className="text-slate-700 dark:text-slate-300">{d.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6">
                    <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-200">Permisos</p>
                    <PermissionGroups
                      groups={groups}
                      permissionIds={selectedEdit.permissionIds}
                      onToggle={(id) => togglePermission(selectedRole.id, id)}
                      onSetGroup={(ids, checked) => setGroupPermissions(selectedRole.id, ids, checked)}
                      disabled={!canWrite}
                    />
                  </div>

                  {canWrite ? (
                    <div className="mt-5 flex items-center gap-3">
                      <button
                        type="button"
                        disabled={savingId === selectedRole.id}
                        onClick={() => handleSave(selectedRole.id)}
                        className="rounded-lg bg-cyan-600 px-5 py-2 font-semibold text-white hover:bg-cyan-700 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                      >
                        {savingId === selectedRole.id ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                      {messages[selectedRole.id] ? (
                        <span className={`text-sm font-medium ${
                          messages[selectedRole.id].startsWith('✓')
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {messages[selectedRole.id]}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
