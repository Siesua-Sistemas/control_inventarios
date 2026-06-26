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

const DOMINIOS_DISPONIBLES = [
  { key: 'IT', label: 'IT (Tecnología)' },
  { key: 'BIOINGENIERIA', label: 'Bioingeniería' },
];

interface RoleEdit {
  name: string;
  description: string;
  homeDashboard: string;
  dominios: string[];
  permissionIds: Set<number>;
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

  const [newRole, setNewRole] = useState<{ name: string; description: string; homeDashboard: string; dominios: string[]; permissionIds: Set<number> }>({
    name: '',
    description: '',
    homeDashboard: 'general',
    dominios: ['IT'],
    permissionIds: new Set(),
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const canWrite = !authLoading && hasPermission('roles:write');
  const groups = useMemo(() => groupPermissions(permissions), [permissions]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    if (!authLoading && !hasPermission('roles:read')) {
      router.replace('/users');
      return;
    }

    if (authLoading) return;

    const load = async () => {
      try {
        const [rolesResponse, permissionsResponse] = await Promise.all([listRoles(), listPermissions()]);
        setRoles(rolesResponse);
        setPermissions(permissionsResponse);
        const initialEdits: Record<number, RoleEdit> = {};
        for (const role of rolesResponse) {
          initialEdits[role.id] = {
            name: role.name,
            description: role.description ?? '',
            homeDashboard: role.home_dashboard,
            dominios: role.dominios ?? ['IT'],
            permissionIds: new Set(role.permissions.map((p) => p.id)),
          };
        }
        setEdits(initialEdits);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar roles y permisos');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router, authLoading, hasPermission]);

  const togglePermission = (roleId: number, permissionId: number) => {
    setEdits((current) => {
      const role = current[roleId];
      if (!role) return current;
      const next = new Set(role.permissionIds);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return { ...current, [roleId]: { ...role, permissionIds: next } };
    });
  };

  const updateField = (roleId: number, field: 'name' | 'description' | 'homeDashboard', value: string) => {
    setEdits((current) => {
      const role = current[roleId];
      if (!role) return current;
      return { ...current, [roleId]: { ...role, [field]: value } };
    });
  };

  const toggleDominio = (roleId: number, dominio: string) => {
    setEdits((current) => {
      const role = current[roleId];
      if (!role) return current;
      const current_dominios = role.dominios;
      const next = current_dominios.includes(dominio)
        ? current_dominios.filter((d) => d !== dominio)
        : [...current_dominios, dominio];
      if (next.length === 0) return current; // must have at least one
      return { ...current, [roleId]: { ...role, dominios: next } };
    });
  };

  const handleSave = async (roleId: number) => {
    const edit = edits[roleId];
    if (!edit) return;
    setSavingId(roleId);
    setMessages((current) => ({ ...current, [roleId]: '' }));

    try {
      const updated = await updateRole(roleId, {
        name: edit.name,
        description: edit.description,
        home_dashboard: edit.homeDashboard,
        dominios: edit.dominios,
        permission_ids: Array.from(edit.permissionIds),
      });
      setRoles((current) => current.map((role) => (role.id === roleId ? updated : role)));
      setMessages((current) => ({ ...current, [roleId]: 'Cambios guardados' }));
    } catch (err) {
      setMessages((current) => ({
        ...current,
        [roleId]: err instanceof Error ? err.message : 'No fue posible guardar',
      }));
    } finally {
      setSavingId(null);
    }
  };

  const toggleNewRolePermission = (permissionId: number) => {
    setNewRole((current) => {
      const next = new Set(current.permissionIds);
      if (next.has(permissionId)) next.delete(permissionId);
      else next.add(permissionId);
      return { ...current, permissionIds: next };
    });
  };

  const handleCreateRole = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      const created = await createRole({
        name: newRole.name,
        description: newRole.description || null,
        home_dashboard: newRole.homeDashboard,
        dominios: newRole.dominios,
        permission_ids: Array.from(newRole.permissionIds),
      });
      setRoles((current) => [...current, created]);
      setEdits((current) => ({
        ...current,
        [created.id]: {
          name: created.name,
          description: created.description ?? '',
          homeDashboard: created.home_dashboard,
          dominios: created.dominios ?? ['IT'],
          permissionIds: new Set(created.permissions.map((p) => p.id)),
        },
      }));
      setNewRole({ name: '', description: '', homeDashboard: 'general', dominios: ['IT'], permissionIds: new Set() });
      setCreateSuccess('Rol creado correctamente');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No fue posible crear el rol');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <NavBar />
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Usuarios</p>
          <h1 className="mt-2 text-3xl font-bold">Roles y permisos</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Configura qué módulos y acciones puede ver o gestionar cada perfil. Los elementos sin permiso quedarán
            ocultos para los usuarios con ese rol.
          </p>
        </div>

        {error ? <p className="mb-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{error}</p> : null}

        {loading ? (
          <p className="text-slate-700 dark:text-slate-300">Cargando...</p>
        ) : (
          <div className="space-y-6">
            {roles.map((role) => {
              const edit = edits[role.id];
              if (!edit) return null;
              return (
                <div key={role.id} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label htmlFor={`name-${role.id}`}>Nombre del rol</label>
                      <input
                        id={`name-${role.id}`}
                        value={edit.name}
                        onChange={(event) => updateField(role.id, 'name', event.target.value)}
                        disabled={!canWrite}
                      />
                    </div>
                    <div>
                      <label htmlFor={`description-${role.id}`}>Descripción</label>
                      <input
                        id={`description-${role.id}`}
                        value={edit.description}
                        onChange={(event) => updateField(role.id, 'description', event.target.value)}
                        disabled={!canWrite}
                      />
                    </div>
                    <div>
                      <label htmlFor={`home-dashboard-${role.id}`}>Dashboard de inicio</label>
                      <select
                        id={`home-dashboard-${role.id}`}
                        value={edit.homeDashboard}
                        onChange={(event) => updateField(role.id, 'homeDashboard', event.target.value)}
                        disabled={!canWrite}
                      >
                        {HOME_DASHBOARD_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Áreas de trabajo</p>
                    <div className="flex gap-4">
                      {DOMINIOS_DISPONIBLES.map((d) => (
                        <label key={d.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={edit.dominios.includes(d.key)}
                            onChange={() => toggleDominio(role.id, d.key)}
                            disabled={!canWrite}
                          />
                          {d.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {groups.map((group) => (
                      <div key={group.moduleKey} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                        <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{group.label}</p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {group.permissions.map((permission) => (
                            <label key={permission.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={edit.permissionIds.has(permission.id)}
                                onChange={() => togglePermission(role.id, permission.id)}
                                disabled={!canWrite}
                              />
                              <span className="text-sm">{permission.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {canWrite ? (
                    <div className="mt-5 flex items-center gap-3">
                      <button type="button" className="px-4 py-2 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400" disabled={savingId === role.id} onClick={() => handleSave(role.id)}>
                        {savingId === role.id ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                      {messages[role.id] ? <span className="text-sm text-slate-700 dark:text-slate-300">{messages[role.id]}</span> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {canWrite ? (
              <form onSubmit={handleCreateRole} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="mb-4 text-xl font-bold">Crear nuevo rol</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label htmlFor="new-role-name">Nombre del rol</label>
                    <input
                      id="new-role-name"
                      value={newRole.name}
                      onChange={(event) => setNewRole((current) => ({ ...current, name: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="new-role-description">Descripción</label>
                    <input
                      id="new-role-description"
                      value={newRole.description}
                      onChange={(event) => setNewRole((current) => ({ ...current, description: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="new-role-home-dashboard">Dashboard de inicio</label>
                    <select
                      id="new-role-home-dashboard"
                      value={newRole.homeDashboard}
                      onChange={(event) => setNewRole((current) => ({ ...current, homeDashboard: event.target.value }))}
                    >
                      {HOME_DASHBOARD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Áreas de trabajo</p>
                  <div className="flex gap-4">
                    {DOMINIOS_DISPONIBLES.map((d) => (
                      <label key={d.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={newRole.dominios.includes(d.key)}
                          onChange={() => {
                            const next = newRole.dominios.includes(d.key)
                              ? newRole.dominios.filter((x) => x !== d.key)
                              : [...newRole.dominios, d.key];
                            if (next.length > 0) setNewRole((c) => ({ ...c, dominios: next }));
                          }}
                        />
                        {d.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {groups.map((group) => (
                    <div key={group.moduleKey} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                      <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">{group.label}</p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {group.permissions.map((permission) => (
                          <label key={permission.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={newRole.permissionIds.has(permission.id)}
                              onChange={() => toggleNewRolePermission(permission.id)}
                            />
                            <span className="text-sm">{permission.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {createError ? <p className="mt-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/20 dark:text-red-200">{createError}</p> : null}
                {createSuccess ? <p className="mt-4 rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">{createSuccess}</p> : null}

                <div className="mt-5">
                  <button type="submit" className="px-4 py-2 bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400" disabled={creating}>
                    {creating ? 'Creando...' : 'Crear rol'}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        )}
      </main>
    </>
  );
}
