from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text,
)
from sqlalchemy.orm import relationship

from app.database import Base

ticket_equipos = Table(
    'ticket_equipos',
    Base.metadata,
    Column('ticket_id', Integer, ForeignKey('tickets.id', ondelete='CASCADE'), primary_key=True),
    Column('equipment_id', Integer, ForeignKey('equipment.id', ondelete='CASCADE'), primary_key=True),
)


class Ticket(Base):
    __tablename__ = 'tickets'

    id                  = Column(Integer, primary_key=True, index=True)
    documento_identidad = Column(String(30), nullable=False, index=True)
    empleado_nombre     = Column(String(200), nullable=False)
    sede                = Column(String(100), nullable=False)
    dominio             = Column(String(30), nullable=False, default='General', server_default='IT')
    categoria           = Column(String(30), nullable=False, default='Incidente')
    tipo_solicitud      = Column(String(30), nullable=False, default='Hardware')
    asunto              = Column(String(200), nullable=False)
    descripcion         = Column(Text, nullable=False)
    estado              = Column(String(30), nullable=False, default='abierto')
    prioridad           = Column(String(20), nullable=False, default='Media')
    resolucion          = Column(Text, nullable=True)
    created_at          = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    empleado_id         = Column(Integer, ForeignKey('empleados.id', ondelete='SET NULL'), nullable=True)
    asignado_a_id       = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    equipos     = relationship('Equipment', secondary=ticket_equipos, lazy='selectin')
    asignado_a  = relationship('User', foreign_keys=[asignado_a_id], lazy='selectin')
    comentarios = relationship(
        'TicketComentario', back_populates='ticket', lazy='selectin',
        order_by='TicketComentario.created_at',
    )
    imagenes = relationship(
        'TicketImagen', back_populates='ticket', lazy='selectin',
        cascade='all, delete-orphan', order_by='TicketImagen.uploaded_at',
    )


class TicketComentario(Base):
    __tablename__ = 'ticket_comentarios'

    id           = Column(Integer, primary_key=True, index=True)
    ticket_id    = Column(Integer, ForeignKey('tickets.id', ondelete='CASCADE'), nullable=False, index=True)
    autor_nombre = Column(String(200), nullable=False)
    contenido    = Column(Text, nullable=False)
    es_interno   = Column(Boolean, default=True, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_id      = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    ticket = relationship('Ticket', back_populates='comentarios')
