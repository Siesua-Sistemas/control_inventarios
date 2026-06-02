from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base

TIPO_ENTREGA = 'Entrega'
TIPO_DEVOLUCION = 'Devolución'
TIPO_TRASLADO = 'Traslado'


class Asignacion(Base):
    __tablename__ = 'asignaciones'

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.id'), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # Entrega / Devolución / Traslado

    empleado_id = Column(Integer, ForeignKey('empleados.id'), nullable=True)
    bodega_origen_id = Column(Integer, ForeignKey('bodegas.id'), nullable=True)
    bodega_destino_id = Column(Integer, ForeignKey('bodegas.id'), nullable=True)

    estado_antes = Column(String(50), nullable=True)
    estado_despues = Column(String(50), nullable=False)
    observaciones = Column(String(500), nullable=True)

    fecha = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_by_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    equipment = relationship('Equipment', lazy='selectin')
    empleado = relationship('Empleado', lazy='selectin')
    bodega_origen = relationship('Bodega', foreign_keys=[bodega_origen_id], lazy='selectin')
    bodega_destino = relationship('Bodega', foreign_keys=[bodega_destino_id], lazy='selectin')
    created_by = relationship('User', lazy='selectin')
