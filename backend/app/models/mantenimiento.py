from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Mantenimiento(Base):
    __tablename__ = 'mantenimientos'

    id = Column(Integer, primary_key=True, index=True)
    numero_ot = Column(String(20), nullable=True, unique=True, index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.id'), nullable=False, index=True)
    tipo = Column(String(30), nullable=False)  # Preventivo / Correctivo
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)
    tecnico = Column(String(160), nullable=True)
    descripcion = Column(String(1000), nullable=False)
    costo = Column(Numeric(12, 2), nullable=True)
    observaciones = Column(String(500), nullable=True)
    proximo_mantenimiento = Column(Date, nullable=True)
    estado = Column(String(30), nullable=False, default='programado', server_default='programado')
    prioridad = Column(String(10), nullable=False, default='Media', server_default='Media')

    # Tiempo de mano de obra — capturado automáticamente, sin cálculo/UI aún (preparado para KPIs futuros)
    iniciado_en = Column(DateTime, nullable=True)
    finalizado_en = Column(DateTime, nullable=True)

    tecnico_id = Column(Integer, ForeignKey('users.id'), nullable=True)

    # Firma digital del técnico (base64 PNG)
    firma_tecnico = Column(Text, nullable=True)
    # Aprobación del supervisor
    firma_supervisor = Column(Text, nullable=True)
    aprobado_por_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    aprobado_en = Column(DateTime, nullable=True)
    comentario_aprobacion = Column(String(500), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_by_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    equipment = relationship('Equipment', lazy='selectin')
    created_by = relationship('User', foreign_keys=[created_by_id], lazy='selectin')
    tecnico_user = relationship('User', foreign_keys=[tecnico_id], lazy='selectin')
    aprobado_por = relationship('User', foreign_keys=[aprobado_por_id], lazy='selectin')
    photos = relationship('MantenimientoPhoto', back_populates='mantenimiento', lazy='selectin')
    pasos = relationship('MantenimientoPaso', back_populates='mantenimiento', order_by='MantenimientoPaso.orden', lazy='selectin')
