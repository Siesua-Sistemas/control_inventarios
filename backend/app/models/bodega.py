from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Bodega(Base):
    __tablename__ = 'bodegas'

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(120), nullable=False)
    sede = Column(String(120), nullable=False)
    responsable = Column(String(160), nullable=True)
    descripcion = Column(String(300), nullable=True)
    dominio = Column(String(30), nullable=False, default='IT', server_default='IT')
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
