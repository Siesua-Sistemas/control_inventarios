from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_any_permission, require_permissions
from app.repositories.empleado_repository import EmpleadoRepository
from app.schemas.empleado import (
    EmpleadoCreate, EmpleadoEstadoUpdate, EmpleadoListResponse,
    EmpleadoOut, EmpleadoUpdate, EquipoAsignadoOut,
)
from app.services.empleado_service import EmpleadoService

router = APIRouter(prefix='/api/v1/empleados', tags=['empleados'])


def _service(db: Session = Depends(get_db)) -> EmpleadoService:
    return EmpleadoService(EmpleadoRepository(db))


@router.get('', response_model=EmpleadoListResponse)
def list_empleados(
    search: str | None = Query(None),
    sede: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, ge=1, le=200),
    include_inactive: bool = Query(False),
    service: EmpleadoService = Depends(_service),
    _user=Depends(require_any_permission('empleados:read', 'asignaciones:write', 'asignaciones:entregar')),
):
    items, total = service.list_empleados(search, sede, skip, limit, include_inactive)
    return {'total': total, 'items': items}


@router.post('', response_model=EmpleadoOut, status_code=201)
def create_empleado(
    payload: EmpleadoCreate,
    service: EmpleadoService = Depends(_service),
    _user=Depends(require_permissions('empleados:write')),
):
    return service.create_empleado(payload)


@router.get('/{empleado_id}', response_model=EmpleadoOut)
def get_empleado(
    empleado_id: int,
    include_inactive: bool = Query(False),
    service: EmpleadoService = Depends(_service),
    _user=Depends(require_permissions('empleados:read')),
):
    emp = service.get_empleado(empleado_id, include_inactive)
    from app.services.empleado_service import _to_out
    return _to_out(emp)


@router.put('/{empleado_id}', response_model=EmpleadoOut)
def update_empleado(
    empleado_id: int,
    payload: EmpleadoUpdate,
    service: EmpleadoService = Depends(_service),
    _user=Depends(require_permissions('empleados:write')),
):
    return service.update_empleado(empleado_id, payload)


@router.patch('/{empleado_id}/estado', response_model=EmpleadoOut)
def toggle_estado_empleado(
    empleado_id: int,
    payload: EmpleadoEstadoUpdate,
    service: EmpleadoService = Depends(_service),
    _user=Depends(require_permissions('empleados:write')),
):
    return service.toggle_estado(empleado_id, payload.is_active)


@router.get('/{empleado_id}/equipos-actuales', response_model=list[EquipoAsignadoOut])
def get_equipos_actuales(
    empleado_id: int,
    service: EmpleadoService = Depends(_service),
    _user=Depends(require_permissions('empleados:read')),
):
    return service.get_equipos_actuales(empleado_id)


@router.delete('/{empleado_id}', status_code=204)
def delete_empleado(
    empleado_id: int,
    service: EmpleadoService = Depends(_service),
    _user=Depends(require_permissions('empleados:write')),
):
    service.delete_empleado(empleado_id)
