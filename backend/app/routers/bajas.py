import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_user_dominios, require_any_permission, require_permissions
from app.models.baja_equipo import BajaEquipo, BajaEquipoFoto
from app.repositories.baja_equipo_repository import BajaEquipoRepository
from app.repositories.equipment_repository import EquipmentRepository
from app.schemas.baja_equipo import (
    BajaAprobarRequest,
    BajaEquipoCreate,
    BajaEquipoOut,
    BajaFotoOut,
    BajaListResponse,
)
from app.services.baja_equipo_service import BajaEquipoService

BAJA_STORAGE_DIR = 'storage/baja_equipo_fotos'
router = APIRouter(prefix='/api/v1/bajas', tags=['bajas'])


def _service(db: Session = Depends(get_db)) -> BajaEquipoService:
    return BajaEquipoService(BajaEquipoRepository(db), EquipmentRepository(db))


@router.post('', response_model=BajaEquipoOut, status_code=201)
def crear_baja(
    payload: BajaEquipoCreate,
    service: BajaEquipoService = Depends(_service),
    user=Depends(require_permissions('equipos:baja_solicitar')),
):
    return service.crear(payload, solicitado_por_id=user.id)


@router.get('', response_model=BajaListResponse)
def listar_bajas(
    estado: str | None = Query(None),
    equipment_id: int | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    service: BajaEquipoService = Depends(_service),
    user=Depends(require_any_permission('equipos:baja_solicitar', 'equipos:baja_aprobar')),
):
    items, total = service.listar(estado, equipment_id, skip, limit, get_user_dominios(user))
    return {'total': total, 'items': items}


@router.get('/{baja_id}', response_model=BajaEquipoOut)
def get_baja(
    baja_id: int,
    service: BajaEquipoService = Depends(_service),
    _user=Depends(require_any_permission('equipos:baja_solicitar', 'equipos:baja_aprobar')),
):
    return service.get(baja_id)


@router.post('/{baja_id}/aprobar', response_model=BajaEquipoOut)
def aprobar_baja(
    baja_id: int,
    payload: BajaAprobarRequest,
    service: BajaEquipoService = Depends(_service),
    user=Depends(require_permissions('equipos:baja_aprobar')),
):
    return service.aprobar(baja_id, payload, autorizado_por_id=user.id)


@router.post('/{baja_id}/fotos', response_model=BajaFotoOut, status_code=201)
async def subir_foto_baja(
    baja_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('equipos:baja_solicitar')),
):
    baja = db.get(BajaEquipo, baja_id)
    if not baja:
        raise HTTPException(status_code=404, detail='Solicitud de baja no encontrada')
    if baja.estado != 'pendiente_aprobacion':
        raise HTTPException(status_code=400, detail='Esta solicitud ya fue procesada')

    if file.content_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
        raise HTTPException(status_code=400, detail='Solo se permiten imágenes JPEG, PNG, WebP o GIF')

    ext = file.filename.rsplit('.', 1)[-1].lower() if file.filename and '.' in file.filename else 'jpg'
    filename = f'{baja_id}_{uuid.uuid4().hex}.{ext}'

    os.makedirs(BAJA_STORAGE_DIR, exist_ok=True)
    path = os.path.join(BAJA_STORAGE_DIR, filename)
    content = await file.read()
    with open(path, 'wb') as f:
        f.write(content)

    foto = BajaEquipoFoto(baja_id=baja_id, filename=filename)
    db.add(foto)
    db.commit()
    db.refresh(foto)

    return BajaFotoOut(id=foto.id, baja_id=baja_id, filename=filename, url=f'/storage/baja_equipo_fotos/{filename}', created_at=foto.created_at)


@router.delete('/{baja_id}/fotos/{foto_id}', status_code=204)
def eliminar_foto_baja(
    baja_id: int,
    foto_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('equipos:baja_solicitar')),
):
    baja = db.get(BajaEquipo, baja_id)
    if not baja:
        raise HTTPException(status_code=404, detail='Solicitud de baja no encontrada')
    if baja.estado != 'pendiente_aprobacion':
        raise HTTPException(status_code=400, detail='Esta solicitud ya fue procesada')

    foto = db.get(BajaEquipoFoto, foto_id)
    if not foto or foto.baja_id != baja_id:
        raise HTTPException(status_code=404, detail='Foto no encontrada')

    path = os.path.join(BAJA_STORAGE_DIR, foto.filename)
    if os.path.exists(path):
        os.remove(path)

    db.delete(foto)
    db.commit()
