from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.database import Base


class MantenimientoConfig(Base):
    __tablename__ = 'mantenimiento_configs'

    id = Column(Integer, primary_key=True, index=True)
    tipo_equipo = Column(String(80), unique=True, nullable=False, index=True)
    tiene_mantenimiento = Column(Boolean, nullable=False, default=True, server_default='true')
    frecuencia_meses = Column(Integer, nullable=False, default=6)
    descripcion = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
