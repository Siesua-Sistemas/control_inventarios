type ApiError = {
  detail?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getStoredToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
}

function getStoredRefreshToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
}

function setStoredTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

function clearStoredTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    throw new Error('No se pudo refrescar la sesión');
  }

  const data = await response.json();
  setStoredTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const request = async () => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && path !== '/api/v1/auth/refresh') {
      const refreshedToken = await refreshAccessToken();
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      return fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });
    }

    return response;
  };

  const response = await request();
  const text = await response.text();
  if (!response.ok) {
    const error: ApiError = text ? JSON.parse(text) : {};
    throw new Error(error.detail || 'Error en la solicitud');
  }

  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error en el inicio de sesión');
  }

  const data = await response.json();
  setStoredTokens(data.access_token, data.refresh_token);
  return data;
}

export async function logoutUser() {
  const refreshToken = getStoredRefreshToken();
  clearStoredTokens();

  if (!refreshToken) {
    return;
  }

  await fetch(`${API_BASE}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function getCurrentUser() {
  if (typeof window === 'undefined') {
    return null;
  }

  const accessToken = localStorage.getItem('access_token');
  if (!accessToken) {
    return null;
  }

  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    return {
      id: payload.sub,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

// ── Equipment ────────────────────────────────────────────────────────────────

export interface EquipmentRow {
  id: number;
  codigo_interno: string;
  serial: string;
  tipo: string;
  marca: string;
  modelo: string;
  placa: string | null;
  sede: string;
  ubicacion: string | null;
  estado: string;
  specs: Record<string, unknown> | null;
  fecha_compra: string | null;
  valor: string | null;
  proveedor: string | null;
  numero_factura: string | null;
  garantia_vence: string | null;
  observaciones: string | null;
  bodega_id: number | null;
  empleado_id: number | null;
  empleado_nombre?: string | null;
  parent_equipment_id: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EquipmentListResponse {
  total: number;
  items: EquipmentRow[];
}

export interface EquipmentFilters {
  search?: string;
  tipo?: string;
  sede?: string;
  estado?: string;
}

export async function listEquipment(filters: EquipmentFilters = {}): Promise<EquipmentListResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.tipo) params.set('tipo', filters.tipo);
  if (filters.sede) params.set('sede', filters.sede);
  if (filters.estado) params.set('estado', filters.estado);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<EquipmentListResponse>(`/api/v1/equipos${query}`);
}

export async function getEquipment(id: number): Promise<EquipmentRow> {
  return apiRequest<EquipmentRow>(`/api/v1/equipos/${id}`);
}

export type EquipmentPayload = Omit<EquipmentRow, 'id' | 'codigo_interno' | 'is_active' | 'created_at' | 'updated_at'>;

export async function createEquipment(data: EquipmentPayload): Promise<EquipmentRow> {
  return apiRequest<EquipmentRow>('/api/v1/equipos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateEquipment(id: number, data: Partial<EquipmentPayload>): Promise<EquipmentRow> {
  return apiRequest<EquipmentRow>(`/api/v1/equipos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteEquipment(id: number): Promise<void> {
  await apiRequest<void>(`/api/v1/equipos/${id}`, { method: 'DELETE' });
}

// ── Bodegas ───────────────────────────────────────────────────────────────────

export interface BodegaRow {
  id: number;
  nombre: string;
  sede: string;
  responsable: string | null;
  descripcion: string | null;
  total_equipos: number;
  is_active: boolean;
  created_at: string;
}

export interface BodegaInventario {
  bodega: BodegaRow;
  total: number;
  por_tipo: Record<string, number>;
  por_estado: Record<string, number>;
  equipos: EquipmentRow[];
}

export async function listBodegas(sede?: string): Promise<{ total: number; items: BodegaRow[] }> {
  const q = sede ? `?sede=${encodeURIComponent(sede)}` : '';
  return apiRequest(`/api/v1/bodegas${q}`);
}

export async function createBodega(data: Omit<BodegaRow, 'id' | 'total_equipos' | 'is_active' | 'created_at'>): Promise<BodegaRow> {
  return apiRequest('/api/v1/bodegas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export async function getBodegaInventario(id: number): Promise<BodegaInventario> {
  return apiRequest(`/api/v1/bodegas/${id}/inventario`);
}

export async function deleteBodega(id: number): Promise<void> {
  await apiRequest(`/api/v1/bodegas/${id}`, { method: 'DELETE' });
}

// ── Empleados ─────────────────────────────────────────────────────────────────

export interface EmpleadoRow {
  id: number;
  nombres: string;
  apellidos: string;
  cedula: string;
  cargo: string | null;
  departamento: string | null;
  sede: string | null;
  email: string | null;
  telefono: string | null;
  nombre_completo: string;
  is_active: boolean;
  created_at: string;
}

export async function listEmpleados(search?: string): Promise<{ total: number; items: EmpleadoRow[] }> {
  const q = search ? `?search=${encodeURIComponent(search)}` : '';
  return apiRequest(`/api/v1/empleados${q}`);
}

export async function createEmpleado(data: Omit<EmpleadoRow, 'id' | 'nombre_completo' | 'is_active' | 'created_at'>): Promise<EmpleadoRow> {
  return apiRequest('/api/v1/empleados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export async function deleteEmpleado(id: number): Promise<void> {
  await apiRequest(`/api/v1/empleados/${id}`, { method: 'DELETE' });
}

// ── Asignaciones ──────────────────────────────────────────────────────────────

export interface AsignacionRow {
  id: number;
  tipo: string;
  fecha: string;
  estado_antes: string | null;
  estado_despues: string;
  observaciones: string | null;
  equipment_id: number;
  equipment_codigo: string;
  equipment_serial: string;
  equipment_tipo: string;
  equipment_marca: string;
  equipment_modelo: string;
  equipment_sede: string;
  empleado_id: number | null;
  empleado_nombre: string | null;
  empleado_cedula: string | null;
  bodega_origen_nombre: string | null;
  bodega_destino_nombre: string | null;
  created_by_nombre: string;
  created_at: string;
}

export async function entregar(data: { equipment_id: number; empleado_id: number; bodega_origen_id?: number; observaciones?: string }): Promise<AsignacionRow> {
  return apiRequest('/api/v1/asignaciones/entregar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export async function entregarMultiple(data: { equipment_ids: number[]; empleado_id: number; bodega_origen_id?: number; observaciones?: string }): Promise<AsignacionRow[]> {
  return apiRequest('/api/v1/asignaciones/entregar-multiple', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export async function devolver(data: { equipment_id: number; bodega_destino_id?: number; observaciones?: string }): Promise<AsignacionRow> {
  return apiRequest('/api/v1/asignaciones/devolver', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export async function trasladar(data: { equipment_id: number; bodega_destino_id: number; observaciones?: string }): Promise<AsignacionRow> {
  return apiRequest('/api/v1/asignaciones/trasladar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export async function listAsignacionesActivas(): Promise<{ total: number; items: AsignacionRow[] }> {
  return apiRequest('/api/v1/asignaciones/activas');
}

export async function listHistorial(filters: { equipment_id?: number; empleado_id?: number; tipo?: string; desde?: string; hasta?: string; skip?: number; limit?: number } = {}): Promise<{ total: number; items: AsignacionRow[] }> {
  const p = new URLSearchParams();
  if (filters.equipment_id) p.set('equipment_id', String(filters.equipment_id));
  if (filters.empleado_id) p.set('empleado_id', String(filters.empleado_id));
  if (filters.tipo) p.set('tipo', filters.tipo);
  if (filters.desde) p.set('desde', filters.desde);
  if (filters.hasta) p.set('hasta', filters.hasta);
  if (filters.skip) p.set('skip', String(filters.skip));
  if (filters.limit) p.set('limit', String(filters.limit));
  return apiRequest(`/api/v1/asignaciones/historial${p.toString() ? '?' + p.toString() : ''}`);
}

// ── Equipment Hoja de Vida ────────────────────────────────────────────────────

export interface SpecField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'scale';
  options?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
}

export interface EquipmentBrief {
  id: number;
  codigo_interno: string;
  tipo: string;
  marca: string;
  modelo: string;
  serial: string;
  estado: string;
}

export interface EquipmentPhotoOut {
  id: number;
  equipment_id: number;
  filename: string;
  url: string;
  created_at: string;
}

export interface EquipmentProfile {
  equipment: EquipmentRow;
  specs_template: SpecField[];
  parent: EquipmentBrief | null;
  children: EquipmentBrief[];
  photos: EquipmentPhotoOut[];
}

export async function getEquipmentProfile(id: number): Promise<EquipmentProfile> {
  return apiRequest<EquipmentProfile>(`/api/v1/equipos/${id}/hoja-de-vida`);
}

export async function updateEquipmentSpecs(id: number, specs: Record<string, unknown>): Promise<EquipmentRow> {
  return apiRequest<EquipmentRow>(`/api/v1/equipos/${id}/specs`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(specs),
  });
}

export async function setEquipmentParent(id: number, parentId: number | null): Promise<EquipmentRow> {
  const qs = parentId !== null ? `?parent_id=${parentId}` : '';
  return apiRequest<EquipmentRow>(`/api/v1/equipos/${id}/parent${qs}`, { method: 'PATCH' });
}

// ── Actas de Entrega ──────────────────────────────────────────────────────────

export interface EquipoSnapshot {
  id: number;
  codigo_interno: string;
  serial: string;
  tipo: string;
  marca: string;
  modelo: string;
  estado: string;
}

export interface ActaEntregaRow {
  id: number;
  tipo: string;
  sede: string;
  titulo: string;
  entrega_nombre: string;
  recibe_nombre: string;
  firma_entrega: string | null;
  firma_recibe: string | null;
  equipos_snapshot: EquipoSnapshot[];
  bodega_id: number | null;
  empleado_id: number | null;
  observaciones: string | null;
  fecha: string;
  created_by_nombre: string | null;
  total_equipos: number;
}

interface ActaEntregaCreate {
  tipo: string;
  sede: string;
  titulo: string;
  entrega_nombre: string;
  recibe_nombre: string;
  firma_entrega?: string;
  firma_recibe?: string;
  equipos_snapshot: EquipoSnapshot[];
  bodega_id?: number;
  empleado_id?: number;
  observaciones?: string;
}

export async function createActaEntrega(data: ActaEntregaCreate): Promise<ActaEntregaRow> {
  return apiRequest('/api/v1/actas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function listActas(filters: {
  tipo?: string;
  sede?: string;
  bodega_id?: number;
  empleado_id?: number;
  desde?: string;
  hasta?: string;
  skip?: number;
  limit?: number;
} = {}): Promise<{ total: number; items: ActaEntregaRow[] }> {
  const p = new URLSearchParams();
  if (filters.tipo) p.set('tipo', filters.tipo);
  if (filters.sede) p.set('sede', filters.sede);
  if (filters.bodega_id) p.set('bodega_id', String(filters.bodega_id));
  if (filters.empleado_id) p.set('empleado_id', String(filters.empleado_id));
  if (filters.desde) p.set('desde', filters.desde);
  if (filters.hasta) p.set('hasta', filters.hasta);
  if (filters.skip) p.set('skip', String(filters.skip));
  if (filters.limit) p.set('limit', String(filters.limit));
  return apiRequest(`/api/v1/actas${p.toString() ? '?' + p.toString() : ''}`);
}

export async function getActa(id: number): Promise<ActaEntregaRow> {
  return apiRequest(`/api/v1/actas/${id}`);
}

export async function uploadEquipmentPhoto(id: number, file: File): Promise<EquipmentPhotoOut> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/api/v1/equipos/${id}/fotos`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as ApiError).detail || 'Error al subir foto');
  }
  return response.json();
}

export async function deleteEquipmentPhoto(equipmentId: number, photoId: number): Promise<void> {
  await apiRequest<void>(`/api/v1/equipos/${equipmentId}/fotos/${photoId}`, { method: 'DELETE' });
}

export async function getSpecsTemplate(tipo: string): Promise<{ tipo: string; fields: SpecField[] }> {
  return apiRequest(`/api/v1/equipos/specs-template?tipo=${encodeURIComponent(tipo)}`);
}

// ── Mantenimientos ────────────────────────────────────────────────────────────

export interface MantenimientoRow {
  id: number;
  equipment_id: number;
  equipment_codigo: string;
  equipment_marca: string;
  equipment_modelo: string;
  tipo: string;
  fecha: string;
  tecnico: string | null;
  descripcion: string;
  costo: string | null;
  observaciones: string | null;
  proximo_mantenimiento: string | null;
  created_by_nombre: string;
  created_at: string;
}

export interface MantenimientoPayload {
  equipment_id: number;
  tipo: string;
  fecha: string;
  tecnico?: string;
  descripcion: string;
  costo?: number;
  observaciones?: string;
  proximo_mantenimiento?: string;
}

export async function listMantenimientos(equipment_id: number): Promise<{ total: number; items: MantenimientoRow[] }> {
  return apiRequest(`/api/v1/mantenimientos?equipment_id=${equipment_id}`);
}

export async function createMantenimiento(data: MantenimientoPayload): Promise<MantenimientoRow> {
  return apiRequest('/api/v1/mantenimientos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateMantenimiento(id: number, data: Partial<MantenimientoPayload>): Promise<MantenimientoRow> {
  return apiRequest(`/api/v1/mantenimientos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteMantenimiento(id: number): Promise<void> {
  await apiRequest<void>(`/api/v1/mantenimientos/${id}`, { method: 'DELETE' });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_equipos: number;
  total_bodegas: number;
  total_empleados: number;
  asignaciones_hoy: number;
  por_estado: Record<string, number>;
  ultimos_movimientos: AsignacionRow[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest('/api/v1/dashboard');
}

// ── Usuarios, roles y permisos ────────────────────────────────────────────────

export interface PermissionItem {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

export interface RoleItem {
  id: number;
  name: string;
  description: string | null;
  permissions: PermissionItem[];
}

export interface UserItem {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  roles: RoleItem[];
}

export interface MeResponse {
  id: number;
  email: string;
  full_name: string;
  roles: string[];
  permissions: string[];
}

export async function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/api/v1/auth/me');
}

export async function listUsers(): Promise<{ total: number; items: UserItem[] }> {
  return apiRequest('/api/v1/users');
}

export async function getUser(id: number): Promise<UserItem> {
  return apiRequest(`/api/v1/users/${id}`);
}

export interface UserUpdatePayload {
  email?: string;
  full_name?: string;
  password?: string;
  is_active?: boolean;
  role_ids?: number[];
}

export async function updateUser(id: number, data: UserUpdatePayload): Promise<UserItem> {
  return apiRequest<UserItem>(`/api/v1/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function listRoles(): Promise<RoleItem[]> {
  return apiRequest('/api/v1/users/roles');
}

export async function listPermissions(): Promise<PermissionItem[]> {
  return apiRequest('/api/v1/users/permissions');
}

export interface RolePayload {
  name: string;
  description?: string | null;
  permission_ids: number[];
}

export async function createRole(data: RolePayload): Promise<RoleItem> {
  return apiRequest<RoleItem>('/api/v1/users/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateRole(id: number, data: Partial<RolePayload>): Promise<RoleItem> {
  return apiRequest<RoleItem>(`/api/v1/users/roles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
