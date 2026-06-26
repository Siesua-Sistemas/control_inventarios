from datetime import datetime

from pydantic import BaseModel

TIPOS_CREDENCIAL = {'equipo', 'cuenta', 'wifi'}


class CredencialCreate(BaseModel):
    tipo: str
    nombre: str
    equipment_id: int | None = None
    usuario: str | None = None
    password: str
    url: str | None = None
    notas: str | None = None


class CredencialUpdate(BaseModel):
    nombre: str | None = None
    equipment_id: int | None = None
    usuario: str | None = None
    password: str | None = None
    url: str | None = None
    notas: str | None = None


class CredencialOut(BaseModel):
    id: int
    tipo: str
    nombre: str
    equipment_id: int | None
    equipment_codigo: str | None = None
    equipment_marca: str | None = None
    equipment_modelo: str | None = None
    usuario: str | None
    url: str | None
    notas: str | None
    created_by_nombre: str
    created_at: datetime
    updated_at: datetime


class CredencialListResponse(BaseModel):
    total: int
    items: list[CredencialOut]


class CredencialRevealOut(BaseModel):
    password: str
