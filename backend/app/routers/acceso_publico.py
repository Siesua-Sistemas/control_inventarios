"""Endpoints públicos del enlace/QR de acceso. Sin JWT: la autorización es el token
secreto de la URL + la confirmación de la cédula en cada petición (no hay sesión)."""
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditLog
from app.services import acceso_service as svc

router = APIRouter(prefix='/api/v1/acceso', tags=['acceso-publico'])


class ModuloOut(BaseModel):
    codigo: str
    titulo: str


class EnlaceInfo(BaseModel):
    modulos: list[ModuloOut]
    expires_at: datetime


class CedulaIn(BaseModel):
    cedula: str


class PasoIn(BaseModel):
    cedula: str
    datos: dict


class SesionOut(BaseModel):
    nombre: str | None
    modulos: list[ModuloOut]
    completados: list[str]
    terminado: bool
    prefill: dict


def _modulos(codigos: list[str]) -> list[ModuloOut]:
    return [ModuloOut(codigo=c, titulo=svc.MODULOS[c]) for c in codigos]


def _log(db: Session, request: Request, enlace_id: int, resultado: str, detalle: str) -> None:
    ip = request.headers.get('x-forwarded-for', '').split(',')[0].strip() or (
        request.client.host if request.client else None
    )
    db.add(AuditLog(
        tipo_acceso='enlace', identificador=f'enlace:{enlace_id}', ip_address=ip,
        user_agent=request.headers.get('user-agent', '')[:500], resultado=resultado, detalle=detalle[:300],
    ))


def _sesion(db: Session, enlace) -> SesionOut:
    emp = svc.buscar_empleado(db, enlace.cedula)
    prefill: dict = {}
    if emp:
        prefill = {'email': emp.email or '', 'telefono': emp.telefono or ''}
        casa = next((s for s in emp.sedes_jornada if s.tipo == 'home_office'), None)
        if casa:
            prefill.update(direccion=casa.direccion or '', ciudad=casa.ciudad or '',
                           latitud=casa.latitud, longitud=casa.longitud)
    return SesionOut(
        nombre=emp.nombres if emp else None,
        modulos=_modulos(enlace.modulos),
        completados=list(enlace.pasos_completados or []),
        terminado=bool(enlace.used_at),
        prefill=prefill,
    )


@router.get('/{token}', response_model=EnlaceInfo)
def info(token: str, db: Session = Depends(get_db)):
    """Datos mínimos para pintar la pantalla de verificación (sin datos personales)."""
    enlace = svc.obtener_enlace(db, token)
    svc.exigir_activo(enlace)
    return EnlaceInfo(modulos=_modulos(enlace.modulos), expires_at=enlace.expires_at)


@router.post('/{token}/verificar', response_model=SesionOut)
def verificar(token: str, body: CedulaIn, request: Request, db: Session = Depends(get_db)):
    enlace = svc.obtener_enlace(db, token, lock=True)
    svc.exigir_activo(enlace)
    svc.confirmar_cedula(db, enlace, body.cedula)
    _log(db, request, enlace.id, 'exitoso', 'Cédula confirmada')
    db.commit()
    return _sesion(db, enlace)


@router.post('/{token}/pasos/{modulo}', response_model=SesionOut)
def completar_paso(token: str, modulo: str, body: PasoIn, request: Request, db: Session = Depends(get_db)):
    enlace = svc.obtener_enlace(db, token, lock=True)  # FOR UPDATE: un solo uso, sin carreras
    svc.exigir_activo(enlace)
    svc.confirmar_cedula(db, enlace, body.cedula)
    svc.ejecutar_paso(db, enlace, modulo, body.datos)
    _log(db, request, enlace.id, 'exitoso', f'Paso {modulo}')
    db.commit()
    return _sesion(db, enlace)
