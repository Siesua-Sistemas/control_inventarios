from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.jornada_associations import sede_jornada_bodegas


class SedeJornada(Base):
    __tablename__ = 'sedes_jornada'

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(120), unique=True, nullable=False, index=True)
    direccion = Column(String(250), nullable=True)
    ciudad = Column(String(100), nullable=True)
    latitud = Column(Float, nullable=False)
    longitud = Column(Float, nullable=False)
    radio_metros = Column(Integer, default=100, nullable=False)
    ip_autorizada = Column(String(45), nullable=True)
    tipo = Column(String(20), default='empresa', nullable=False)  # 'empresa' | 'home_office'
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    bodegas = relationship('Bodega', secondary=sede_jornada_bodegas, lazy='select')
