from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.models.empleado import Empleado
from app.models.enlace_acceso import EnlaceAcceso
from app.services import acceso_service as svc

router = APIRouter(prefix='/api/v1/enlaces-acceso', tags=['enlaces-acceso'])


class EnlaceCreate(BaseModel):
    cedula: str
    modulos: list[str]
    horas_vigencia: int = 24


class EnlaceOut(BaseModel):
    id: int
    cedula: str
    nombre: str | None
    modulos: list[str]
    pasos_completados: list[str]
    estado: str  # activo | usado | expirado | revocado | bloqueado
    expires_at: datetime
    created_at: datetime


class EnlaceCreado(EnlaceOut):
    token: str  # solo se devuelve al crearlo
    ruta: str   # "/acceso/<token>": el frontend la completa con su propio origen


class CedulaInfo(BaseModel):
    existe: bool
    activo: bool = False
    nombre: str | None = None
    tiene_cuenta: bool = False
    tiene_home_office: bool = False


def _nombre(db: Session, e: EnlaceAcceso, cache: dict[int, str]) -> str | None:
    if not e.empleado_id:
        return None
    if e.empleado_id not in cache:
        emp = db.get(Empleado, e.empleado_id)
        cache[e.empleado_id] = f'{emp.nombres} {emp.apellidos}' if emp else ''
    return cache[e.empleado_id] or None


def _out(db: Session, e: EnlaceAcceso, cache: dict[int, str]) -> dict:
    return dict(
        id=e.id, cedula=e.cedula, nombre=_nombre(db, e, cache), modulos=e.modulos,
        pasos_completados=e.pasos_completados or [], estado=svc.estado_enlace(e),
        expires_at=e.expires_at, created_at=e.created_at,
    )


@router.get('/cedula/{cedula}', response_model=CedulaInfo)
def consultar_cedula(
    cedula: str,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('enlaces:write')),
):
    """Validación inicial: indica si la cédula existe para sugerir el flujo (nuevo / existente)."""
    emp = svc.buscar_empleado(db, svc.normalizar_cedula(cedula))
    if emp is None:
        return CedulaInfo(existe=False)
    return CedulaInfo(
        existe=True, activo=emp.is_active, nombre=f'{emp.nombres} {emp.apellidos}',
        tiene_cuenta=svc.buscar_cuenta(db, emp) is not None,
        tiene_home_office=any(s.tipo == 'home_office' for s in emp.sedes_jornada),
    )


@router.post('', response_model=EnlaceCreado, status_code=status.HTTP_201_CREATED)
def crear(
    body: EnlaceCreate,
    db: Session = Depends(get_db),
    user=Depends(require_permissions('enlaces:write')),
):
    if not 1 <= body.horas_vigencia <= 24 * 14:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'La vigencia debe estar entre 1 hora y 14 días')
    enlace, token, _ = svc.crear_enlace(
        db, svc.normalizar_cedula(body.cedula), body.modulos, body.horas_vigencia, user.id
    )
    return EnlaceCreado(**_out(db, enlace, {}), token=token, ruta=f'/acceso/{token}')


@router.get('', response_model=list[EnlaceOut])
def listar(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('enlaces:write')),
):
    filas = db.scalars(select(EnlaceAcceso).order_by(EnlaceAcceso.created_at.desc()).limit(limit)).all()
    cache: dict[int, str] = {}
    return [EnlaceOut(**_out(db, e, cache)) for e in filas]


@router.delete('/{enlace_id}', status_code=204)
def revocar(
    enlace_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('enlaces:write')),
):
    enlace = db.get(EnlaceAcceso, enlace_id)
    if not enlace:
        raise HTTPException(status.HTTP_404_NOT_FOUND, 'Enlace no encontrado')
    if not enlace.revoked_at and not enlace.used_at:
        enlace.revoked_at = datetime.utcnow()
        db.commit()
