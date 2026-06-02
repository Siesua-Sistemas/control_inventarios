from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_permissions
from app.repositories.equipment_repository import EquipmentRepository
from app.repositories.mantenimiento_repository import MantenimientoRepository
from app.schemas.mantenimiento import MantenimientoCreate, MantenimientoListResponse, MantenimientoOut, MantenimientoUpdate
from app.services.mantenimiento_service import MantenimientoService

router = APIRouter(prefix='/api/v1/mantenimientos', tags=['mantenimientos'])


def _service(db: Session = Depends(get_db)) -> MantenimientoService:
    return MantenimientoService(MantenimientoRepository(db), EquipmentRepository(db))


@router.get('', response_model=MantenimientoListResponse)
def list_mantenimientos(
    equipment_id: int = Query(...),
    service: MantenimientoService = Depends(_service),
    _user=Depends(require_permissions('mantenimientos:read')),
):
    items = service.list_by_equipment(equipment_id)
    return {'total': len(items), 'items': items}


@router.post('', response_model=MantenimientoOut, status_code=201)
def create_mantenimiento(
    payload: MantenimientoCreate,
    service: MantenimientoService = Depends(_service),
    user=Depends(require_permissions('mantenimientos:write')),
):
    return service.create(payload, user.id)


@router.put('/{mantenimiento_id}', response_model=MantenimientoOut)
def update_mantenimiento(
    mantenimiento_id: int,
    payload: MantenimientoUpdate,
    service: MantenimientoService = Depends(_service),
    _user=Depends(require_permissions('mantenimientos:write')),
):
    return service.update(mantenimiento_id, payload)


@router.delete('/{mantenimiento_id}', status_code=204)
def delete_mantenimiento(
    mantenimiento_id: int,
    service: MantenimientoService = Depends(_service),
    _user=Depends(require_permissions('mantenimientos:write')),
):
    service.delete(mantenimiento_id)
