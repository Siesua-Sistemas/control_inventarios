from datetime import datetime

from pydantic import BaseModel


class EntregarRequest(BaseModel):
    equipment_id: int
    empleado_id: int | None = None
    bodega_origen_id: int | None = None
    sede_destino: str | None = None
    responsable_nombre: str | None = None
    observaciones: str | None = None


class DevolverRequest(BaseModel):
    equipment_id: int
    bodega_destino_id: int | None = None
    observaciones: str | None = None


class TrasladarRequest(BaseModel):
    equipment_id: int
    bodega_destino_id: int
    observaciones: str | None = None


class EntregarMultipleRequest(BaseModel):
    equipment_ids: list[int]
    empleado_id: int | None = None
    bodega_origen_id: int | None = None
    sede_destino: str | None = None
    responsable_nombre: str | None = None
    observaciones: str | None = None


class AsignacionOut(BaseModel):
    id: int
    tipo: str
    fecha: datetime
    estado_antes: str | None
    estado_despues: str
    observaciones: str | None

    equipment_id: int
    equipment_codigo: str
    equipment_serial: str
    equipment_tipo: str
    equipment_marca: str
    equipment_modelo: str
    equipment_sede: str

    empleado_id: int | None
    empleado_nombre: str | None
    empleado_cedula: str | None

    bodega_origen_nombre: str | None
    bodega_destino_nombre: str | None

    created_by_nombre: str
    created_at: datetime


class AsignacionListResponse(BaseModel):
    total: int
    items: list[AsignacionOut]
