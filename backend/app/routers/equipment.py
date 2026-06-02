import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.models.equipment import Equipment
from app.models.equipment_photo import EquipmentPhoto
from app.repositories.equipment_repository import EquipmentRepository
from app.schemas.equipment import (
    EquipmentBrief, EquipmentCreate, EquipmentListResponse,
    EquipmentOut, EquipmentPhotoOut, EquipmentProfile, EquipmentUpdate,
)
from app.services.equipment_service import EquipmentService
from app.specs_config import SPECS_BY_TIPO

STORAGE_DIR = 'storage/equipment_photos'
router = APIRouter(prefix='/api/v1/equipos', tags=['equipos'])


def _service(db: Session = Depends(get_db)) -> EquipmentService:
    return EquipmentService(EquipmentRepository(db))


@router.get('/specs-template')
def get_specs_template(tipo: str = Query(...)):
    template = SPECS_BY_TIPO.get(tipo, [])
    return {'tipo': tipo, 'fields': template}


@router.get('', response_model=EquipmentListResponse)
def list_equipment(
    search: str | None = Query(None),
    tipo: str | None = Query(None),
    sede: str | None = Query(None),
    estado: str | None = Query(None),
    service: EquipmentService = Depends(_service),
    _user=Depends(require_permissions('equipment:read')),
):
    items = service.list_equipment(search, tipo, sede, estado)
    return {'total': len(items), 'items': items}


@router.post('', response_model=EquipmentOut, status_code=201)
def create_equipment(
    payload: EquipmentCreate,
    service: EquipmentService = Depends(_service),
    _user=Depends(require_permissions('equipment:write')),
):
    return service.create_equipment(payload)


@router.get('/{equipment_id}/hoja-de-vida', response_model=EquipmentProfile)
def get_hoja_de_vida(
    equipment_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('equipment:read')),
):
    eq = db.scalar(select(Equipment).where(Equipment.id == equipment_id, Equipment.is_active.is_(True)))
    if not eq:
        raise HTTPException(status_code=404, detail='Equipo no encontrado')

    # Parent
    parent = None
    if eq.parent_equipment_id:
        p = db.scalar(select(Equipment).where(Equipment.id == eq.parent_equipment_id, Equipment.is_active.is_(True)))
        if p:
            parent = EquipmentBrief.model_validate(p)

    # Children (peripherals)
    children_orm = list(db.scalars(
        select(Equipment).where(Equipment.parent_equipment_id == equipment_id, Equipment.is_active.is_(True))
    ).all())
    children = [EquipmentBrief.model_validate(c) for c in children_orm]

    # Photos
    photos_orm = list(db.scalars(
        select(EquipmentPhoto).where(EquipmentPhoto.equipment_id == equipment_id).order_by(EquipmentPhoto.created_at.desc())
    ).all())
    api_base = os.environ.get('NEXT_PUBLIC_API_URL', 'http://localhost:8000')
    photos = [
        EquipmentPhotoOut(
            id=p.id,
            equipment_id=p.equipment_id,
            filename=p.filename,
            url=f'/storage/equipment_photos/{p.filename}',
            created_at=p.created_at,
        )
        for p in photos_orm
    ]

    specs_template = SPECS_BY_TIPO.get(eq.tipo, [])

    return EquipmentProfile(
        equipment=EquipmentOut.model_validate(eq),
        specs_template=specs_template,
        parent=parent,
        children=children,
        photos=photos,
    )


@router.patch('/{equipment_id}/specs', response_model=EquipmentOut)
def update_specs(
    equipment_id: int,
    specs: dict,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('equipment:write')),
):
    eq = db.scalar(select(Equipment).where(Equipment.id == equipment_id, Equipment.is_active.is_(True)))
    if not eq:
        raise HTTPException(status_code=404, detail='Equipo no encontrado')
    eq.specs = specs
    db.add(eq)
    db.commit()
    db.refresh(eq)
    return EquipmentOut.model_validate(eq)


@router.patch('/{equipment_id}/parent', response_model=EquipmentOut)
def set_parent(
    equipment_id: int,
    parent_id: int | None,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('equipment:write')),
):
    eq = db.scalar(select(Equipment).where(Equipment.id == equipment_id, Equipment.is_active.is_(True)))
    if not eq:
        raise HTTPException(status_code=404, detail='Equipo no encontrado')
    if parent_id and parent_id == equipment_id:
        raise HTTPException(status_code=400, detail='Un equipo no puede ser su propio padre')
    eq.parent_equipment_id = parent_id
    db.add(eq)
    db.commit()
    db.refresh(eq)
    return EquipmentOut.model_validate(eq)


@router.post('/{equipment_id}/fotos', response_model=EquipmentPhotoOut, status_code=201)
async def upload_foto(
    equipment_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('equipment:write')),
):
    eq = db.scalar(select(Equipment).where(Equipment.id == equipment_id, Equipment.is_active.is_(True)))
    if not eq:
        raise HTTPException(status_code=404, detail='Equipo no encontrado')

    # Validate image type
    if file.content_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
        raise HTTPException(status_code=400, detail='Solo se permiten imágenes JPEG, PNG, WebP o GIF')

    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'jpg'
    filename = f'{equipment_id}_{uuid.uuid4().hex}.{ext}'

    os.makedirs(STORAGE_DIR, exist_ok=True)
    path = os.path.join(STORAGE_DIR, filename)
    content = await file.read()
    with open(path, 'wb') as f:
        f.write(content)

    photo = EquipmentPhoto(equipment_id=equipment_id, filename=filename)
    db.add(photo)
    db.commit()
    db.refresh(photo)

    return EquipmentPhotoOut(
        id=photo.id,
        equipment_id=photo.equipment_id,
        filename=photo.filename,
        url=f'/storage/equipment_photos/{filename}',
        created_at=photo.created_at,
    )


@router.delete('/{equipment_id}/fotos/{photo_id}', status_code=204)
def delete_foto(
    equipment_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('equipment:write')),
):
    photo = db.scalar(
        select(EquipmentPhoto).where(EquipmentPhoto.id == photo_id, EquipmentPhoto.equipment_id == equipment_id)
    )
    if not photo:
        raise HTTPException(status_code=404, detail='Foto no encontrada')

    path = os.path.join(STORAGE_DIR, photo.filename)
    if os.path.exists(path):
        os.remove(path)

    db.delete(photo)
    db.commit()


@router.get('/{equipment_id}', response_model=EquipmentOut)
def get_equipment(
    equipment_id: int,
    service: EquipmentService = Depends(_service),
    _user=Depends(require_permissions('equipment:read')),
):
    return service.get_equipment(equipment_id)


@router.put('/{equipment_id}', response_model=EquipmentOut)
def update_equipment(
    equipment_id: int,
    payload: EquipmentUpdate,
    service: EquipmentService = Depends(_service),
    _user=Depends(require_permissions('equipment:write')),
):
    return service.update_equipment(equipment_id, payload)


@router.delete('/{equipment_id}', status_code=204)
def delete_equipment(
    equipment_id: int,
    service: EquipmentService = Depends(_service),
    _user=Depends(require_permissions('equipment:write')),
):
    service.delete_equipment(equipment_id)
