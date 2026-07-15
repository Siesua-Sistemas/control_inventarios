type ApiError = {
  detail?: string;
};

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function storageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Rewrite /storage/ → /api/storage/ so Traefik routes it to the backend via the /api prefix
  const normalized = path.startsWith('/storage/')
    ? '/api/storage/' + path.slice('/storage/'.length)
    : path;
  return `${API_BASE}${normalized}`;
}

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

async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error('Error al descargar el archivo');
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
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
  criticidad: string;
  dominio: string;
  specs: Record<string, unknown> | null;
  fecha_compra: string | null;
  valor: string | null;
  proveedor: string | null;
  numero_factura: string | null;
  garantia_vence: string | null;
  observaciones: string | null;
  fecha_calibracion: string | null;
  vencimiento_calibracion: string | null;
  frecuencia_calibracion_meses: number | null;
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
  criticidad?: string;
  dominio?: string;
  skip?: number;
  limit?: number;
}

export async function listEquipment(filters: EquipmentFilters = {}): Promise<EquipmentListResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.tipo) params.set('tipo', filters.tipo);
  if (filters.sede) params.set('sede', filters.sede);
  if (filters.estado) params.set('estado', filters.estado);
  if (filters.criticidad) params.set('criticidad', filters.criticidad);
  if (filters.dominio) params.set('dominio', filters.dominio);
  if (filters.skip) params.set('skip', String(filters.skip));
  if (filters.limit) params.set('limit', String(filters.limit));
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<EquipmentListResponse>(`/api/v1/equipos${query}`);
}

export async function exportEquiposCsv(filters: Omit<EquipmentFilters, 'skip' | 'limit'> = {}): Promise<void> {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.tipo) params.set('tipo', filters.tipo);
  if (filters.sede) params.set('sede', filters.sede);
  if (filters.estado) params.set('estado', filters.estado);
  if (filters.criticidad) params.set('criticidad', filters.criticidad);
  if (filters.dominio) params.set('dominio', filters.dominio);
  const query = params.toString() ? `?${params.toString()}` : '';
  await downloadFile(`/api/v1/equipos/export${query}`, 'inventario_equipos.csv');
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
  dominio: string;
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
  const params = new URLSearchParams();
  if (sede) params.set('sede', sede);
  const q = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/api/v1/bodegas${q}`);
}

export async function createBodega(data: Omit<BodegaRow, 'id' | 'total_equipos' | 'is_active' | 'created_at'>): Promise<BodegaRow> {
  return apiRequest('/api/v1/bodegas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export async function getBodegaInventario(id: number): Promise<BodegaInventario> {
  return apiRequest(`/api/v1/bodegas/${id}/inventario`);
}

export async function updateBodega(id: number, data: Partial<Pick<BodegaRow, 'nombre' | 'sede' | 'responsable' | 'descripcion' | 'dominio'>>): Promise<BodegaRow> {
  return apiRequest(`/api/v1/bodegas/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
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
  en_jornada: boolean;
  sedes_jornada_ids: number[];
  nombre_completo: string;
  is_active: boolean;
  created_at: string;
}

export interface EmpleadoFilters {
  search?: string;
  sede?: string;
  skip?: number;
  limit?: number;
}

export async function listEmpleados(filters: EmpleadoFilters = {}): Promise<{ total: number; items: EmpleadoRow[] }> {
  const p = new URLSearchParams();
  if (filters.search) p.set('search', filters.search);
  if (filters.sede) p.set('sede', filters.sede);
  if (filters.skip) p.set('skip', String(filters.skip));
  if (filters.limit) p.set('limit', String(filters.limit));
  return apiRequest(`/api/v1/empleados${p.toString() ? '?' + p.toString() : ''}`);
}

export async function createEmpleado(data: Omit<EmpleadoRow, 'id' | 'nombre_completo' | 'is_active' | 'created_at'>): Promise<EmpleadoRow> {
  return apiRequest('/api/v1/empleados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export async function getEmpleado(id: number): Promise<EmpleadoRow> {
  return apiRequest(`/api/v1/empleados/${id}`);
}

export async function updateEmpleado(id: number, data: Omit<EmpleadoRow, 'id' | 'nombre_completo' | 'is_active' | 'created_at'>): Promise<EmpleadoRow> {
  return apiRequest(`/api/v1/empleados/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
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

export async function entregarMultiple(data: { equipment_ids: number[]; empleado_id?: number; bodega_origen_id?: number; sede_destino?: string; responsable_nombre?: string; observaciones?: string }): Promise<AsignacionRow[]> {
  return apiRequest('/api/v1/asignaciones/entregar-multiple', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export async function devolver(data: { equipment_id: number; bodega_destino_id?: number; observaciones?: string }): Promise<AsignacionRow> {
  return apiRequest('/api/v1/asignaciones/devolver', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export async function trasladar(data: { equipment_id: number; bodega_destino_id: number; observaciones?: string }): Promise<AsignacionRow> {
  return apiRequest('/api/v1/asignaciones/trasladar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}

export async function listAsignacionesActivas(): Promise<{ total: number; items: AsignacionRow[] }> {
  return apiRequest(`/api/v1/asignaciones/activas`);
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

export async function exportHistorialCsv(filters: { equipment_id?: number; empleado_id?: number; tipo?: string; desde?: string; hasta?: string } = {}): Promise<void> {
  const p = new URLSearchParams();
  if (filters.equipment_id) p.set('equipment_id', String(filters.equipment_id));
  if (filters.empleado_id) p.set('empleado_id', String(filters.empleado_id));
  if (filters.tipo) p.set('tipo', filters.tipo);
  if (filters.desde) p.set('desde', filters.desde);
  if (filters.hasta) p.set('hasta', filters.hasta);
  await downloadFile(`/api/v1/asignaciones/historial/export${p.toString() ? '?' + p.toString() : ''}`, 'historial_movimientos.csv');
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

export interface EquipmentTipo {
  id: number;
  nombre: string;
  dominio: string;
  es_periferico: boolean;
  activo: boolean;
  orden: number;
  specs: SpecField[];
  created_at: string;
  updated_at: string;
}

export interface EquipmentTipoPayload {
  nombre: string;
  dominio?: string;
  es_periferico?: boolean;
  activo?: boolean;
  orden?: number;
}

export async function listEquipmentTipos(): Promise<{ total: number; items: EquipmentTipo[] }> {
  return apiRequest('/api/v1/equipos/tipos');
}

export async function createEquipmentTipo(data: EquipmentTipoPayload): Promise<EquipmentTipo> {
  return apiRequest('/api/v1/equipos/tipos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateEquipmentTipo(id: number, data: Partial<EquipmentTipoPayload>): Promise<EquipmentTipo> {
  return apiRequest(`/api/v1/equipos/tipos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateEquipmentTipoSpecs(id: number, specs: SpecField[]): Promise<EquipmentTipo> {
  return apiRequest(`/api/v1/equipos/tipos/${id}/specs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ specs }),
  });
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

export interface EquipmentDocumentoOut {
  id: number;
  equipment_id: number;
  filename: string;
  nombre: string;
  tipo_doc: string;
  url: string;
  created_at: string;
}

export interface EquipmentProfile {
  equipment: EquipmentRow;
  specs_template: SpecField[];
  parent: EquipmentBrief | null;
  children: EquipmentBrief[];
  photos: EquipmentPhotoOut[];
  documentos: EquipmentDocumentoOut[];
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

export async function uploadEquipmentDocumento(
  equipmentId: number,
  file: File,
  nombre: string,
  tipo_doc: string,
): Promise<EquipmentDocumentoOut> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('nombre', nombre);
  fd.append('tipo_doc', tipo_doc);
  return apiRequest<EquipmentDocumentoOut>(`/api/v1/equipos/${equipmentId}/documentos`, {
    method: 'POST',
    body: fd,
  });
}

export async function deleteEquipmentDocumento(equipmentId: number, docId: number): Promise<void> {
  await apiRequest<void>(`/api/v1/equipos/${equipmentId}/documentos/${docId}`, { method: 'DELETE' });
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

export async function exportActasCsv(filters: {
  tipo?: string;
  sede?: string;
  bodega_id?: number;
  empleado_id?: number;
  desde?: string;
  hasta?: string;
} = {}): Promise<void> {
  const p = new URLSearchParams();
  if (filters.tipo) p.set('tipo', filters.tipo);
  if (filters.sede) p.set('sede', filters.sede);
  if (filters.bodega_id) p.set('bodega_id', String(filters.bodega_id));
  if (filters.empleado_id) p.set('empleado_id', String(filters.empleado_id));
  if (filters.desde) p.set('desde', filters.desde);
  if (filters.hasta) p.set('hasta', filters.hasta);
  await downloadFile(`/api/v1/actas/export${p.toString() ? '?' + p.toString() : ''}`, 'actas_firmadas.csv');
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

// ── Mantenimientos ────────────────────────────────────────────────────────────

export interface MantenimientoPhotoOut {
  id: number;
  mantenimiento_id: number;
  filename: string;
  url: string;
  created_at: string;
}

export type TipoCampoPaso = 'checkbox' | 'numero' | 'texto' | 'seleccion';

export interface PasoRow {
  id: number;
  mantenimiento_id: number;
  orden: number;
  descripcion: string;
  completado: boolean;
  completado_en: string | null;
  tipo_campo: TipoCampoPaso;
  unidad: string | null;
  opciones: string[] | null;
  valor_min: string | null;
  valor_max: string | null;
  obligatorio: boolean;
  valor: string | null;
}

export interface PlantillaPasoRow {
  id: number;
  tipo_equipo: string;
  tipo_mantenimiento: string;
  descripcion: string;
  orden: number;
  tipo_campo: TipoCampoPaso;
  unidad: string | null;
  opciones: string[] | null;
  valor_min: string | null;
  valor_max: string | null;
  obligatorio: boolean;
}

export interface MantenimientoRow {
  id: number;
  numero_ot: string | null;
  equipment_id: number;
  equipment_codigo: string;
  equipment_marca: string;
  equipment_modelo: string;
  equipment_tipo: string;
  equipment_sede: string;
  tipo: string;
  fecha: string;
  tecnico: string | null;
  tecnico_id: number | null;
  tecnico_nombre: string | null;
  descripcion: string;
  costo: string | null;
  observaciones: string | null;
  proximo_mantenimiento: string | null;
  estado: string;
  prioridad: string;
  firma_tecnico: string | null;
  firma_supervisor: string | null;
  aprobado_por_nombre: string | null;
  aprobado_en: string | null;
  comentario_aprobacion: string | null;
  created_by_nombre: string;
  created_at: string;
  fotos: MantenimientoPhotoOut[];
  pasos: PasoRow[];
}

export interface UserBasic {
  id: number;
  full_name: string;
  email: string;
}

export async function listUsersBasic(): Promise<UserBasic[]> {
  return apiRequest('/api/v1/users/basico');
}

export interface MantenimientoPayload {
  equipment_id: number;
  tipo: string;
  fecha: string;
  tecnico?: string;
  tecnico_id?: number | null;
  descripcion: string;
  prioridad?: string;
  costo?: number;
  observaciones?: string;
  proximo_mantenimiento?: string;
  estado?: string;
}

export interface MantenimientoFilters {
  equipment_id?: number;
  sede?: string;
  tipo?: string;
  tipo_equipo?: string;
  estado_vencimiento?: 'vencido' | 'proximo' | 'al_dia';
  proximo_desde?: string;
  proximo_hasta?: string;
  estado?: string;
  skip?: number;
  limit?: number;
}

export async function listMantenimientos(filters: MantenimientoFilters | number = {}): Promise<{ total: number; items: MantenimientoRow[] }> {
  const f: MantenimientoFilters = typeof filters === 'number' ? { equipment_id: filters } : filters;
  const p = new URLSearchParams();
  if (f.equipment_id) p.set('equipment_id', String(f.equipment_id));
  if (f.sede) p.set('sede', f.sede);
  if (f.tipo) p.set('tipo', f.tipo);
  if (f.tipo_equipo) p.set('tipo_equipo', f.tipo_equipo);
  if (f.estado_vencimiento) p.set('estado_vencimiento', f.estado_vencimiento);
  if (f.proximo_desde) p.set('proximo_desde', f.proximo_desde);
  if (f.proximo_hasta) p.set('proximo_hasta', f.proximo_hasta);
  if (f.estado) p.set('estado', f.estado);
  if (f.skip) p.set('skip', String(f.skip));
  if (f.limit) p.set('limit', String(f.limit));
  return apiRequest(`/api/v1/mantenimientos${p.toString() ? '?' + p.toString() : ''}`);
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

export async function patchMantenimiento(
  id: number,
  data: { estado?: string; proximo_mantenimiento?: string },
): Promise<MantenimientoRow> {
  return apiRequest(`/api/v1/mantenimientos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteMantenimiento(id: number): Promise<void> {
  await apiRequest<void>(`/api/v1/mantenimientos/${id}`, { method: 'DELETE' });
}

export async function uploadMantenimientoPhoto(id: number, file: File): Promise<MantenimientoPhotoOut> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/api/v1/mantenimientos/${id}/fotos`, {
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

export async function deleteMantenimientoPhoto(mantenimientoId: number, photoId: number): Promise<void> {
  await apiRequest<void>(`/api/v1/mantenimientos/${mantenimientoId}/fotos/${photoId}`, { method: 'DELETE' });
}

// ── Mantenimientos: pasos (checklist) ─────────────────────────────────────────

export async function addPaso(mantenimientoId: number, descripcion: string, orden?: number): Promise<PasoRow> {
  return apiRequest<PasoRow>(`/api/v1/mantenimientos/${mantenimientoId}/pasos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descripcion, orden: orden ?? 0 }),
  });
}

export async function updatePaso(mantenimientoId: number, pasoId: number, data: { completado?: boolean; descripcion?: string; valor?: string }): Promise<PasoRow> {
  return apiRequest<PasoRow>(`/api/v1/mantenimientos/${mantenimientoId}/pasos/${pasoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deletePaso(mantenimientoId: number, pasoId: number): Promise<void> {
  await apiRequest<void>(`/api/v1/mantenimientos/${mantenimientoId}/pasos/${pasoId}`, { method: 'DELETE' });
}

export async function firmarTecnico(mantenimientoId: number, firma: string): Promise<MantenimientoRow> {
  return apiRequest<MantenimientoRow>(`/api/v1/mantenimientos/${mantenimientoId}/firma-tecnico`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firma_tecnico: firma }),
  });
}

export async function aprobarMantenimiento(
  mantenimientoId: number,
  data: { aprobado: boolean; comentario?: string; firma_supervisor?: string },
): Promise<MantenimientoRow> {
  return apiRequest<MantenimientoRow>(`/api/v1/mantenimientos/${mantenimientoId}/aprobar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function iniciarMantenimiento(mantenimientoId: number): Promise<MantenimientoRow> {
  return apiRequest<MantenimientoRow>(`/api/v1/mantenimientos/${mantenimientoId}/iniciar`, {
    method: 'POST',
  });
}

export async function getMisOt(): Promise<{ total: number; items: MantenimientoRow[] }> {
  return apiRequest('/api/v1/mantenimientos/mis-ot');
}

export async function getMisTickets(): Promise<{ total: number; items: TicketOut[] }> {
  return apiRequest('/api/v1/tickets/mis-tickets');
}

// ── Mantenimientos: plantillas ────────────────────────────────────────────────

export async function listPlantillas(filters: { tipo_equipo?: string; tipo_mantenimiento?: string } = {}): Promise<PlantillaPasoRow[]> {
  const p = new URLSearchParams();
  if (filters.tipo_equipo) p.set('tipo_equipo', filters.tipo_equipo);
  if (filters.tipo_mantenimiento) p.set('tipo_mantenimiento', filters.tipo_mantenimiento);
  const qs = p.toString();
  return apiRequest<PlantillaPasoRow[]>(`/api/v1/mantenimientos/plantillas${qs ? '?' + qs : ''}`);
}

export async function createPlantilla(data: {
  tipo_equipo: string;
  tipo_mantenimiento: string;
  descripcion: string;
  orden?: number;
  tipo_campo?: TipoCampoPaso;
  unidad?: string | null;
  opciones?: string[] | null;
  valor_min?: number | null;
  valor_max?: number | null;
  obligatorio?: boolean;
}): Promise<PlantillaPasoRow> {
  return apiRequest<PlantillaPasoRow>('/api/v1/mantenimientos/plantillas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deletePlantilla(id: number): Promise<void> {
  await apiRequest<void>(`/api/v1/mantenimientos/plantillas/${id}`, { method: 'DELETE' });
}

// ── Mantenimientos: configuración ────────────────────────────────────────────

export interface MantenimientoConfigRow {
  id: number;
  tipo_equipo: string;
  tiene_mantenimiento: boolean;
  frecuencia_meses: number;
  descripcion: string | null;
  updated_at: string;
}

export async function listMantenimientoConfig(): Promise<{ total: number; items: MantenimientoConfigRow[] }> {
  return apiRequest('/api/v1/mantenimientos/config');
}

export async function updateMantenimientoConfig(
  tipoEquipo: string,
  data: { tiene_mantenimiento?: boolean; frecuencia_meses?: number; descripcion?: string }
): Promise<MantenimientoConfigRow> {
  return apiRequest(`/api/v1/mantenimientos/config/${encodeURIComponent(tipoEquipo)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ── Equipment: próximos preventivos automáticos ──────────────────────────────

export interface EquipmentProximoPreventivoRow {
  equipment_id: number;
  equipment_codigo: string;
  equipment_marca: string;
  equipment_modelo: string;
  equipment_tipo: string;
  equipment_sede: string;
  proximo_preventivo: string;
  garantia_vence: string | null;
  fecha_compra: string | null;
  frecuencia_meses: number | null;
}

export async function listEquiposProximosPreventivos(
  desde?: string,
  hasta?: string,
): Promise<{ total: number; items: EquipmentProximoPreventivoRow[] }> {
  const p = new URLSearchParams();
  if (desde) p.set('desde', desde);
  if (hasta) p.set('hasta', hasta);
  const qs = p.toString();
  return apiRequest(`/api/v1/equipos/proximos-preventivos${qs ? '?' + qs : ''}`);
}

// ── Mantenimientos: dashboard ────────────────────────────────────────────────

export interface PorSedeEstado {
  sede: string;
  total: number;
  por_estado: Record<string, number>;
}

export interface AlertaItem {
  tipo: string;
  severidad: 'alta' | 'media' | 'baja';
  mensaje: string;
  equipment_id: number;
  equipment_codigo: string;
  sede: string;
  fecha_referencia: string | null;
  dias: number | null;
}

export interface MantenimientosDashboard {
  vencidos: number;
  proximos_30_dias: number;
  garantias_por_vencer_60_dias: number;
  calibraciones_vencidas: number;
  calibraciones_proximas_30_dias: number;
  costo_mes_actual: string;
  costo_anio_actual: string;
  por_sede: PorSedeEstado[];
  alertas: AlertaItem[];
}

export async function getMantenimientosDashboard(): Promise<MantenimientosDashboard> {
  return apiRequest(`/api/v1/mantenimientos/dashboard`);
}

// ── Calibraciones ─────────────────────────────────────────────────────────────

export interface CalibracionItem {
  equipment_id: number;
  equipment_codigo: string;
  equipment_marca: string;
  equipment_modelo: string;
  equipment_tipo: string;
  equipment_sede: string;
  criticidad: string;
  fecha_calibracion: string | null;
  vencimiento_calibracion: string;
  frecuencia_calibracion_meses: number | null;
  dias_para_vencer: number;
}

export async function listCalibraciones(filters: {
  vencidas?: boolean;
  proximas_dias?: number;
} = {}): Promise<{ total: number; items: CalibracionItem[] }> {
  const p = new URLSearchParams();
  if (filters.vencidas !== undefined) p.set('vencidas', String(filters.vencidas));
  if (filters.proximas_dias !== undefined) p.set('proximas_dias', String(filters.proximas_dias));
  const qs = p.toString();
  return apiRequest(`/api/v1/equipos/calibraciones${qs ? '?' + qs : ''}`);
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
  return apiRequest(`/api/v1/dashboard`);
}

export interface GarantiaAlertaItem {
  equipment_id: number;
  equipment_codigo: string;
  equipment_marca: string;
  equipment_modelo: string;
  sede: string;
  garantia_vence: string;
  dias: number;
}

export interface EquipoRecienteItem {
  id: number;
  codigo_interno: string;
  tipo: string;
  marca: string;
  modelo: string;
  sede: string;
  estado: string;
  created_at: string;
}

export interface InventarioDashboard {
  total_equipos: number;
  por_tipo: Record<string, number>;
  por_estado: Record<string, number>;
  garantias_por_vencer: GarantiaAlertaItem[];
  altas_recientes: EquipoRecienteItem[];
}

export async function getInventarioDashboard(): Promise<InventarioDashboard> {
  return apiRequest(`/api/v1/dashboard/inventario`);
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
  home_dashboard: string;
  dominios: string[];
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
  home_dashboard: string;
  dominios: string[];
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
  home_dashboard?: string;
  dominios?: string[];
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

// ── Credenciales ─────────────────────────────────────────────────────────────

export interface CredencialRow {
  id: number;
  tipo: string;
  nombre: string;
  equipment_id: number | null;
  equipment_codigo?: string | null;
  equipment_marca?: string | null;
  equipment_modelo?: string | null;
  usuario: string | null;
  url: string | null;
  notas: string | null;
  created_by_nombre: string;
  created_at: string;
  updated_at: string;
}

export interface CredencialListResponse {
  total: number;
  items: CredencialRow[];
}

export interface CredencialFilters {
  tipo?: string;
  equipment_id?: number;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface CredencialCreatePayload {
  tipo: string;
  nombre: string;
  equipment_id?: number | null;
  usuario?: string | null;
  password: string;
  url?: string | null;
  notas?: string | null;
}

export type CredencialUpdatePayload = Partial<Omit<CredencialCreatePayload, 'tipo' | 'password'>> & {
  password?: string;
};

export async function listCredenciales(filters: CredencialFilters = {}): Promise<CredencialListResponse> {
  const params = new URLSearchParams();
  if (filters.tipo) params.set('tipo', filters.tipo);
  if (filters.equipment_id) params.set('equipment_id', String(filters.equipment_id));
  if (filters.search) params.set('search', filters.search);
  if (filters.skip) params.set('skip', String(filters.skip));
  if (filters.limit) params.set('limit', String(filters.limit));
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiRequest<CredencialListResponse>(`/api/v1/credenciales${query}`);
}

export async function getCredencial(id: number): Promise<CredencialRow> {
  return apiRequest<CredencialRow>(`/api/v1/credenciales/${id}`);
}

export async function createCredencial(data: CredencialCreatePayload): Promise<CredencialRow> {
  return apiRequest<CredencialRow>('/api/v1/credenciales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateCredencial(id: number, data: CredencialUpdatePayload): Promise<CredencialRow> {
  return apiRequest<CredencialRow>(`/api/v1/credenciales/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteCredencial(id: number): Promise<void> {
  await apiRequest<void>(`/api/v1/credenciales/${id}`, { method: 'DELETE' });
}

export async function revealCredencialPassword(id: number): Promise<string> {
  const r = await apiRequest<{ password: string }>(`/api/v1/credenciales/${id}/password`);
  return r.password;
}

// ── Portal del Colaborador (sin autenticación) ────────────────────────────────

export interface EmpleadoBrief {
  nombres: string;
  apellidos: string;
  sede: string;
  cargo: string | null;
}

export interface RedWifiOut {
  id: number;
  sede: string;
  nombre_red: string;
  tipo_red: string | null;
  contrasena: string;
  descripcion: string | null;
}

export interface EquipoBrief {
  id: number;
  codigo_interno: string;
  tipo: string;
  marca: string;
  modelo: string;
  estado: string;
  dominio?: string | null;
  bodega_nombre: string | null;
}

export interface VerificarResponse {
  empleado: EmpleadoBrief;
  redes_wifi: RedWifiOut[];
  equipos_asignados: EquipoBrief[];
  equipos_bodega: EquipoBrief[];
}

export interface TicketPublicoCreate {
  documento: string;
  dominio: string;
  categoria: string;
  tipo_solicitud: string;
  asunto: string;
  descripcion: string;
  prioridad: string;
  equipment_ids: number[];
}

export interface TicketPublicoOut {
  id: number;
  numero: string;
  asunto: string;
  estado: string;
  created_at: string;
}

export interface TicketPortalOut {
  id: number;
  numero: string;
  asunto: string;
  dominio: string;
  categoria: string;
  tipo_solicitud: string;
  estado: string;
  prioridad: string;
  asignado_a_nombre: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketImagenOut {
  id: number;
  url: string;
}

export interface ComentarioPortalOut {
  id: number;
  autor_nombre: string;
  contenido: string;
  created_at: string;
}

export interface TicketPortalDetailOut {
  id: number;
  numero: string;
  asunto: string;
  descripcion: string;
  dominio: string;
  categoria: string;
  tipo_solicitud: string;
  estado: string;
  prioridad: string;
  asignado_a_nombre: string | null;
  resolucion: string | null;
  created_at: string;
  updated_at: string;
  comentarios: ComentarioPortalOut[];
  imagenes: TicketImagenOut[];
}

export async function verificarEmpleado(documento: string): Promise<VerificarResponse> {
  const r = await fetch(`${API_BASE}/api/v1/portal/verificar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documento }),
  });
  if (!r.ok) {
    const err: ApiError = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Error al verificar');
  }
  return r.json();
}

export async function logWifiVista(documento: string, wifi_id: number): Promise<void> {
  await fetch(`${API_BASE}/api/v1/portal/wifi-vista?wifi_id=${wifi_id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documento }),
  });
}

export async function getTicketsPortal(documento: string): Promise<TicketPortalOut[]> {
  const r = await fetch(`${API_BASE}/api/v1/portal/mis-tickets/${encodeURIComponent(documento)}`);
  if (!r.ok) return [];
  return r.json();
}

export async function getTicketPortalDetail(ticketId: number): Promise<TicketPortalDetailOut> {
  const r = await fetch(`${API_BASE}/api/v1/portal/ticket/${ticketId}`);
  if (!r.ok) throw new Error('Ticket no encontrado');
  return r.json();
}

export async function uploadImagenesPortal(
  ticketId: number,
  documento: string,
  files: File[],
): Promise<{ uploaded: number; total: number }> {
  const form = new FormData();
  form.append('documento', documento);
  files.forEach((f) => form.append('files', f));
  const r = await fetch(`${API_BASE}/api/v1/portal/ticket/${ticketId}/imagenes`, {
    method: 'POST',
    body: form,
  });
  if (!r.ok) {
    const err: ApiError = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Error al subir imágenes');
  }
  return r.json();
}

export async function uploadImagenesTicket(
  ticketId: number,
  files: File[],
): Promise<{ uploaded: number; total: number }> {
  const token = getStoredToken();
  const form = new FormData();
  files.forEach((f) => form.append('files', f));
  const r = await fetch(`${API_BASE}/api/v1/tickets/${ticketId}/imagenes`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!r.ok) {
    const err: ApiError = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Error al subir imágenes');
  }
  return r.json();
}

export async function addComentarioPortal(
  ticketId: number,
  documento: string,
  contenido: string,
): Promise<ComentarioPortalOut> {
  const r = await fetch(`${API_BASE}/api/v1/portal/ticket/${ticketId}/comentario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documento, contenido }),
  });
  if (!r.ok) {
    const err: ApiError = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Error al enviar comentario');
  }
  return r.json();
}

export async function crearTicketPublico(payload: TicketPublicoCreate): Promise<TicketPublicoOut> {
  const r = await fetch(`${API_BASE}/api/v1/portal/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const err: ApiError = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Error al crear ticket');
  }
  return r.json();
}

// ── Redes WiFi (admin) ────────────────────────────────────────────────────────

export interface RedWifiAdminOut {
  id: number;
  sede: string;
  nombre_red: string;
  tipo_red: string | null;
  contrasena: string;
  descripcion: string | null;
  is_active: boolean;
}

export interface RedWifiCreate {
  sede: string;
  nombre_red: string;
  tipo_red?: string | null;
  contrasena: string;
  descripcion?: string | null;
}

export async function listRedesWifi(sede?: string): Promise<RedWifiAdminOut[]> {
  const qs = sede ? `?sede=${encodeURIComponent(sede)}` : '';
  return apiRequest<RedWifiAdminOut[]>(`/api/v1/redes-wifi${qs}`);
}

export async function createRedWifi(data: RedWifiCreate): Promise<RedWifiAdminOut> {
  return apiRequest<RedWifiAdminOut>('/api/v1/redes-wifi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateRedWifi(id: number, data: Partial<RedWifiCreate & { is_active: boolean }>): Promise<RedWifiAdminOut> {
  return apiRequest<RedWifiAdminOut>(`/api/v1/redes-wifi/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteRedWifi(id: number): Promise<void> {
  await apiRequest<void>(`/api/v1/redes-wifi/${id}`, { method: 'DELETE' });
}

// ── Tickets (IT staff) ────────────────────────────────────────────────────────

export interface ComentarioOut {
  id: number;
  autor_nombre: string;
  contenido: string;
  es_interno: boolean;
  created_at: string;
}

export interface TicketOut {
  id: number;
  numero: string;
  documento_identidad: string;
  empleado_nombre: string;
  sede: string;
  dominio: string;
  categoria: string;
  tipo_solicitud: string;
  asunto: string;
  descripcion: string;
  estado: string;
  prioridad: string;
  resolucion: string | null;
  created_at: string;
  updated_at: string;
  asignado_a_nombre: string | null;
  equipos: EquipoBrief[];
  comentarios: ComentarioOut[];
  imagenes: TicketImagenOut[];
}

export interface TicketUpdate {
  estado?: string;
  prioridad?: string;
  dominio?: string;
  asignado_a_id?: number | null;
  resolucion?: string;
}

export interface TicketAsignable {
  id: number;
  full_name: string;
}

export async function listTickets(filters: { sede?: string; estado?: string; categoria?: string; dominio?: string; documento?: string; skip?: number; limit?: number } = {}): Promise<{ items: TicketOut[]; total: number }> {
  const p = new URLSearchParams();
  if (filters.sede) p.set('sede', filters.sede);
  if (filters.estado) p.set('estado', filters.estado);
  if (filters.categoria) p.set('categoria', filters.categoria);
  if (filters.dominio) p.set('dominio', filters.dominio);
  if (filters.documento) p.set('documento', filters.documento);
  if (filters.skip) p.set('skip', String(filters.skip));
  if (filters.limit) p.set('limit', String(filters.limit));
  const qs = p.toString();
  return apiRequest(`/api/v1/tickets${qs ? '?' + qs : ''}`);
}

export async function listTicketAsignables(dominio?: string): Promise<TicketAsignable[]> {
  const qs = dominio ? `?dominio=${encodeURIComponent(dominio)}` : '';
  return apiRequest<TicketAsignable[]>(`/api/v1/tickets/asignables${qs}`);
}

export async function updateTicket(id: number, data: TicketUpdate): Promise<TicketOut> {
  return apiRequest<TicketOut>(`/api/v1/tickets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function addComentario(ticketId: number, data: { contenido: string; es_interno: boolean }): Promise<ComentarioOut> {
  return apiRequest<ComentarioOut>(`/api/v1/tickets/${ticketId}/comentarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ── Mi Jornada ────────────────────────────────────────────────────────────────

export interface RegistroJornadaOut {
  id: number;
  tipo: 'entrada' | 'salida';
  timestamp: string;
  sede: string | null;
  notas: string | null;
  foto_url: string | null;
  latitud: number | null;
  longitud: number | null;
  ip_publica: string | null;
  dispositivo: string | null;
  is_manual: boolean;
}

export interface SedeInfoOut {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
  tipo: 'empresa' | 'home_office';
}

export interface HoyJornadaResponse {
  empleado_id: number;
  nombres: string;
  apellidos: string;
  sede: string | null;
  cargo: string | null;
  registros: RegistroJornadaOut[];
  proximo: 'entrada' | 'salida';
  sede_info: SedeInfoOut | null;        // primera sede (compat)
  sedes_info: SedeInfoOut[];            // sedes asignadas al empleado
  todas_sedes_info: SedeInfoOut[];      // todas las sedes activas (geovalla)
  ip_verificada: boolean;               // true si la IP coincide con una sede autorizada
  foto_requerida: boolean;              // true si este empleado es uno de los 2 del día
}

// ── Dashboard supervisor ──────────────────────────────────────────────────────

export interface RegistroResumen {
  timestamp: string;
  foto_url: string | null;
}

export interface EmpleadoAsistenciaOut {
  empleado_id: number;
  nombres: string;
  apellidos: string;
  sede: string | null;
  cargo: string | null;
  estado: 'presente' | 'completo' | 'ausente';
  entrada: RegistroResumen | null;
  salida: RegistroResumen | null;
  total_minutos: number | null;
}

export interface AsistenciaResponse {
  fecha: string;
  total_empleados: number;
  presentes: number;
  completos: number;
  ausentes: number;
  empleados: EmpleadoAsistenciaOut[];
}

export async function getAsistencia(params: { fecha?: string; sede?: string } = {}): Promise<AsistenciaResponse> {
  const q = new URLSearchParams();
  if (params.fecha) q.set('fecha', params.fecha);
  if (params.sede) q.set('sede', params.sede);
  const qs = q.toString();
  return apiRequest<AsistenciaResponse>(`/api/v1/jornada/asistencia${qs ? `?${qs}` : ''}`);
}

export async function getRegistrosEmpleado(
  empleadoId: number,
  fecha?: string,
): Promise<RegistroJornadaOut[]> {
  const q = fecha ? `?fecha=${fecha}` : '';
  return apiRequest<RegistroJornadaOut[]>(`/api/v1/jornada/empleado/${empleadoId}/registros${q}`);
}

export async function getJornadaHoy(cedula: string): Promise<HoyJornadaResponse> {
  const r = await fetch(`${API_BASE}/api/v1/jornada/hoy/${encodeURIComponent(cedula)}`);
  if (!r.ok) {
    const err: ApiError = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Empleado no encontrado');
  }
  return r.json();
}

export interface DiaRegistros {
  fecha: string;
  dia_semana: string;
  es_hoy: boolean;
  registros: RegistroJornadaOut[];
  tiempo_sede: string | null;
  almuerzo_min: number;
}

export interface SemanaJornadaResponse {
  dias: DiaRegistros[];
}

export async function getJornadaSemana(cedula: string): Promise<SemanaJornadaResponse> {
  const r = await fetch(`${API_BASE}/api/v1/jornada/semana/${encodeURIComponent(cedula)}`);
  if (!r.ok) throw new Error('Error al obtener la semana');
  return r.json();
}

export interface EmpleadoSemanaOut {
  empleado_id: number;
  nombres: string;
  apellidos: string;
  cargo: string | null;
  sede: string | null;
  dias: DiaRegistros[];
  dias_asistidos: number;
  dias_incompletos: number;
  total_minutos: number;
}

export interface ReporteSemanalOut {
  semana_inicio: string;
  semana_fin: string;
  empleados: EmpleadoSemanaOut[];
}

export async function getReporteSemanal(fecha?: string, sedeId?: number): Promise<ReporteSemanalOut> {
  const p = new URLSearchParams();
  if (fecha) p.set('fecha', fecha);
  if (sedeId) p.set('sede_id', String(sedeId));
  const qs = p.size ? '?' + p.toString() : '';
  return apiRequest(`/api/v1/jornada/admin/reporte-semanal${qs}`);
}

// ── Sedes Jornada (admin) ─────────────────────────────────────────────────────

export interface HorarioConfig {
  tipo: 'turno_unico' | 'doble_turno';
  almuerzo_semana_min: number;   // minutos Lun–Vie
  almuerzo_sabado_min: number;
  almuerzo_domingo_min: number;
  domingo_regla: 'ultimo_mes' | 'si_trabaja';
}

export interface SedeJornadaOut {
  id: number;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  latitud: number;
  longitud: number;
  radio_metros: number;
  ip_autorizada: string | null;
  tipo: 'empresa' | 'home_office';
  is_active: boolean;
  bodegas: { id: number; nombre: string }[];
  horario_config: HorarioConfig | null;
}

export interface SedeJornadaCreate {
  nombre: string;
  direccion?: string;
  ciudad?: string;
  latitud: number;
  longitud: number;
  radio_metros: number;
  ip_autorizada?: string;
  tipo: 'empresa' | 'home_office';
  bodega_ids: number[];
  horario_config?: HorarioConfig | null;
}

export async function getSedesJornada(): Promise<SedeJornadaOut[]> {
  const r = await fetch(`${API_BASE}/api/v1/jornada/sedes`);
  if (!r.ok) return [];
  return r.json();
}

export async function createSedeJornada(data: SedeJornadaCreate): Promise<SedeJornadaOut> {
  return apiRequest<SedeJornadaOut>('/api/v1/jornada/admin/sedes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateSedeJornada(id: number, data: Partial<SedeJornadaCreate> & { is_active?: boolean }): Promise<SedeJornadaOut> {
  return apiRequest<SedeJornadaOut>(`/api/v1/jornada/admin/sedes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteSedeJornada(id: number): Promise<void> {
  return apiRequest<void>(`/api/v1/jornada/admin/sedes/${id}`, { method: 'DELETE' });
}

export async function registrarSalidaManual(
  empleadoId: number,
  fecha: string,
  hora: string,
  notas?: string,
): Promise<RegistroJornadaOut> {
  return apiRequest<RegistroJornadaOut>('/api/v1/jornada/admin/registros/salida-manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empleado_id: empleadoId, fecha, hora, notas }),
  });
}

export async function registrarJornada(
  cedula: string,
  opciones?: {
    tipo?: 'entrada' | 'salida';
    notas?: string;
    foto?: Blob;
    latitud?: number;
    longitud?: number;
  },
): Promise<RegistroJornadaOut> {
  const form = new FormData();
  form.append('cedula', cedula);
  if (opciones?.tipo) form.append('tipo', opciones.tipo);
  if (opciones?.notas) form.append('notas', opciones.notas);
  if (opciones?.latitud !== undefined) form.append('latitud', String(opciones.latitud));
  if (opciones?.longitud !== undefined) form.append('longitud', String(opciones.longitud));
  if (typeof navigator !== 'undefined') form.append('dispositivo', navigator.userAgent.slice(0, 300));
  if (opciones?.foto) form.append('foto', opciones.foto, 'selfie.jpg');

  const r = await fetch(`${API_BASE}/api/v1/jornada/registrar`, {
    method: 'POST',
    body: form,
  });
  if (!r.ok) {
    const err: ApiError = await r.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Error al registrar');
  }
  return r.json();
}

// ── Integración SIESUA ────────────────────────────────────────────────────────

export interface SiesuaSyncResult {
  sedes_creadas: number;
  sedes_actualizadas: number;
  empleados_creados: number;
  empleados_actualizados: number;
  empleados_sin_cambios: number;
  errores: string[];
  ok: boolean;
}

export async function sincronizarSiesua(): Promise<SiesuaSyncResult> {
  return apiRequest<SiesuaSyncResult>('/api/v1/integraciones/siesua/sync', { method: 'POST' });
}
