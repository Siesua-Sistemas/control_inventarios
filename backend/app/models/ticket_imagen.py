from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class TicketImagen(Base):
    __tablename__ = 'ticket_imagenes'

    id         = Column(Integer, primary_key=True, index=True)
    ticket_id  = Column(Integer, ForeignKey('tickets.id', ondelete='CASCADE'), nullable=False, index=True)
    filename   = Column(String(200), nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ticket = relationship('Ticket', back_populates='imagenes')
