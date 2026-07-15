from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator

DASHBOARDS_VALIDOS = {'general', 'inventario', 'entregas', 'tecnico'}
DOMINIOS_VALIDOS = {'IT', 'Bioingeniería', 'General'}


class PermissionOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None


class RoleOut(BaseModel):
    id: int
    name: str
    description: str | None = None
    home_dashboard: str = 'general'
    dominios: list[str] = ['IT']
    permissions: list[PermissionOut] = []


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role_ids: list[int] = []


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    password: str | None = None
    is_active: bool | None = None
    role_ids: list[int] | None = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    created_at: datetime
    roles: list[RoleOut] = []


class UserListResponse(BaseModel):
    total: int
    items: list[UserOut]


class RoleCreate(BaseModel):
    name: str
    description: str | None = None
    home_dashboard: str = 'general'
    dominios: list[str] = ['IT']
    permission_ids: list[int] = []

    @field_validator('home_dashboard')
    @classmethod
    def home_dashboard_valido(cls, v: str) -> str:
        if v not in DASHBOARDS_VALIDOS:
            raise ValueError(f'Dashboard inválido. Opciones: {", ".join(sorted(DASHBOARDS_VALIDOS))}')
        return v

    @field_validator('dominios')
    @classmethod
    def dominios_validos(cls, v: list[str]) -> list[str]:
        invalid = [d for d in v if d not in DOMINIOS_VALIDOS]
        if invalid:
            raise ValueError(f'Dominio(s) inválido(s): {invalid}. Opciones: {sorted(DOMINIOS_VALIDOS)}')
        return v


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    home_dashboard: str | None = None
    dominios: list[str] | None = None
    permission_ids: list[int] | None = None

    @field_validator('home_dashboard')
    @classmethod
    def home_dashboard_valido(cls, v: str | None) -> str | None:
        if v is not None and v not in DASHBOARDS_VALIDOS:
            raise ValueError(f'Dashboard inválido. Opciones: {", ".join(sorted(DASHBOARDS_VALIDOS))}')
        return v

    @field_validator('dominios')
    @classmethod
    def dominios_validos(cls, v: list[str] | None) -> list[str] | None:
        if v is not None:
            invalid = [d for d in v if d not in DOMINIOS_VALIDOS]
            if invalid:
                raise ValueError(f'Dominio(s) inválido(s): {invalid}')
        return v
