from datetime import datetime

from pydantic import BaseModel, EmailStr


class PermissionOut(BaseModel):
    id: int
    code: str
    name: str
    description: str | None = None


class RoleOut(BaseModel):
    id: int
    name: str
    description: str | None = None
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
    permission_ids: list[int] = []


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    permission_ids: list[int] | None = None
