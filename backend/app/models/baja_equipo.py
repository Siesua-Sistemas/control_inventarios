from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base

MOTIVOS_BAJA = {'danado_irreparable', 'obsoleto', 'robado_perdido', 'fin_vida_util', 'otro'}
ESTADOS_BAJA = {'pendiente_aprobacion', 'aprobada', 'rechazada'}


class BajaEquipo(Base):
    __tablename__ = 'bajas_equipo'

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.id'), nullable=False, index=True)

    motivo = Column(String(30), nullable=False)
    motivo_detalle = Column(String(500), nullable=True)
    observaciones = Column(String(1000), nullable=True)

    estado = Column(String(20), nullable=False, default='pendiente_aprobacion')

    solicitado_por_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    solicitado_en = Column(DateTime, default=datetime.utcnow, nullable=False)

    firma_autoriza = Column(Text, nullable=True)
    autorizado_por_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    autorizado_en = Column(DateTime, nullable=True)
    comentario_aprobacion = Column(String(500), nullable=True)

    equipment_estado_antes = Column(String(50), nullable=True)

    equipment = relationship('Equipment', lazy='selectin')
    solicitado_por = relationship('User', foreign_keys=[solicitado_por_id], lazy='selectin')
    autorizado_por = relationship('User', foreign_keys=[autorizado_por_id], lazy='selectin')
    fotos = relationship('BajaEquipoFoto', back_populates='baja', cascade='all, delete-orphan', lazy='selectin')


class BajaEquipoFoto(Base):
    __tablename__ = 'baja_equipo_fotos'

    id = Column(Integer, primary_key=True, index=True)
    baja_id = Column(Integer, ForeignKey('bajas_equipo.id'), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    baja = relationship('BajaEquipo', back_populates='fotos')
