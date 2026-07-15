from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import or_, select, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, get_user_dominios, require_permissions
from app.models.ticket import Ticket, TicketComentario
from app.models.ticket_imagen import TicketImagen
from app.models.equipment import Equipment
from app.models.user import User
from app.schemas.portal import (
    ComentarioCreate,
    ComentarioOut,
    EquipoBrief,
    TicketImagenOut,
    TicketOut,
    TicketUpdate,
)

TICKET_FOTOS_DIR = Path('storage/ticket_fotos')
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'}

router = APIRouter(prefix='/api/v1/tickets', tags=['tickets'])


def _ticket_out(ticket: Ticket) -> TicketOut:
    asignado_nombre = None
    if ticket.asignado_a:
        asignado_nombre = ticket.asignado_a.full_name

    equipos = [
        EquipoBrief(
            id=e.id,
            codigo_interno=e.codigo_interno,
            tipo=e.tipo,
            marca=e.marca,
            modelo=e.modelo,
            estado=e.estado,
            dominio=e.dominio,
        )
        for e in ticket.equipos
    ]

    comentarios = [
        ComentarioOut(
            id=c.id,
            autor_nombre=c.autor_nombre,
            contenido=c.contenido,
            es_interno=c.es_interno,
            created_at=c.created_at,
        )
        for c in ticket.comentarios
    ]

    imagenes = [
        TicketImagenOut(id=i.id, url=f'/storage/ticket_fotos/{i.filename}')
        for i in ticket.imagenes
    ]
    return TicketOut(
        id=ticket.id,
        numero=f'TKT-{ticket.id:06d}',
        documento_identidad=ticket.documento_identidad,
        empleado_nombre=ticket.empleado_nombre,
        sede=ticket.sede,
        dominio=ticket.dominio,
        categoria=ticket.categoria,
        tipo_solicitud=ticket.tipo_solicitud,
        asunto=ticket.asunto,
        descripcion=ticket.descripcion,
        estado=ticket.estado,
        prioridad=ticket.prioridad,
        resolucion=ticket.resolucion,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        asignado_a_nombre=asignado_nombre,
        equipos=equipos,
        comentarios=comentarios,
        imagenes=imagenes,
    )


@router.get('')
def list_tickets(
    sede: str | None = Query(None),
    estado: str | None = Query(None),
    categoria: str | None = Query(None),
    dominio: str | None = Query(None),
    documento: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    user=Depends(require_permissions('tickets:read')),
):
    q = select(Ticket)
    dominios_permitidos = get_user_dominios(user)
    if dominios_permitidos is not None:
        q = q.where(Ticket.dominio.in_(dominios_permitidos))
    if dominio:
        q = q.where(Ticket.dominio == dominio)
    if sede:
        q = q.where(Ticket.sede == sede)
    if estado:
        q = q.where(Ticket.estado == estado)
    if categoria:
        q = q.where(Ticket.categoria == categoria)
    if documento:
        q = q.where(Ticket.documento_identidad.ilike(f'%{documento}%'))
    q = q.order_by(Ticket.created_at.desc())

    total = db.scalar(select(func.count()).select_from(q.subquery()))
    items = db.execute(q.offset(skip).limit(limit)).scalars().all()

    return {'items': [_ticket_out(t) for t in items], 'total': total or 0}


@router.get('/mis-tickets')
def get_mis_tickets(
    db: Session = Depends(get_db),
    user=Depends(require_permissions('tickets:read')),
):
    """Tickets del usuario: supervisores ven todos; técnicos ven los suyos + sin asignar."""
    estados_activos = ('abierto', 'en_revision', 'en_proceso', 'pendiente_usuario')
    user_perms = {p.code for role in user.roles for p in role.permissions}
    is_supervisor = user.is_superuser or 'tickets:write' in user_perms
    dominios_permitidos = get_user_dominios(user)

    if is_supervisor:
        q = select(Ticket).where(
            Ticket.estado.in_(estados_activos)
        ).order_by(Ticket.updated_at.desc())
    else:
        q = select(Ticket).where(
            Ticket.estado.in_(estados_activos),
            or_(Ticket.asignado_a_id == user.id, Ticket.asignado_a_id.is_(None)),
        ).order_by(Ticket.updated_at.desc())

    if dominios_permitidos is not None:
        q = q.where(Ticket.dominio.in_(dominios_permitidos))

    items = db.execute(q).scalars().all()
    return {'items': [_ticket_out(t) for t in items], 'total': len(items)}


@router.get('/asignables')
def list_asignables(
    dominio: str | None = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('tickets:write')),
):
    """Técnicos (tickets:read) que pueden atender el dominio dado, para el selector de asignación."""
    usuarios = db.scalars(
        select(User).where(User.is_active.is_(True)).order_by(User.full_name)
    ).all()
    resultado = []
    for u in usuarios:
        tiene_tickets = u.is_superuser or any(
            p.code == 'tickets:read' for role in u.roles for p in role.permissions
        )
        if not tiene_tickets:
            continue
        doms = get_user_dominios(u)  # None => superusuario (todos)
        if dominio and doms is not None and dominio not in doms:
            continue
        resultado.append({'id': u.id, 'full_name': u.full_name})
    return resultado


@router.get('/{ticket_id}', response_model=TicketOut)
def get_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('tickets:read')),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Ticket no encontrado')
    return _ticket_out(ticket)


@router.patch('/{ticket_id}', response_model=TicketOut)
def update_ticket(
    ticket_id: int,
    body: TicketUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('tickets:write')),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Ticket no encontrado')

    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(ticket, field, value)

    db.commit()
    db.refresh(ticket)
    return _ticket_out(ticket)


@router.post('/{ticket_id}/comentarios', response_model=ComentarioOut, status_code=201)
def add_comentario(
    ticket_id: int,
    body: ComentarioCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _=Depends(require_permissions('tickets:write')),
):
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Ticket no encontrado')

    comentario = TicketComentario(
        ticket_id=ticket_id,
        autor_nombre=user.full_name,
        contenido=body.contenido,
        es_interno=body.es_interno,
        user_id=user.id,
    )
    db.add(comentario)
    db.commit()
    db.refresh(comentario)
    return ComentarioOut(
        id=comentario.id,
        autor_nombre=comentario.autor_nombre,
        contenido=comentario.contenido,
        es_interno=comentario.es_interno,
        created_at=comentario.created_at,
    )


@router.post('/{ticket_id}/imagenes', status_code=201)
async def upload_imagenes_ticket(
    ticket_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
    _=Depends(require_permissions('tickets:write')),
):
    """Personal TI adjunta imágenes a un ticket (máx 5 por solicitud)."""
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Ticket no encontrado')
    if len(files) > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Máximo 5 imágenes por solicitud')
    TICKET_FOTOS_DIR.mkdir(parents=True, exist_ok=True)
    for file in files:
        content_type = file.content_type or ''
        if content_type not in ALLOWED_IMAGE_TYPES and not content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail=f'Tipo no permitido: {content_type}')
        data = await file.read()
        ext = Path(file.filename or 'foto.jpg').suffix.lower() or '.jpg'
        fname = f'{ticket_id}_{uuid4().hex}{ext}'
        (TICKET_FOTOS_DIR / fname).write_bytes(data)
        db.add(TicketImagen(ticket_id=ticket_id, filename=fname))
    db.commit()
    db.refresh(ticket)
    return {'uploaded': len(files), 'total': len(ticket.imagenes)}
