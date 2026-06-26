from datetime import datetime

from pydantic import BaseModel


class VerificarRequest(BaseModel):
    documento: str


class EmpleadoBrief(BaseModel):
    nombres: str
    apellidos: str
    sede: str
    cargo: str | None


class RedWifiOut(BaseModel):
    id: int
    sede: str
    nombre_red: str
    tipo_red: str | None
    contrasena: str
    descripcion: str | None

    class Config:
        from_attributes = True


class EquipoBrief(BaseModel):
    id: int
    codigo_interno: str
    tipo: str
    marca: str
    modelo: str
    estado: str
    bodega_nombre: str | None = None

    class Config:
        from_attributes = True


class VerificarResponse(BaseModel):
    empleado: EmpleadoBrief
    redes_wifi: list[RedWifiOut]
    equipos_asignados: list[EquipoBrief]
    equipos_bodega: list[EquipoBrief]


class TicketPublicoCreate(BaseModel):
    documento: str
    categoria: str = 'Incidente'
    tipo_solicitud: str = 'Hardware'
    asunto: str
    descripcion: str
    prioridad: str = 'Media'
    equipment_ids: list[int] = []


class TicketPublicoOut(BaseModel):
    id: int
    numero: str
    asunto: str
    estado: str
    created_at: datetime

    class Config:
        from_attributes = True


class TicketPortalOut(BaseModel):
    id: int
    numero: str
    asunto: str
    categoria: str
    tipo_solicitud: str
    estado: str
    prioridad: str
    asignado_a_nombre: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ComentarioOut(BaseModel):
    id: int
    autor_nombre: str
    contenido: str
    es_interno: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TicketImagenOut(BaseModel):
    id: int
    url: str

    class Config:
        from_attributes = True


class ComentarioPortalOut(BaseModel):
    id: int
    autor_nombre: str
    contenido: str
    created_at: datetime

    class Config:
        from_attributes = True


class ComentarioPortalCreate(BaseModel):
    documento: str
    contenido: str


class TicketPortalDetailOut(BaseModel):
    id: int
    numero: str
    asunto: str
    descripcion: str
    categoria: str
    tipo_solicitud: str
    estado: str
    prioridad: str
    asignado_a_nombre: str | None
    resolucion: str | None
    created_at: datetime
    updated_at: datetime
    comentarios: list[ComentarioPortalOut]
    imagenes: list[TicketImagenOut] = []

    class Config:
        from_attributes = True


class TicketOut(BaseModel):
    id: int
    numero: str
    documento_identidad: str
    empleado_nombre: str
    sede: str
    categoria: str
    tipo_solicitud: str
    asunto: str
    descripcion: str
    estado: str
    prioridad: str
    resolucion: str | None
    created_at: datetime
    updated_at: datetime
    asignado_a_nombre: str | None
    equipos: list[EquipoBrief]
    comentarios: list[ComentarioOut]
    imagenes: list[TicketImagenOut] = []

    class Config:
        from_attributes = True


class TicketUpdate(BaseModel):
    estado: str | None = None
    prioridad: str | None = None
    asignado_a_id: int | None = None
    resolucion: str | None = None


class ComentarioCreate(BaseModel):
    contenido: str
    es_interno: bool = True
