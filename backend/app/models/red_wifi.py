from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.database import Base


class RedWifi(Base):
    __tablename__ = 'redes_wifi'

    id          = Column(Integer, primary_key=True, index=True)
    sede        = Column(String(100), nullable=False, index=True)
    nombre_red  = Column(String(100), nullable=False)
    tipo_red    = Column(String(50), nullable=True)      # Corporativa | Visitantes | IoT
    contrasena  = Column(String(200), nullable=False)
    descripcion = Column(String(300), nullable=True)
    is_active   = Column(Boolean, default=True, nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
