from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

TIPOS_MANTENIMIENTO = {'Preventivo', 'Correctivo'}
ESTADOS_MANTENIMIENTO = {
    'programado', 'en_proceso', 'realizado', 'cancelado',
    'pendiente_aprobacion', 'aprobado', 'rechazado',
}
PRIORIDADES_MANTENIMIENTO = {'Urgente', 'Alta', 'Media', 'Baja'}
TIPOS_CAMPO = {'checkbox', 'numero', 'texto', 'seleccion'}


class PasoOut(BaseModel):
    id: int
    mantenimiento_id: int
    orden: int
    descripcion: str
    completado: bool
    completado_en: datetime | None
    tipo_campo: str = 'checkbox'
    unidad: str | None = None
    opciones: list[str] | None = None
    valor_min: Decimal | None = None
    valor_max: Decimal | None = None
    obligatorio: bool = True
    valor: str | None = None


class PasoCreate(BaseModel):
    descripcion: str
    orden: int = 0
    tipo_campo: str = 'checkbox'
    unidad: str | None = None
    opciones: list[str] | None = None
    valor_min: Decimal | None = None
    valor_max: Decimal | None = None
    obligatorio: bool = True


class PasoUpdate(BaseModel):
    completado: bool | None = None
    descripcion: str | None = None
    valor: str | None = None


class PlantillaPasoOut(BaseModel):
    id: int
    tipo_equipo: str
    tipo_mantenimiento: str
    descripcion: str
    orden: int
    tipo_campo: str = 'checkbox'
    unidad: str | None = None
    opciones: list[str] | None = None
    valor_min: Decimal | None = None
    valor_max: Decimal | None = None
    obligatorio: bool = True

    model_config = {'from_attributes': True}


class PlantillaPasoCreate(BaseModel):
    tipo_equipo: str
    tipo_mantenimiento: str
    descripcion: str
    orden: int = 0
    tipo_campo: str = 'checkbox'
    unidad: str | None = None
    opciones: list[str] | None = None
    valor_min: Decimal | None = None
    valor_max: Decimal | None = None
    obligatorio: bool = True


class AprobacionCreate(BaseModel):
    aprobado: bool
    comentario: str | None = None
    firma_supervisor: str | None = None


class MantenimientoCreate(BaseModel):
    equipment_id: int
    tipo: str
    fecha: datetime
    tecnico: str | None = None
    tecnico_id: int | None = None
    descripcion: str
    costo: Decimal | None = None
    observaciones: str | None = None
    proximo_mantenimiento: date | None = None
    estado: str = 'programado'
    prioridad: str = 'Media'


class MantenimientoUpdate(BaseModel):
    tipo: str | None = None
    fecha: datetime | None = None
    tecnico: str | None = None
    tecnico_id: int | None = None
    descripcion: str | None = None
    costo: Decimal | None = None
    observaciones: str | None = None
    proximo_mantenimiento: date | None = None
    estado: str | None = None
    prioridad: str | None = None
    firma_tecnico: str | None = None


class MantenimientoPartialUpdate(BaseModel):
    """Actualización ligera: solo estado y próxima fecha (permiso mantenimientos:update)."""
    estado: str | None = None
    proximo_mantenimiento: date | None = None


class MantenimientoPhotoOut(BaseModel):
    id: int
    mantenimiento_id: int
    filename: str
    url: str
    created_at: datetime


class MantenimientoOut(BaseModel):
    id: int
    numero_ot: str | None
    equipment_id: int
    equipment_codigo: str
    equipment_marca: str
    equipment_modelo: str
    equipment_tipo: str
    equipment_sede: str
    tipo: str
    fecha: datetime
    tecnico: str | None
    tecnico_id: int | None
    tecnico_nombre: str | None
    descripcion: str
    costo: Decimal | None
    observaciones: str | None
    proximo_mantenimiento: date | None
    estado: str
    prioridad: str
    iniciado_en: datetime | None = None
    finalizado_en: datetime | None = None
    firma_tecnico: str | None
    firma_supervisor: str | None
    aprobado_por_nombre: str | None
    aprobado_en: datetime | None
    comentario_aprobacion: str | None
    created_by_nombre: str
    created_at: datetime
    fotos: list[MantenimientoPhotoOut] = []
    pasos: list[PasoOut] = []


class MantenimientoListResponse(BaseModel):
    total: int
    items: list[MantenimientoOut]


class MantenimientoConfigOut(BaseModel):
    id: int
    tipo_equipo: str
    tiene_mantenimiento: bool
    frecuencia_meses: int
    descripcion: str | None
    updated_at: datetime

    model_config = {'from_attributes': True}


class MantenimientoConfigUpdate(BaseModel):
    tiene_mantenimiento: bool | None = None
    frecuencia_meses: int | None = None
    descripcion: str | None = None


class MantenimientoConfigListResponse(BaseModel):
    total: int
    items: list[MantenimientoConfigOut]


class PorSedeEstado(BaseModel):
    sede: str
    total: int
    por_estado: dict[str, int]


class AlertaItem(BaseModel):
    tipo: str
    severidad: str
    mensaje: str
    equipment_id: int
    equipment_codigo: str
    sede: str
    fecha_referencia: date | None
    dias: int | None


class MantenimientosDashboard(BaseModel):
    vencidos: int
    proximos_30_dias: int
    garantias_por_vencer_60_dias: int
    calibraciones_vencidas: int = 0
    calibraciones_proximas_30_dias: int = 0
    costo_mes_actual: Decimal
    costo_anio_actual: Decimal
    por_sede: list[PorSedeEstado]
    alertas: list[AlertaItem]
