from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


ESTADOS_VALIDOS = {
    'Disponible', 'Asignado', 'En mantenimiento',
    'Dañado', 'Prestado', 'En bodega', 'Perdido', 'Dado de baja',
}
CRITICIDADES_VALIDAS = {'Alta', 'Media', 'Baja'}


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
    criticidad: str = 'Media'
    fecha_compra: date | None = None
    valor: Decimal | None = None
    proveedor: str | None = None
    numero_factura: str | None = None
    garantia_vence: date | None = None
    observaciones: str | None = None
    fecha_calibracion: date | None = None
    vencimiento_calibracion: date | None = None
    frecuencia_calibracion_meses: int | None = None

    @field_validator('serial')
    @classmethod
    def serial_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError('El serial no puede estar vacío')
        return v

    @field_validator('estado')
    @classmethod
    def estado_valido(cls, v: str) -> str:
        if v not in ESTADOS_VALIDOS:
            raise ValueError(f'Estado inválido. Opciones: {", ".join(sorted(ESTADOS_VALIDOS))}')
        return v

    @field_validator('criticidad')
    @classmethod
    def criticidad_valida(cls, v: str) -> str:
        if v not in CRITICIDADES_VALIDAS:
            raise ValueError(f'Criticidad inválida. Opciones: {", ".join(sorted(CRITICIDADES_VALIDAS))}')
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
    criticidad: str | None = None
    fecha_compra: date | None = None
    valor: Decimal | None = None
    proveedor: str | None = None
    numero_factura: str | None = None
    garantia_vence: date | None = None
    observaciones: str | None = None
    fecha_calibracion: date | None = None
    vencimiento_calibracion: date | None = None
    frecuencia_calibracion_meses: int | None = None

    @field_validator('estado')
    @classmethod
    def estado_valido(cls, v: str | None) -> str | None:
        if v is not None and v not in ESTADOS_VALIDOS:
            raise ValueError(f'Estado inválido. Opciones: {", ".join(sorted(ESTADOS_VALIDOS))}')
        return v

    @field_validator('criticidad')
    @classmethod
    def criticidad_valida(cls, v: str | None) -> str | None:
        if v is not None and v not in CRITICIDADES_VALIDAS:
            raise ValueError(f'Criticidad inválida. Opciones: {", ".join(sorted(CRITICIDADES_VALIDAS))}')
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
    criticidad: str
    specs: dict | None
    fecha_compra: date | None
    valor: Decimal | None
    proveedor: str | None
    numero_factura: str | None
    garantia_vence: date | None
    observaciones: str | None
    fecha_calibracion: date | None
    vencimiento_calibracion: date | None
    frecuencia_calibracion_meses: int | None
    bodega_id: int | None
    empleado_id: int | None
    empleado_nombre: str | None = None
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


class EquipmentDocumentoOut(BaseModel):
    id: int
    equipment_id: int
    filename: str
    nombre: str
    tipo_doc: str
    url: str
    created_at: datetime


class EquipmentProfile(BaseModel):
    equipment: EquipmentOut
    specs_template: list[dict]
    parent: EquipmentBrief | None
    children: list[EquipmentBrief]
    photos: list[EquipmentPhotoOut]
    documentos: list[EquipmentDocumentoOut] = []


class EquipmentListResponse(BaseModel):
    total: int
    items: list[EquipmentOut]


class CalibracionItem(BaseModel):
    equipment_id: int
    equipment_codigo: str
    equipment_marca: str
    equipment_modelo: str
    equipment_tipo: str
    equipment_sede: str
    criticidad: str
    fecha_calibracion: date | None
    vencimiento_calibracion: date
    frecuencia_calibracion_meses: int | None
    dias_para_vencer: int


class CalibracionListResponse(BaseModel):
    total: int
    items: list[CalibracionItem]


class EquipmentProximoPreventivoOut(BaseModel):
    equipment_id: int
    equipment_codigo: str
    equipment_marca: str
    equipment_modelo: str
    equipment_tipo: str
    equipment_sede: str
    proximo_preventivo: date
    garantia_vence: date | None
    fecha_compra: date | None
    frecuencia_meses: int | None


class EquipmentProximoPreventivoListResponse(BaseModel):
    total: int
    items: list[EquipmentProximoPreventivoOut]
