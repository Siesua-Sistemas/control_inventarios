from datetime import datetime
from typing import Any

from pydantic import BaseModel


class EquipoSnapshot(BaseModel):
    id: int
    codigo_interno: str
    serial: str
    tipo: str
    marca: str
    modelo: str
    estado: str


class ActaEntregaCreate(BaseModel):
    tipo: str                          # 'bodega' | 'asignacion'
    sede: str
    titulo: str
    entrega_nombre: str
    recibe_nombre: str
    firma_entrega: str | None = None
    firma_recibe: str | None = None
    equipos_snapshot: list[dict[str, Any]]
    bodega_id: int | None = None
    empleado_id: int | None = None
    observaciones: str | None = None


class ActaEntregaRow(BaseModel):
    id: int
    tipo: str
    sede: str
    titulo: str
    entrega_nombre: str
    recibe_nombre: str
    firma_entrega: str | None
    firma_recibe: str | None
    equipos_snapshot: list[dict[str, Any]]
    bodega_id: int | None
    empleado_id: int | None
    observaciones: str | None
    fecha: datetime
    created_by_nombre: str | None
    total_equipos: int

    model_config = {'from_attributes': True}


class ActaListResponse(BaseModel):
    total: int
    items: list[ActaEntregaRow]
