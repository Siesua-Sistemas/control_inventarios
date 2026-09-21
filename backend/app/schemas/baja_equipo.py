from datetime import datetime

from pydantic import BaseModel

MOTIVOS_BAJA_LABEL: dict[str, str] = {
    'danado_irreparable': 'Dañado irreparable',
    'obsoleto': 'Obsoleto',
    'robado_perdido': 'Robado o perdido',
    'fin_vida_util': 'Fin de vida útil',
    'otro': 'Otro',
}


class BajaEquipoCreate(BaseModel):
    equipment_id: int
    motivo: str
    motivo_detalle: str | None = None
    observaciones: str | None = None


class BajaAprobarRequest(BaseModel):
    aprobado: bool
    firma_autoriza: str
    comentario: str | None = None


class BajaFotoOut(BaseModel):
    id: int
    baja_id: int
    filename: str
    url: str
    created_at: datetime

    model_config = {'from_attributes': True}


class BajaEquipoOut(BaseModel):
    id: int
    equipment_id: int
    equipment_codigo: str
    equipment_serial: str
    equipment_tipo: str
    equipment_marca: str
    equipment_modelo: str
    equipment_sede: str

    motivo: str
    motivo_detalle: str | None
    observaciones: str | None
    estado: str

    solicitado_por_nombre: str
    solicitado_en: datetime

    firma_autoriza: str | None
    autorizado_por_nombre: str | None
    autorizado_en: datetime | None
    comentario_aprobacion: str | None

    fotos: list[BajaFotoOut]


class BajaListResponse(BaseModel):
    total: int
    items: list[BajaEquipoOut]
