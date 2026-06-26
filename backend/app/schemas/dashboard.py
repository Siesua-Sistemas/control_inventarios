from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.asignacion import AsignacionOut


class DashboardStats(BaseModel):
    total_equipos: int
    total_bodegas: int
    total_empleados: int
    asignaciones_hoy: int
    por_estado: dict[str, int]
    ultimos_movimientos: list[AsignacionOut]


class GarantiaAlertaItem(BaseModel):
    equipment_id: int
    equipment_codigo: str
    equipment_marca: str
    equipment_modelo: str
    sede: str
    garantia_vence: date
    dias: int


class EquipoRecienteItem(BaseModel):
    id: int
    codigo_interno: str
    tipo: str
    marca: str
    modelo: str
    sede: str
    estado: str
    created_at: datetime


class InventarioDashboard(BaseModel):
    total_equipos: int
    por_tipo: dict[str, int]
    por_estado: dict[str, int]
    garantias_por_vencer: list[GarantiaAlertaItem]
    altas_recientes: list[EquipoRecienteItem]
