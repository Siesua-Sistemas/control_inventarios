"""Alta unificada: empleado, usuario de acceso, o ambos; y acceso para un empleado ya existente."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.empleado import Empleado
from app.models.user import Role, User
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.empleado import EmpleadoCreate
from app.security import get_password_hash
from app.services import acceso_service as svc
from app.services.empleado_service import EmpleadoService

router = APIRouter(prefix='/api/v1/personas', tags=['personas'])


class UsuarioIn(BaseModel):
    email: EmailStr
    full_name: str | None = None  # por defecto, el nombre del empleado
    password: str = Field(min_length=svc.MIN_PASSWORD, max_length=128)
    role_ids: list[int] = []
    is_active: bool = False       # las cuentas nuevas quedan inactivas hasta activarlas


class PersonaCreate(BaseModel):
    tipo: Literal['empleado', 'usuario', 'ambos']
    empleado: EmpleadoCreate | None = None     # tipo empleado / ambos
    empleado_id: int | None = None             # tipo usuario sobre un empleado ya registrado (opcional)
    usuario: UsuarioIn | None = None           # tipo usuario / ambos


class PersonaOut(BaseModel):
    empleado_id: int | None
    user_id: int | None


class EmpleadoSinCuenta(BaseModel):
    id: int
    nombre_completo: str
    cedula: str
    email: str | None


def _exigir(user: User, *codigos: str) -> None:
    permisos = {p.code for r in user.roles for p in r.permissions}
    if not set(codigos) <= permisos:
        raise HTTPException(status.HTTP_403_FORBIDDEN, 'Permisos insuficientes')


def _crear_cuenta(db: Session, u: UsuarioIn, nombre: str, empleado_id: int | None) -> User:
    roles = []
    for rid in u.role_ids:
        role = db.get(Role, rid)
        if not role:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f'Rol inválido: {rid}')
        roles.append(role)
    user = User(
        email=u.email, full_name=(u.full_name or nombre).strip(), password_hash=get_password_hash(u.password),
        is_active=u.is_active, empleado_id=empleado_id, roles=roles,
    )
    db.add(user)
    return user


@router.get('/empleados-sin-cuenta', response_model=list[EmpleadoSinCuenta])
def empleados_sin_cuenta(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _exigir(user, 'users:write')
    activos = list(db.scalars(select(Empleado).where(Empleado.is_active.is_(True)).order_by(Empleado.nombres)).all())
    con = svc.empleados_con_cuenta(db, activos)
    return [
        EmpleadoSinCuenta(id=e.id, nombre_completo=f'{e.nombres} {e.apellidos}', cedula=e.cedula, email=e.email)
        for e in activos if e.id not in con
    ]


@router.post('', response_model=PersonaOut, status_code=status.HTTP_201_CREATED)
def crear_persona(body: PersonaCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if body.tipo in ('empleado', 'ambos'):
        _exigir(user, 'empleados:write')
        if body.empleado is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Faltan los datos del empleado')
    if body.tipo in ('usuario', 'ambos'):
        _exigir(user, 'users:write')
        if body.usuario is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, 'Faltan los datos de la cuenta de acceso')

    # Validar antes de crear nada, para no dejar un empleado huérfano si la cuenta falla.
    if body.usuario and db.scalar(select(User).where(func.lower(User.email) == body.usuario.email.lower())):
        raise HTTPException(status.HTTP_409_CONFLICT, 'El correo ya existe')

    empleado_id = body.empleado_id if body.tipo == 'usuario' else None
    nombre = ''
    if body.tipo in ('empleado', 'ambos'):
        creado = EmpleadoService(EmpleadoRepository(db)).create_empleado(body.empleado)
        empleado_id, nombre = creado.id, creado.nombre_completo
    elif empleado_id is not None:
        emp = db.get(Empleado, empleado_id)
        if not emp or not emp.is_active:
            raise HTTPException(status.HTTP_404_NOT_FOUND, 'Empleado no encontrado o inactivo')
        if emp.id in svc.empleados_con_cuenta(db, [emp]):
            raise HTTPException(status.HTTP_409_CONFLICT, 'Ese empleado ya tiene una cuenta de acceso')
        nombre = f'{emp.nombres} {emp.apellidos}'

    cuenta = None
    if body.usuario:
        if not (body.usuario.full_name or nombre):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, 'El nombre completo es obligatorio')
        cuenta = _crear_cuenta(db, body.usuario, nombre, empleado_id)
    db.commit()
    return PersonaOut(empleado_id=empleado_id, user_id=cuenta.id if cuenta else None)
