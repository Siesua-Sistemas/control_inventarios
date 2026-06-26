from datetime import datetime

from pydantic import BaseModel


class EmpleadoCreate(BaseModel):
    nombres: str
    apellidos: str
    cedula: str
    cargo: str | None = None
    departamento: str | None = None
    sede: str | None = None
    email: str | None = None
    telefono: str | None = None
    en_jornada: bool = False
    sedes_jornada_ids: list[int] = []


class EmpleadoUpdate(BaseModel):
    nombres: str | None = None
    apellidos: str | None = None
    cedula: str | None = None
    cargo: str | None = None
    departamento: str | None = None
    sede: str | None = None
    email: str | None = None
    telefono: str | None = None
    en_jornada: bool | None = None
    sedes_jornada_ids: list[int] | None = None


class EmpleadoOut(BaseModel):
    id: int
    nombres: str
    apellidos: str
    cedula: str
    cargo: str | None
    departamento: str | None
    sede: str | None
    email: str | None
    telefono: str | None
    en_jornada: bool
    sedes_jornada_ids: list[int]
    nombre_completo: str
    is_active: bool
    created_at: datetime

    model_config = {'from_attributes': True}

    @classmethod
    def from_orm_with_full_name(cls, obj: object) -> 'EmpleadoOut':
        data = {c: getattr(obj, c) for c in cls.model_fields if c not in ('nombre_completo', 'sedes_jornada_ids')}
        data['nombre_completo'] = f"{obj.nombres} {obj.apellidos}"  # type: ignore[union-attr]
        data['sedes_jornada_ids'] = [s.id for s in (getattr(obj, 'sedes_jornada', None) or [])]
        return cls(**data)


class EmpleadoListResponse(BaseModel):
    total: int
    items: list[EmpleadoOut]
