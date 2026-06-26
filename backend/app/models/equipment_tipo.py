from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.database import Base


class EquipmentTipo(Base):
    __tablename__ = 'equipment_tipos'

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(80), unique=True, nullable=False, index=True)
    es_periferico = Column(Boolean, default=False, nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    orden = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    specs = relationship(
        'EquipmentTipoSpec',
        back_populates='tipo',
        lazy='selectin',
        order_by='EquipmentTipoSpec.orden',
        cascade='all, delete-orphan',
    )


class EquipmentTipoSpec(Base):
    __tablename__ = 'equipment_tipo_specs'

    id = Column(Integer, primary_key=True, index=True)
    tipo_id = Column(Integer, ForeignKey('equipment_tipos.id', ondelete='CASCADE'), nullable=False, index=True)

    key = Column(String(80), nullable=False)
    label = Column(String(120), nullable=False)
    field_type = Column(String(20), nullable=False)
    options = Column(JSON, nullable=True)
    min_value = Column(Integer, nullable=True)
    max_value = Column(Integer, nullable=True)
    placeholder = Column(String(120), nullable=True)
    orden = Column(Integer, nullable=False, default=0)

    tipo = relationship('EquipmentTipo', back_populates='specs')
