from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

TIPOS_MANTENIMIENTO = {'Preventivo', 'Correctivo'}


class MantenimientoCreate(BaseModel):
    equipment_id: int
    tipo: str
    fecha: datetime
    tecnico: str | None = None
    descripcion: str
    costo: Decimal | None = None
    observaciones: str | None = None
    proximo_mantenimiento: date | None = None


class MantenimientoUpdate(BaseModel):
    tipo: str | None = None
    fecha: datetime | None = None
    tecnico: str | None = None
    descripcion: str | None = None
    costo: Decimal | None = None
    observaciones: str | None = None
    proximo_mantenimiento: date | None = None


class MantenimientoOut(BaseModel):
    id: int
    equipment_id: int
    equipment_codigo: str
    equipment_marca: str
    equipment_modelo: str
    tipo: str
    fecha: datetime
    tecnico: str | None
    descripcion: str
    costo: Decimal | None
    observaciones: str | None
    proximo_mantenimiento: date | None
    created_by_nombre: str
    created_at: datetime


class MantenimientoListResponse(BaseModel):
    total: int
    items: list[MantenimientoOut]
