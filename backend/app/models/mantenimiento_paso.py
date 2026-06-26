from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class MantenimientoPaso(Base):
    __tablename__ = 'mantenimiento_pasos'

    id = Column(Integer, primary_key=True, index=True)
    mantenimiento_id = Column(Integer, ForeignKey('mantenimientos.id'), nullable=False, index=True)
    orden = Column(Integer, nullable=False, default=0)
    descripcion = Column(String(500), nullable=False)
    completado = Column(Boolean, nullable=False, default=False)
    completado_en = Column(DateTime, nullable=True)

    mantenimiento = relationship('Mantenimiento', back_populates='pasos')
