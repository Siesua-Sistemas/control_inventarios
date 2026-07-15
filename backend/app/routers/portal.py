import os
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_user_dominios
from app.models.audit_log import AuditLog
from app.models.bodega import Bodega
from app.models.empleado import Empleado
from app.models.equipment import Equipment
from app.models.red_wifi import RedWifi
from app.models.ticket import Ticket, TicketComentario, ticket_equipos
from app.models.ticket_imagen import TicketImagen
from app.models.user import User
from app.schemas.portal import (
    ComentarioPortalCreate,
    ComentarioPortalOut,
    EmpleadoBrief,
    EquipoBrief,
    RedWifiOut,
    TicketImagenOut,
    TicketPortalDetailOut,
    TicketPortalOut,
    TicketPublicoCreate,
    TicketPublicoOut,
    VerificarRequest,
    VerificarResponse,
)

TICKET_FOTOS_DIR = Path('storage/ticket_fotos')
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


async def _save_imagen(file: UploadFile, ticket_id: int, db: Session) -> TicketImagen:
    content_type = file.content_type or ''
    if content_type not in ALLOWED_IMAGE_TYPES and not content_type.startswith('image/'):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Tipo no permitido: {content_type}')
    data = await file.read()
    if len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Imagen demasiado grande (máx 10 MB)')
    ext = Path(file.filename or 'foto.jpg').suffix.lower() or '.jpg'
    fname = f'{ticket_id}_{uuid4().hex}{ext}'
    TICKET_FOTOS_DIR.mkdir(parents=True, exist_ok=True)
    (TICKET_FOTOS_DIR / fname).write_bytes(data)
    img = TicketImagen(ticket_id=ticket_id, filename=fname)
    db.add(img)
    return img

router = APIRouter(prefix='/api/v1/portal', tags=['portal'])

_ESTADOS_TICKET_ACTIVOS = ('abierto', 'en_revision', 'en_proceso', 'pendiente_usuario')


def _auto_asignar_ticket(db: Session, ticket: Ticket) -> None:
    """Asigna el ticket al técnico (tickets:read) del dominio del ticket con menor carga activa.

    Si ningún técnico atiende ese dominio, se deja sin asignar para que el supervisor
    lo asigne manualmente (evita asignar Bioingeniería a un técnico de IT).
    """
    candidatos: list[User] = db.execute(
        select(User).where(User.is_active.is_(True))
    ).scalars().all()

    def atiende_dominio(u: User) -> bool:
        doms = get_user_dominios(u)  # None => superusuario (todos)
        return doms is None or ticket.dominio in doms

    tecnicos = [
        u for u in candidatos
        if any(p.code == 'tickets:read' for role in u.roles for p in role.permissions)
        and atiende_dominio(u)
    ]
    if not tecnicos:
        return

    def carga(u: User) -> int:
        return db.scalar(
            select(func.count(Ticket.id)).where(
                Ticket.asignado_a_id == u.id,
                Ticket.estado.in_(_ESTADOS_TICKET_ACTIVOS),
            )
        ) or 0

    elegido = min(tecnicos, key=carga)
    ticket.asignado_a_id = elegido.id


def _log_access(
    db: Session,
    tipo: str,
    identificador: str | None,
    ip: str | None,
    user_agent: str | None,
    resultado: str,
    detalle: str | None = None,
    user_id: int | None = None,
) -> None:
    db.add(AuditLog(
        tipo_acceso=tipo,
        identificador=identificador,
        ip_address=ip,
        user_agent=user_agent,
        resultado=resultado,
        detalle=detalle,
        user_id=user_id,
    ))
    try:
        db.commit()
    except Exception:
        db.rollback()


def _get_ip(request: Request) -> str | None:
    forwarded = request.headers.get('x-forwarded-for')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.client.host if request.client else None


@router.post('/verificar', response_model=VerificarResponse)
def verificar(body: VerificarRequest, request: Request, db: Session = Depends(get_db)):
    ip = _get_ip(request)
    ua = request.headers.get('user-agent', '')[:500]

    empleado = db.execute(
        select(Empleado).where(Empleado.cedula == body.documento, Empleado.is_active.is_(True))
    ).scalar_one_or_none()

    if not empleado:
        _log_access(db, 'colaborador', body.documento, ip, ua, 'fallido', 'Cédula no registrada o inactiva')
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Cédula no registrada o empleado inactivo')

    _log_access(db, 'colaborador', body.documento, ip, ua, 'exitoso')

    # Redes WiFi activas — todas las sedes (visibles para cualquier empleado)
    redes = db.execute(
        select(RedWifi).where(RedWifi.is_active.is_(True)).order_by(RedWifi.sede, RedWifi.nombre_red)
    ).scalars().all()

    # Equipos asignados al empleado
    eq_asignados = db.execute(
        select(Equipment).where(
            Equipment.empleado_id == empleado.id,
            Equipment.is_active.is_(True),
        )
    ).scalars().all()

    # Equipos de la sede del empleado: en bodegas de la sede O ubicados en la sede
    # (los equipos de Bioingeniería suelen estar en salas, sin bodega ni empleado asignado).
    bodegas_sede = db.execute(
        select(Bodega.id).where(Bodega.sede == empleado.sede, Bodega.is_active.is_(True))
    ).scalars().all()

    # Match tolerante de sede: el nombre en empleados ("COLINA") puede no ser idéntico
    # al de equipment ("CC PARQUE COLINA"). Se usa contención insensible a mayúsculas.
    condiciones_sede = []
    if empleado.sede and empleado.sede.strip():
        condiciones_sede.append(Equipment.sede.ilike(f'%{empleado.sede.strip()}%'))
    if bodegas_sede:
        condiciones_sede.append(Equipment.bodega_id.in_(bodegas_sede))

    eq_bodega = []
    if condiciones_sede:
        eq_bodega = db.execute(
            select(Equipment).where(
                or_(*condiciones_sede),
                Equipment.is_active.is_(True),
            )
        ).scalars().all()

    asignados_ids = {e.id for e in eq_asignados}

    def _eq_brief(eq: Equipment, bodega_nombre: str | None = None) -> EquipoBrief:
        return EquipoBrief(
            id=eq.id,
            codigo_interno=eq.codigo_interno,
            tipo=eq.tipo,
            marca=eq.marca,
            modelo=eq.modelo,
            estado=eq.estado,
            dominio=eq.dominio,
            bodega_nombre=bodega_nombre,
        )

    equipos_asignados = [_eq_brief(e) for e in eq_asignados]
    equipos_bodega = [
        _eq_brief(e, bodega_nombre=e.bodega.nombre if e.bodega else None)
        for e in eq_bodega
        if e.id not in asignados_ids
    ]

    return VerificarResponse(
        empleado=EmpleadoBrief(
            nombres=empleado.nombres,
            apellidos=empleado.apellidos,
            sede=empleado.sede or '',
            cargo=empleado.cargo,
        ),
        redes_wifi=[RedWifiOut(
            id=r.id, sede=r.sede, nombre_red=r.nombre_red, tipo_red=r.tipo_red,
            contrasena=r.contrasena, descripcion=r.descripcion,
        ) for r in redes],
        equipos_asignados=equipos_asignados,
        equipos_bodega=equipos_bodega,
    )


@router.post('/wifi-vista', status_code=204)
def log_wifi_vista(
    body: VerificarRequest,
    wifi_id: int = Query(...),
    request: Request = None,
    db: Session = Depends(get_db),
):
    ip = _get_ip(request) if request else None
    ua = (request.headers.get('user-agent', '')[:500]) if request else None
    _log_access(db, 'wifi_password', body.documento, ip, ua, 'exitoso', f'red_id={wifi_id}')


@router.post('/tickets', response_model=TicketPublicoOut, status_code=201)
def crear_ticket(body: TicketPublicoCreate, request: Request, db: Session = Depends(get_db)):
    ip = _get_ip(request)
    ua = request.headers.get('user-agent', '')[:500]

    empleado = db.execute(
        select(Empleado).where(Empleado.cedula == body.documento, Empleado.is_active.is_(True))
    ).scalar_one_or_none()

    if not empleado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Cédula no registrada o empleado inactivo')

    # Bodegas de la sede del empleado
    bodegas_sede = set(db.execute(
        select(Bodega.id).where(Bodega.sede == empleado.sede, Bodega.is_active.is_(True))
    ).scalars().all())

    # Validar equipment_ids
    valid_ids: list[int] = []
    for eq_id in body.equipment_ids:
        eq = db.get(Equipment, eq_id)
        if eq and eq.is_active:
            if eq.empleado_id == empleado.id or eq.bodega_id in bodegas_sede:
                valid_ids.append(eq_id)

    ticket = Ticket(
        documento_identidad=body.documento,
        empleado_nombre=f'{empleado.nombres} {empleado.apellidos}',
        sede=empleado.sede or '',
        dominio=body.dominio if body.dominio in ('IT', 'Bioingeniería', 'General') else 'IT',
        categoria=body.categoria,
        tipo_solicitud=body.tipo_solicitud,
        asunto=body.asunto,
        descripcion=body.descripcion,
        prioridad=body.prioridad,
        empleado_id=empleado.id,
    )
    db.add(ticket)
    db.flush()

    if valid_ids:
        for eq_id in valid_ids:
            db.execute(ticket_equipos.insert().values(ticket_id=ticket.id, equipment_id=eq_id))

    _auto_asignar_ticket(db, ticket)
    db.commit()
    db.refresh(ticket)

    return TicketPublicoOut(
        id=ticket.id,
        numero=f'TKT-{ticket.id:06d}',
        asunto=ticket.asunto,
        estado=ticket.estado,
        created_at=ticket.created_at,
    )


@router.get('/ticket/{ticket_id}', response_model=TicketPortalDetailOut)
def get_ticket_portal(ticket_id: int, db: Session = Depends(get_db)):
    """Detalle público de un ticket (solo comentarios no internos)."""
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Ticket no encontrado')
    comentarios_publicos = [
        ComentarioPortalOut(
            id=c.id,
            autor_nombre=c.autor_nombre,
            contenido=c.contenido,
            created_at=c.created_at,
        )
        for c in ticket.comentarios
        if not c.es_interno
    ]
    return TicketPortalDetailOut(
        id=ticket.id,
        numero=f'TKT-{ticket.id:06d}',
        asunto=ticket.asunto,
        descripcion=ticket.descripcion,
        dominio=ticket.dominio,
        categoria=ticket.categoria,
        tipo_solicitud=ticket.tipo_solicitud,
        estado=ticket.estado,
        prioridad=ticket.prioridad,
        asignado_a_nombre=ticket.asignado_a.full_name if ticket.asignado_a else None,
        resolucion=ticket.resolucion,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        comentarios=comentarios_publicos,
        imagenes=[TicketImagenOut(id=i.id, url=f'/storage/ticket_fotos/{i.filename}') for i in ticket.imagenes],
    )


@router.post('/ticket/{ticket_id}/imagenes', status_code=201)
async def upload_imagenes_portal(
    ticket_id: int,
    documento: str = Form(...),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    """El empleado adjunta imágenes a su propio ticket (máx 5 por solicitud)."""
    ticket = db.get(Ticket, ticket_id)
    if not ticket or ticket.documento_identidad != documento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Ticket no encontrado')
    if len(files) > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Máximo 5 imágenes por solicitud')
    for file in files:
        await _save_imagen(file, ticket_id, db)
    db.commit()
    db.refresh(ticket)
    return {'uploaded': len(files), 'total': len(ticket.imagenes)}


@router.post('/ticket/{ticket_id}/comentario', response_model=ComentarioPortalOut, status_code=201)
def add_comentario_portal(
    ticket_id: int,
    body: ComentarioPortalCreate,
    db: Session = Depends(get_db),
):
    """El empleado agrega un comentario público a su propio ticket."""
    ticket = db.get(Ticket, ticket_id)
    if not ticket or ticket.documento_identidad != body.documento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Ticket no encontrado')
    comentario = TicketComentario(
        ticket_id=ticket_id,
        autor_nombre=ticket.empleado_nombre,
        contenido=body.contenido.strip(),
        es_interno=False,
    )
    db.add(comentario)
    db.commit()
    db.refresh(comentario)
    return ComentarioPortalOut(
        id=comentario.id,
        autor_nombre=comentario.autor_nombre,
        contenido=comentario.contenido,
        created_at=comentario.created_at,
    )


@router.get('/mis-tickets/{documento}', response_model=list[TicketPortalOut])
def get_tickets_por_documento(documento: str, db: Session = Depends(get_db)):
    """Retorna los últimos tickets de un empleado por cédula (sin autenticación)."""
    tickets = db.execute(
        select(Ticket)
        .where(Ticket.documento_identidad == documento)
        .order_by(Ticket.created_at.desc())
        .limit(15)
    ).scalars().all()
    return [
        TicketPortalOut(
            id=t.id,
            numero=f'TKT-{t.id:06d}',
            asunto=t.asunto,
            dominio=t.dominio,
            categoria=t.categoria,
            tipo_solicitud=t.tipo_solicitud,
            estado=t.estado,
            prioridad=t.prioridad,
            asignado_a_nombre=t.asignado_a.full_name if t.asignado_a else None,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in tickets
    ]
