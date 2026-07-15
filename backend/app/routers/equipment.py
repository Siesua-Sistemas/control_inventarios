import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_user_dominios, require_permissions
from app.models.equipment import Equipment
from app.models.equipment_documento import EquipmentDocumento
from app.models.equipment_photo import EquipmentPhoto
from app.repositories.equipment_repository import EquipmentRepository
from app.repositories.equipment_tipo_repository import EquipmentTipoRepository
from app.repositories.mantenimiento_config_repository import MantenimientoConfigRepository
from app.schemas.equipment import (
    EquipmentBrief, EquipmentCreate, EquipmentDocumentoOut, EquipmentListResponse,
    EquipmentOut, EquipmentPhotoOut, EquipmentProfile, EquipmentUpdate,
    EquipmentProximoPreventivoOut, EquipmentProximoPreventivoListResponse,
    CalibracionItem, CalibracionListResponse,
)
from app.schemas.equipment_tipo import (
    EquipmentTipoCreate, EquipmentTipoListResponse, EquipmentTipoOut,
    EquipmentTipoSpecsUpdate, EquipmentTipoUpdate,
)
from app.services.equipment_service import EquipmentService
from app.services.equipment_tipo_service import EquipmentTipoService
from app.utils.csv_export import csv_response

STORAGE_DIR = 'storage/equipment_photos'
DOCS_STORAGE_DIR = 'storage/equipment_docs'
ALLOWED_DOC_TYPES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/webp',
}
TIPOS_DOC = {'Manual', 'Certificado', 'Factura', 'Garantía', 'Contrato', 'Otro'}
router = APIRouter(prefix='/api/v1/equipos', tags=['equipos'])


def _service(db: Session = Depends(get_db)) -> EquipmentService:
    return EquipmentService(EquipmentRepository(db), EquipmentTipoRepository(db), MantenimientoConfigRepository(db))


def _tipo_service(db: Session = Depends(get_db)) -> EquipmentTipoService:
    return EquipmentTipoService(EquipmentTipoRepository(db))


@router.get('/specs-template')
def get_specs_template(tipo: str = Query(...), service: EquipmentTipoService = Depends(_tipo_service)):
    return {'tipo': tipo, 'fields': service.get_specs_template(tipo)}


@router.get('/tipos', response_model=EquipmentTipoListResponse)
def list_tipos(
    service: EquipmentTipoService = Depends(_tipo_service),
    user=Depends(require_permissions()),
):
    items = service.list_all(dominios_permitidos=get_user_dominios(user))
    return {'total': len(items), 'items': items}


@router.post('/tipos', response_model=EquipmentTipoOut, status_code=201)
def create_tipo(
    payload: EquipmentTipoCreate,
    service: EquipmentTipoService = Depends(_tipo_service),
    _user=Depends(require_permissions('equipment_types:write')),
):
    return service.create_tipo(payload)


@router.put('/tipos/{tipo_id}', response_model=EquipmentTipoOut)
def update_tipo(
    tipo_id: int,
    payload: EquipmentTipoUpdate,
    service: EquipmentTipoService = Depends(_tipo_service),
    _user=Depends(require_permissions('equipment_types:write')),
):
    return service.update_tipo(tipo_id, payload)


@router.put('/tipos/{tipo_id}/specs', response_model=EquipmentTipoOut)
def update_tipo_specs(
    tipo_id: int,
    payload: EquipmentTipoSpecsUpdate,
    service: EquipmentTipoService = Depends(_tipo_service),
    _user=Depends(require_permissions('equipment_types:write')),
):
    return service.update_specs(tipo_id, payload.specs)


@router.get('/proximos-preventivos', response_model=EquipmentProximoPreventivoListResponse)
def list_proximos_preventivos(
    desde: date | None = Query(None),
    hasta: date | None = Query(None),
    db: Session = Depends(get_db),
    user=Depends(require_permissions('mantenimientos:read')),
):
    from app.models.equipment_tipo import EquipmentTipo
    from app.repositories.mantenimiento_config_repository import MantenimientoConfigRepository

    config_repo = MantenimientoConfigRepository(db)
    configs = {c.tipo_equipo: c.frecuencia_meses for c in config_repo.list_all()}

    perifericos = set(
        row[0] for row in db.execute(
            select(EquipmentTipo.nombre).where(EquipmentTipo.es_periferico.is_(True))
        ).all()
    )

    dominios_permitidos = get_user_dominios(user)
    filters = [
        Equipment.is_active.is_(True),
        Equipment.proximo_preventivo.isnot(None),
    ]
    if dominios_permitidos is not None:
        filters.append(Equipment.dominio.in_(dominios_permitidos))
    if perifericos:
        filters.append(Equipment.tipo.notin_(perifericos))
    if desde:
        filters.append(Equipment.proximo_preventivo >= desde)
    if hasta:
        filters.append(Equipment.proximo_preventivo <= hasta)

    items = list(db.scalars(
        select(Equipment).where(*filters).order_by(Equipment.proximo_preventivo)
    ).all())

    result = [
        EquipmentProximoPreventivoOut(
            equipment_id=eq.id,
            equipment_codigo=eq.codigo_interno,
            equipment_marca=eq.marca,
            equipment_modelo=eq.modelo,
            equipment_tipo=eq.tipo,
            equipment_sede=eq.sede,
            proximo_preventivo=eq.proximo_preventivo,
            garantia_vence=eq.garantia_vence,
            fecha_compra=eq.fecha_compra,
            frecuencia_meses=configs.get(eq.tipo),
        )
        for eq in items
    ]
    return {'total': len(result), 'items': result}


@router.get('/calibraciones', response_model=CalibracionListResponse)
def list_calibraciones(
    vencidas: bool | None = Query(None),
    proximas_dias: int | None = Query(None, ge=1, le=365),
    db: Session = Depends(get_db),
    user=Depends(require_permissions('mantenimientos:read')),
):
    from datetime import date as _date
    today = _date.today()
    dominios_permitidos = get_user_dominios(user)
    filters = [
        Equipment.is_active.is_(True),
        Equipment.vencimiento_calibracion.isnot(None),
    ]
    if dominios_permitidos is not None:
        filters.append(Equipment.dominio.in_(dominios_permitidos))
    if vencidas is True:
        filters.append(Equipment.vencimiento_calibracion < today)
    elif vencidas is False:
        filters.append(Equipment.vencimiento_calibracion >= today)
    if proximas_dias is not None:
        from datetime import timedelta
        filters.append(Equipment.vencimiento_calibracion <= today + timedelta(days=proximas_dias))

    items = list(db.scalars(
        select(Equipment).where(*filters).order_by(Equipment.vencimiento_calibracion)
    ).all())

    result = [
        CalibracionItem(
            equipment_id=eq.id,
            equipment_codigo=eq.codigo_interno,
            equipment_marca=eq.marca,
            equipment_modelo=eq.modelo,
            equipment_tipo=eq.tipo,
            equipment_sede=eq.sede,
            criticidad=eq.criticidad,
            fecha_calibracion=eq.fecha_calibracion,
            vencimiento_calibracion=eq.vencimiento_calibracion,
            frecuencia_calibracion_meses=eq.frecuencia_calibracion_meses,
            dias_para_vencer=(eq.vencimiento_calibracion - today).days,
        )
        for eq in items
    ]
    return {'total': len(result), 'items': result}


@router.get('', response_model=EquipmentListResponse)
def list_equipment(
    search: str | None = Query(None),
    tipo: str | None = Query(None),
    sede: str | None = Query(None),
    estado: str | None = Query(None),
    criticidad: str | None = Query(None),
    dominio: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int | None = Query(None, ge=1, le=200),
    service: EquipmentService = Depends(_service),
    user=Depends(require_permissions('equipment:read')),
):
    items, total = service.list_equipment(
        search, tipo, sede, estado, criticidad,
        dominio_filter=dominio,
        dominios_permitidos=get_user_dominios(user),
        skip=skip, limit=limit,
    )
    return {'total': total, 'items': items}


@router.get('/export')
def export_equipment(
    search: str | None = Query(None),
    tipo: str | None = Query(None),
    sede: str | None = Query(None),
    estado: str | None = Query(None),
    criticidad: str | None = Query(None),
    dominio: str | None = Query(None),
    service: EquipmentService = Depends(_service),
    user=Depends(require_permissions('equipment:read', 'reports:export')),
):
    items, _ = service.list_equipment(
        search, tipo, sede, estado, criticidad,
        dominio_filter=dominio,
        dominios_permitidos=get_user_dominios(user),
        skip=0, limit=None,
    )
    rows = [
        [
            eq.codigo_interno,
            eq.serial,
            eq.tipo,
            eq.marca,
            eq.modelo,
            eq.placa or '',
            eq.sede,
            eq.ubicacion or '',
            eq.estado,
            eq.criticidad,
            eq.empleado_nombre or '',
            eq.valor if eq.valor is not None else '',
            eq.proveedor or '',
            eq.numero_factura or '',
            eq.fecha_compra.isoformat() if eq.fecha_compra else '',
            eq.garantia_vence.isoformat() if eq.garantia_vence else '',
            eq.observaciones or '',
        ]
        for eq in items
    ]
    return csv_response(
        'inventario_equipos.csv',
        ['Código', 'Serial', 'Tipo', 'Marca', 'Modelo', 'Placa', 'Sede', 'Ubicación', 'Estado', 'Criticidad',
         'Empleado asignado', 'Valor', 'Proveedor', 'N° Factura', 'Fecha compra', 'Garantía vence', 'Observaciones'],
        rows,
    )


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

    # Documentos
    docs_orm = list(db.scalars(
        select(EquipmentDocumento).where(EquipmentDocumento.equipment_id == equipment_id).order_by(EquipmentDocumento.created_at.desc())
    ).all())
    documentos = [
        EquipmentDocumentoOut(
            id=d.id,
            equipment_id=d.equipment_id,
            filename=d.filename,
            nombre=d.nombre,
            tipo_doc=d.tipo_doc,
            url=f'/storage/equipment_docs/{d.filename}',
            created_at=d.created_at,
        )
        for d in docs_orm
    ]

    specs_template = EquipmentTipoService(EquipmentTipoRepository(db)).get_specs_template(eq.tipo)

    return EquipmentProfile(
        equipment=EquipmentOut.model_validate(eq),
        specs_template=specs_template,
        parent=parent,
        children=children,
        photos=photos,
        documentos=documentos,
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
    parent_id: int | None = None,
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


@router.post('/{equipment_id}/documentos', response_model=EquipmentDocumentoOut, status_code=201)
async def upload_documento(
    equipment_id: int,
    file: UploadFile = File(...),
    nombre: str = '',
    tipo_doc: str = 'Otro',
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('equipment:write')),
):
    eq = db.scalar(select(Equipment).where(Equipment.id == equipment_id, Equipment.is_active.is_(True)))
    if not eq:
        raise HTTPException(status_code=404, detail='Equipo no encontrado')

    if file.content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(status_code=400, detail='Tipo de archivo no permitido. Use PDF, Word, Excel o imágenes.')

    if tipo_doc not in TIPOS_DOC:
        tipo_doc = 'Otro'

    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in (file.filename or '') else 'pdf'
    filename = f'{equipment_id}_{uuid.uuid4().hex}.{ext}'
    display_name = nombre.strip() or (file.filename or filename)

    os.makedirs(DOCS_STORAGE_DIR, exist_ok=True)
    path = os.path.join(DOCS_STORAGE_DIR, filename)
    content = await file.read()
    with open(path, 'wb') as f:
        f.write(content)

    doc = EquipmentDocumento(equipment_id=equipment_id, filename=filename, nombre=display_name, tipo_doc=tipo_doc)
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return EquipmentDocumentoOut(
        id=doc.id,
        equipment_id=doc.equipment_id,
        filename=doc.filename,
        nombre=doc.nombre,
        tipo_doc=doc.tipo_doc,
        url=f'/storage/equipment_docs/{filename}',
        created_at=doc.created_at,
    )


@router.delete('/{equipment_id}/documentos/{doc_id}', status_code=204)
def delete_documento(
    equipment_id: int,
    doc_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('equipment:write')),
):
    doc = db.scalar(
        select(EquipmentDocumento).where(EquipmentDocumento.id == doc_id, EquipmentDocumento.equipment_id == equipment_id)
    )
    if not doc:
        raise HTTPException(status_code=404, detail='Documento no encontrado')

    path = os.path.join(DOCS_STORAGE_DIR, doc.filename)
    if os.path.exists(path):
        os.remove(path)

    db.delete(doc)
    db.commit()


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
    _user=Depends(require_permissions('equipment:delete')),
):
    service.delete_equipment(equipment_id)
