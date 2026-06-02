from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


TIPOS_VALIDOS = {
    'Portátil', 'Celular', 'Tablet', 'Cámara', 'Audífonos',
    'Monitor', 'Impresora', 'Red', 'Accesorio', 'Servidor', 'Otro',
}

ESTADOS_VALIDOS = {
    'Disponible', 'Asignado', 'En mantenimiento',
    'Dañado', 'Prestado', 'En bodega', 'Perdido', 'Dado de baja',
}


class EquipmentCreate(BaseModel):
    serial: str
    tipo: str
    marca: str
    modelo: str
    placa: str | None = None
    sede: str
    ubicacion: str | None = None
    bodega_id: int | None = None
    parent_equipment_id: int | None = None
    specs: dict | None = None
    estado: str = 'Disponible'
    fecha_compra: date | None = None
    valor: Decimal | None = None
    proveedor: str | None = None
    numero_factura: str | None = None
    garantia_vence: date | None = None
    observaciones: str | None = None

    @field_validator('serial')
    @classmethod
    def serial_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('El serial no puede estar vacío')
        return v

    @field_validator('tipo')
    @classmethod
    def tipo_valido(cls, v: str) -> str:
        if v not in TIPOS_VALIDOS:
            raise ValueError(f'Tipo inválido. Opciones: {", ".join(sorted(TIPOS_VALIDOS))}')
        return v

    @field_validator('estado')
    @classmethod
    def estado_valido(cls, v: str) -> str:
        if v not in ESTADOS_VALIDOS:
            raise ValueError(f'Estado inválido. Opciones: {", ".join(sorted(ESTADOS_VALIDOS))}')
        return v


class EquipmentUpdate(BaseModel):
    serial: str | None = None
    tipo: str | None = None
    marca: str | None = None
    modelo: str | None = None
    placa: str | None = None
    sede: str | None = None
    ubicacion: str | None = None
    bodega_id: int | None = None
    parent_equipment_id: int | None = None
    specs: dict | None = None
    estado: str | None = None
    fecha_compra: date | None = None
    valor: Decimal | None = None
    proveedor: str | None = None
    numero_factura: str | None = None
    garantia_vence: date | None = None
    observaciones: str | None = None

    @field_validator('tipo')
    @classmethod
    def tipo_valido(cls, v: str | None) -> str | None:
        if v is not None and v not in TIPOS_VALIDOS:
            raise ValueError(f'Tipo inválido. Opciones: {", ".join(sorted(TIPOS_VALIDOS))}')
        return v

    @field_validator('estado')
    @classmethod
    def estado_valido(cls, v: str | None) -> str | None:
        if v is not None and v not in ESTADOS_VALIDOS:
            raise ValueError(f'Estado inválido. Opciones: {", ".join(sorted(ESTADOS_VALIDOS))}')
        return v


class EquipmentOut(BaseModel):
    id: int
    codigo_interno: str
    serial: str
    tipo: str
    marca: str
    modelo: str
    placa: str | None
    sede: str
    ubicacion: str | None
    estado: str
    specs: dict | None
    fecha_compra: date | None
    valor: Decimal | None
    proveedor: str | None
    numero_factura: str | None
    garantia_vence: date | None
    observaciones: str | None
    bodega_id: int | None
    empleado_id: int | None
    parent_equipment_id: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {'from_attributes': True}


class EquipmentBrief(BaseModel):
    id: int
    codigo_interno: str
    tipo: str
    marca: str
    modelo: str
    serial: str
    estado: str

    model_config = {'from_attributes': True}


class EquipmentPhotoOut(BaseModel):
    id: int
    equipment_id: int
    filename: str
    url: str
    created_at: datetime


class EquipmentProfile(BaseModel):
    equipment: EquipmentOut
    specs_template: list[dict]
    parent: EquipmentBrief | None
    children: list[EquipmentBrief]
    photos: list[EquipmentPhotoOut]


class EquipmentListResponse(BaseModel):
    total: int
    items: list[EquipmentOut]
