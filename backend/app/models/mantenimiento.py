from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.database import Base


class Mantenimiento(Base):
    __tablename__ = 'mantenimientos'

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.id'), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # Preventivo / Correctivo
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)
    tecnico = Column(String(160), nullable=True)
    descripcion = Column(String(1000), nullable=False)
    costo = Column(Numeric(12, 2), nullable=True)
    observaciones = Column(String(500), nullable=True)
    proximo_mantenimiento = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    equipment = relationship('Equipment', lazy='selectin')
    created_by = relationship('User', lazy='selectin')
