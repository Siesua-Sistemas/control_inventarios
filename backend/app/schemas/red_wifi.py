from pydantic import BaseModel


class RedWifiCreate(BaseModel):
    sede: str
    nombre_red: str
    tipo_red: str | None = None
    contrasena: str
    descripcion: str | None = None


class RedWifiUpdate(BaseModel):
    sede: str | None = None
    nombre_red: str | None = None
    tipo_red: str | None = None
    contrasena: str | None = None
    descripcion: str | None = None
    is_active: bool | None = None


class RedWifiAdminOut(BaseModel):
    id: int
    sede: str
    nombre_red: str
    tipo_red: str | None
    contrasena: str
    descripcion: str | None
    is_active: bool

    class Config:
        from_attributes = True
