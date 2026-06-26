from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class EquipmentDocumento(Base):
    __tablename__ = 'equipment_documentos'

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey('equipment.id'), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    nombre = Column(String(200), nullable=False)
    tipo_doc = Column(String(50), nullable=False, default='Otro')
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    equipment = relationship('Equipment', back_populates='documentos')
