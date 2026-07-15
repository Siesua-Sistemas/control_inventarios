from datetime import datetime

from pydantic import BaseModel, field_validator

TIPOS_CAMPO_VALIDOS = {'text', 'number', 'select', 'boolean', 'scale'}


class SpecFieldSchema(BaseModel):
    key: str
    label: str
    type: str
    options: list[str] | None = None
    min: int | None = None
    max: int | None = None
    placeholder: str | None = None

    @field_validator('type')
    @classmethod
    def type_valido(cls, v: str) -> str:
        if v not in TIPOS_CAMPO_VALIDOS:
            raise ValueError(f'Tipo de campo inválido. Opciones: {", ".join(sorted(TIPOS_CAMPO_VALIDOS))}')
        return v

    @field_validator('key', 'label')
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('La clave y la etiqueta del campo no pueden estar vacías')
        return v


DOMINIOS_VALIDOS_TIPO = {'IT', 'Bioingeniería', 'General'}


class EquipmentTipoCreate(BaseModel):
    nombre: str
    dominio: str = 'IT'
    es_periferico: bool = False
    activo: bool = True
    orden: int = 0

    @field_validator('nombre')
    @classmethod
    def nombre_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('El nombre no puede estar vacío')
        return v

    @field_validator('dominio')
    @classmethod
    def dominio_valido(cls, v: str) -> str:
        if v not in DOMINIOS_VALIDOS_TIPO:
            raise ValueError(f'Dominio inválido. Opciones: {sorted(DOMINIOS_VALIDOS_TIPO)}')
        return v


class EquipmentTipoUpdate(BaseModel):
    nombre: str | None = None
    dominio: str | None = None
    es_periferico: bool | None = None
    activo: bool | None = None
    orden: int | None = None

    @field_validator('nombre')
    @classmethod
    def nombre_not_empty(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError('El nombre no puede estar vacío')
        return v

    @field_validator('dominio')
    @classmethod
    def dominio_valido(cls, v: str | None) -> str | None:
        if v is not None and v not in DOMINIOS_VALIDOS_TIPO:
            raise ValueError(f'Dominio inválido. Opciones: {sorted(DOMINIOS_VALIDOS_TIPO)}')
        return v


class EquipmentTipoSpecsUpdate(BaseModel):
    specs: list[SpecFieldSchema]


class EquipmentTipoOut(BaseModel):
    id: int
    nombre: str
    dominio: str
    es_periferico: bool
    activo: bool
    orden: int
    specs: list[SpecFieldSchema]
    created_at: datetime
    updated_at: datetime


class EquipmentTipoListResponse(BaseModel):
    total: int
    items: list[EquipmentTipoOut]
