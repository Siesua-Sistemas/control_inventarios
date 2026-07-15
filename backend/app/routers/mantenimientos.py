import os
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_user_dominios, require_any_permission, require_permissions
from app.models.mantenimiento import Mantenimiento
from app.models.mantenimiento_paso import MantenimientoPaso
from app.models.mantenimiento_photo import MantenimientoPhoto
from app.models.mantenimiento_plantilla import MantenimientoPlantillaPaso
from app.models.equipment import Equipment
from app.repositories.equipment_repository import EquipmentRepository
from app.repositories.mantenimiento_config_repository import MantenimientoConfigRepository
from app.repositories.mantenimiento_repository import MantenimientoRepository
from app.schemas.mantenimiento import (
    AprobacionCreate,
    MantenimientoConfigListResponse,
    MantenimientoConfigOut,
    MantenimientoConfigUpdate,
    MantenimientoCreate,
    MantenimientoListResponse,
    MantenimientoOut,
    MantenimientoPartialUpdate,
    MantenimientoPhotoOut,
    MantenimientoUpdate,
    MantenimientosDashboard,
    PasoCreate,
    PasoOut,
    PasoUpdate,
    PlantillaPasoCreate,
    PlantillaPasoOut,
)
from app.services.mantenimiento_config_service import MantenimientoConfigService
from app.services.mantenimiento_dashboard_service import MantenimientoDashboardService
from app.services.mantenimiento_service import MantenimientoService, _paso_to_out

MANTENIMIENTO_STORAGE_DIR = 'storage/mantenimiento_photos'
router = APIRouter(prefix='/api/v1/mantenimientos', tags=['mantenimientos'])


def _service(db: Session = Depends(get_db)) -> MantenimientoService:
    return MantenimientoService(
        MantenimientoRepository(db),
        EquipmentRepository(db),
        MantenimientoConfigRepository(db),
    )


def _config_service(db: Session = Depends(get_db)) -> MantenimientoConfigService:
    return MantenimientoConfigService(MantenimientoConfigRepository(db))


@router.get('/dashboard', response_model=MantenimientosDashboard)
def get_mantenimientos_dashboard(
    db: Session = Depends(get_db),
    user=Depends(require_permissions('mantenimientos:read')),
):
    return MantenimientoDashboardService(db).get_dashboard(dominios_permitidos=get_user_dominios(user))


@router.get('/config', response_model=MantenimientoConfigListResponse)
def list_config(
    service: MantenimientoConfigService = Depends(_config_service),
    _user=Depends(require_permissions('mantenimientos:read')),
):
    items = service.list_all()
    return {'total': len(items), 'items': items}


@router.put('/config/{tipo_equipo}', response_model=MantenimientoConfigOut)
def update_config(
    tipo_equipo: str,
    payload: MantenimientoConfigUpdate,
    service: MantenimientoConfigService = Depends(_config_service),
    _user=Depends(require_permissions('mantenimientos:write')),
):
    return service.update(tipo_equipo, payload)


@router.get('/plantillas', response_model=list[PlantillaPasoOut])
def list_plantillas(
    tipo_equipo: str | None = Query(None),
    tipo_mantenimiento: str | None = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('mantenimientos:read')),
):
    q = select(MantenimientoPlantillaPaso).order_by(
        MantenimientoPlantillaPaso.tipo_equipo,
        MantenimientoPlantillaPaso.tipo_mantenimiento,
        MantenimientoPlantillaPaso.orden,
    )
    if tipo_equipo:
        q = q.where(MantenimientoPlantillaPaso.tipo_equipo == tipo_equipo)
    if tipo_mantenimiento:
        q = q.where(MantenimientoPlantillaPaso.tipo_mantenimiento == tipo_mantenimiento)
    return list(db.scalars(q).all())


@router.post('/plantillas', response_model=PlantillaPasoOut, status_code=201)
def create_plantilla(
    payload: PlantillaPasoCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('mantenimientos:write')),
):
    p = MantenimientoPlantillaPaso(
        tipo_equipo=payload.tipo_equipo,
        tipo_mantenimiento=payload.tipo_mantenimiento,
        descripcion=payload.descripcion,
        orden=payload.orden,
        tipo_campo=payload.tipo_campo,
        unidad=payload.unidad,
        opciones=payload.opciones,
        valor_min=payload.valor_min,
        valor_max=payload.valor_max,
        obligatorio=payload.obligatorio,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.delete('/plantillas/{plantilla_id}', status_code=204)
def delete_plantilla(
    plantilla_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('mantenimientos:write')),
):
    p = db.scalar(select(MantenimientoPlantillaPaso).where(MantenimientoPlantillaPaso.id == plantilla_id))
    if not p:
        raise HTTPException(status_code=404, detail='Plantilla no encontrada')
    db.delete(p)
    db.commit()


@router.get('', response_model=MantenimientoListResponse)
def list_mantenimientos(
    equipment_id: int | None = Query(None),
    sede: str | None = Query(None),
    tipo: str | None = Query(None),
    tipo_equipo: str | None = Query(None),
    estado_vencimiento: str | None = Query(None),
    proximo_desde: date | None = Query(None),
    proximo_hasta: date | None = Query(None),
    estado: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    service: MantenimientoService = Depends(_service),
    user=Depends(require_permissions('mantenimientos:read')),
):
    if equipment_id is not None:
        items = service.list_by_equipment(equipment_id)
        return {'total': len(items), 'items': items}
    total, items = service.list_global(sede, tipo, tipo_equipo, estado_vencimiento, proximo_desde, proximo_hasta, estado, skip, limit, dominios_permitidos=get_user_dominios(user))
    return {'total': total, 'items': items}


@router.post('', response_model=MantenimientoOut, status_code=201)
def create_mantenimiento(
    payload: MantenimientoCreate,
    service: MantenimientoService = Depends(_service),
    user=Depends(require_permissions('mantenimientos:create')),
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


@router.patch('/{mantenimiento_id}', response_model=MantenimientoOut)
def patch_mantenimiento(
    mantenimiento_id: int,
    payload: MantenimientoPartialUpdate,
    service: MantenimientoService = Depends(_service),
    _user=Depends(require_any_permission('mantenimientos:update', 'mantenimientos:write')),
):
    """Actualización ligera: solo estado y/o próxima fecha. Requiere mantenimientos:update o mantenimientos:write."""
    return service.update(mantenimiento_id, MantenimientoUpdate(
        estado=payload.estado,
        proximo_mantenimiento=payload.proximo_mantenimiento,
    ))


@router.delete('/{mantenimiento_id}', status_code=204)
def delete_mantenimiento(
    mantenimiento_id: int,
    service: MantenimientoService = Depends(_service),
    _user=Depends(require_permissions('mantenimientos:delete')),
):
    service.delete(mantenimiento_id)


@router.post('/{mantenimiento_id}/fotos', response_model=MantenimientoPhotoOut, status_code=201)
async def upload_mantenimiento_foto(
    mantenimiento_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('mantenimientos:write')),
):
    m = db.scalar(
        select(Mantenimiento).where(Mantenimiento.id == mantenimiento_id, Mantenimiento.is_active.is_(True))
    )
    if not m:
        raise HTTPException(status_code=404, detail='Mantenimiento no encontrado')
    _assert_editable(m)

    if file.content_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
        raise HTTPException(status_code=400, detail='Solo se permiten imágenes JPEG, PNG, WebP o GIF')

    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'jpg'
    filename = f'{mantenimiento_id}_{uuid.uuid4().hex}.{ext}'

    os.makedirs(MANTENIMIENTO_STORAGE_DIR, exist_ok=True)
    path = os.path.join(MANTENIMIENTO_STORAGE_DIR, filename)
    content = await file.read()
    with open(path, 'wb') as f:
        f.write(content)

    photo = MantenimientoPhoto(mantenimiento_id=mantenimiento_id, filename=filename)
    db.add(photo)
    db.commit()
    db.refresh(photo)

    return MantenimientoPhotoOut(
        id=photo.id,
        mantenimiento_id=photo.mantenimiento_id,
        filename=filename,
        url=f'/storage/mantenimiento_photos/{filename}',
        created_at=photo.created_at,
    )


@router.delete('/{mantenimiento_id}/fotos/{photo_id}', status_code=204)
def delete_mantenimiento_foto(
    mantenimiento_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('mantenimientos:write')),
):
    _assert_editable(_get_mantenimiento(mantenimiento_id, db))
    photo = db.scalar(
        select(MantenimientoPhoto).where(
            MantenimientoPhoto.id == photo_id,
            MantenimientoPhoto.mantenimiento_id == mantenimiento_id,
        )
    )
    if not photo:
        raise HTTPException(status_code=404, detail='Foto no encontrada')

    path = os.path.join(MANTENIMIENTO_STORAGE_DIR, photo.filename)
    if os.path.exists(path):
        os.remove(path)

    db.delete(photo)
    db.commit()


# ── Pasos (checklist) ──────────────────────────────────────────────────────────

def _get_mantenimiento(mantenimiento_id: int, db: Session) -> Mantenimiento:
    m = db.scalar(
        select(Mantenimiento).where(Mantenimiento.id == mantenimiento_id, Mantenimiento.is_active.is_(True))
    )
    if not m:
        raise HTTPException(status_code=404, detail='Mantenimiento no encontrado')
    return m


def _assert_editable(m: Mantenimiento) -> None:
    """Una OT aprobada es un registro inalterable (trazabilidad/auditoría)."""
    if m.estado == 'aprobado':
        raise HTTPException(
            status_code=400,
            detail='La OT está aprobada y es un registro inalterable; no admite cambios.',
        )


@router.get('/{mantenimiento_id}/pasos', response_model=list[PasoOut])
def list_pasos(
    mantenimiento_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('mantenimientos:read')),
):
    m = _get_mantenimiento(mantenimiento_id, db)
    return [_paso_to_out(p) for p in m.pasos]


@router.post('/{mantenimiento_id}/pasos', response_model=PasoOut, status_code=201)
def add_paso(
    mantenimiento_id: int,
    payload: PasoCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_any_permission('mantenimientos:update', 'mantenimientos:write')),
):
    _assert_editable(_get_mantenimiento(mantenimiento_id, db))
    paso = MantenimientoPaso(
        mantenimiento_id=mantenimiento_id,
        orden=payload.orden,
        descripcion=payload.descripcion,
        completado=False,
        tipo_campo=payload.tipo_campo,
        unidad=payload.unidad,
        opciones=payload.opciones,
        valor_min=payload.valor_min,
        valor_max=payload.valor_max,
        obligatorio=payload.obligatorio,
    )
    db.add(paso)
    db.commit()
    db.refresh(paso)
    return _paso_to_out(paso)


@router.patch('/{mantenimiento_id}/pasos/{paso_id}', response_model=PasoOut)
def update_paso(
    mantenimiento_id: int,
    paso_id: int,
    payload: PasoUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_any_permission('mantenimientos:update', 'mantenimientos:write')),
):
    _assert_editable(_get_mantenimiento(mantenimiento_id, db))
    paso = db.scalar(
        select(MantenimientoPaso).where(
            MantenimientoPaso.id == paso_id,
            MantenimientoPaso.mantenimiento_id == mantenimiento_id,
        )
    )
    if not paso:
        raise HTTPException(status_code=404, detail='Paso no encontrado')

    if payload.descripcion is not None:
        paso.descripcion = payload.descripcion
    # Para campos con captura de dato, el valor determina "completado"
    if payload.valor is not None:
        paso.valor = payload.valor or None
        if (paso.tipo_campo or 'checkbox') != 'checkbox':
            done = bool(paso.valor and paso.valor.strip())
            paso.completado = done
            paso.completado_en = datetime.utcnow() if done else None
    if payload.completado is not None:
        paso.completado = payload.completado
        paso.completado_en = datetime.utcnow() if payload.completado else None

    db.add(paso)
    db.commit()
    db.refresh(paso)
    return _paso_to_out(paso)


@router.delete('/{mantenimiento_id}/pasos/{paso_id}', status_code=204)
def delete_paso(
    mantenimiento_id: int,
    paso_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('mantenimientos:write')),
):
    _assert_editable(_get_mantenimiento(mantenimiento_id, db))
    paso = db.scalar(
        select(MantenimientoPaso).where(
            MantenimientoPaso.id == paso_id,
            MantenimientoPaso.mantenimiento_id == mantenimiento_id,
        )
    )
    if not paso:
        raise HTTPException(status_code=404, detail='Paso no encontrado')
    db.delete(paso)
    db.commit()


# ── Firma técnico ──────────────────────────────────────────────────────────────

@router.post('/{mantenimiento_id}/iniciar', response_model=MantenimientoOut)
def iniciar_mantenimiento(
    mantenimiento_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_any_permission('mantenimientos:update', 'mantenimientos:write')),
):
    """Cambia estado de programado → en_proceso."""
    from app.services.mantenimiento_service import _to_out
    m = _get_mantenimiento(mantenimiento_id, db)
    if m.estado != 'programado':
        raise HTTPException(status_code=400, detail='Solo se puede iniciar una OT programada')
    m.estado = 'en_proceso'
    if m.iniciado_en is None:
        m.iniciado_en = datetime.utcnow()  # preparado para KPIs de mano de obra
    db.add(m)
    db.commit()
    db.refresh(m)
    return _to_out(m)


@router.post('/{mantenimiento_id}/firma-tecnico', response_model=MantenimientoOut)
def set_firma_tecnico(
    mantenimiento_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _user=Depends(require_any_permission('mantenimientos:update', 'mantenimientos:write')),
):
    from app.services.mantenimiento_service import _to_out
    m = _get_mantenimiento(mantenimiento_id, db)
    firma = payload.get('firma_tecnico')
    if not firma:
        raise HTTPException(status_code=400, detail='firma_tecnico requerida')
    m.firma_tecnico = firma
    m.estado = 'pendiente_aprobacion'
    m.finalizado_en = datetime.utcnow()  # preparado para KPIs de mano de obra
    db.add(m)
    db.commit()
    db.refresh(m)
    return _to_out(m)


# ── Aprobación supervisor ──────────────────────────────────────────────────────

@router.post('/{mantenimiento_id}/aprobar', response_model=MantenimientoOut)
def aprobar_mantenimiento(
    mantenimiento_id: int,
    payload: AprobacionCreate,
    db: Session = Depends(get_db),
    user=Depends(require_permissions('mantenimientos:approve')),
):
    from app.services.mantenimiento_service import _to_out
    m = _get_mantenimiento(mantenimiento_id, db)
    if m.estado != 'pendiente_aprobacion':
        raise HTTPException(status_code=400, detail='El mantenimiento no está pendiente de aprobación')
    m.estado = 'aprobado' if payload.aprobado else 'rechazado'
    m.aprobado_por_id = user.id
    m.aprobado_en = datetime.utcnow()
    m.comentario_aprobacion = payload.comentario
    if payload.firma_supervisor:
        m.firma_supervisor = payload.firma_supervisor
    db.add(m)
    db.commit()
    db.refresh(m)
    return _to_out(m)


# ── Mis OTs ────────────────────────────────────────────────────────────────────

@router.get('/mis-ot', response_model=MantenimientoListResponse)
def get_mis_ot(
    db: Session = Depends(get_db),
    user=Depends(require_any_permission('mantenimientos:read', 'mantenimientos:update')),
):
    """OTs asignadas al usuario autenticado (via tecnico_id) en estados activos."""
    from sqlalchemy import select, or_
    from app.services.mantenimiento_service import _to_out

    dominios_permitidos = get_user_dominios(user)
    estados_activos = ('programado', 'en_proceso', 'pendiente_aprobacion')
    q = (
        select(Mantenimiento)
        .join(Equipment, Mantenimiento.equipment_id == Equipment.id)
        .where(
            Mantenimiento.is_active.is_(True),
            Mantenimiento.estado.in_(estados_activos),
            or_(
                Mantenimiento.tecnico_id == user.id,
                Mantenimiento.created_by_id == user.id,
            ),
        )
    )
    if dominios_permitidos is not None:
        q = q.where(Equipment.dominio.in_(dominios_permitidos))
    q = q.order_by(Mantenimiento.fecha)
    items = list(db.scalars(q).all())
    result = [_to_out(m) for m in items]
    return {'total': len(result), 'items': result}

