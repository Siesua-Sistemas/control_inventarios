from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String

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
    ubicacion_no_verificada = Column(Boolean, default=False, server_default='false', nullable=False)


class AlmuerzoManual(Base):
    """Override manual del descuento de almuerzo para un empleado en un día puntual.

    Cuando existe una fila aquí para (empleado_id, fecha), reemplaza por completo
    el cálculo automático de `_almuerzo_minutos()` basado en el horario de la sede.
    """
    __tablename__ = 'jornada_almuerzo_manual'

    id = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey('empleados.id', ondelete='CASCADE'), nullable=False, index=True)
    fecha = Column(Date, nullable=False)
    almuerzo_min = Column(Integer, nullable=False)
    created_by_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
