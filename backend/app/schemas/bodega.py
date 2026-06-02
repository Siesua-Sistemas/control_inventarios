from datetime import datetime

from pydantic import BaseModel


class BodegaCreate(BaseModel):
    nombre: str
    sede: str
    responsable: str | None = None
    descripcion: str | None = None


class BodegaUpdate(BaseModel):
    nombre: str | None = None
    sede: str | None = None
    responsable: str | None = None
    descripcion: str | None = None


class BodegaOut(BaseModel):
    id: int
    nombre: str
    sede: str
    responsable: str | None
    descripcion: str | None
    total_equipos: int = 0
    is_active: bool
    created_at: datetime

    model_config = {'from_attributes': True}


class BodegaListResponse(BaseModel):
    total: int
    items: list[BodegaOut]
