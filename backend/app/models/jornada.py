from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String

from app.database import Base


class RegistroJornada(Base):
    __tablename__ = 'registros_jornada'

    id = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey('empleados.id', ondelete='CASCADE'), nullable=False, index=True)
    tipo = Column(String(10), nullable=False)  # 'entrada' | 'salida'
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    sede = Column(String(120), nullable=True)
    notas = Column(String(500), nullable=True)
    foto_url = Column(String(500), nullable=True)
    latitud = Column(Float, nullable=True)
    longitud = Column(Float, nullable=True)
    ip_publica = Column(String(45), nullable=True)
    dispositivo = Column(String(300), nullable=True)
    is_manual = Column(Boolean, default=False, server_default='false', nullable=False)
