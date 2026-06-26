from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Credencial(Base):
    __tablename__ = 'credenciales'

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(20), nullable=False)  # 'equipo' | 'cuenta'
    nombre = Column(String(160), nullable=False)
    equipment_id = Column(Integer, ForeignKey('equipment.id'), nullable=True)
    usuario = Column(String(160), nullable=True)
    password_encrypted = Column(Text, nullable=False)
    url = Column(String(255), nullable=True)
    notas = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    equipment = relationship('Equipment', lazy='selectin')
    created_by = relationship('User', lazy='selectin')
