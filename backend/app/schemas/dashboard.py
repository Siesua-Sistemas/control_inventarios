from pydantic import BaseModel

from app.schemas.asignacion import AsignacionOut


class DashboardStats(BaseModel):
    total_equipos: int
    total_bodegas: int
    total_empleados: int
    asignaciones_hoy: int
    por_estado: dict[str, int]
    ultimos_movimientos: list[AsignacionOut]
