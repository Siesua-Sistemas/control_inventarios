from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.orm import relationship

from app.database import Base


class MantenimientoPaso(Base):
    __tablename__ = 'mantenimiento_pasos'

    id = Column(Integer, primary_key=True, index=True)
    mantenimiento_id = Column(Integer, ForeignKey('mantenimientos.id'), nullable=False, index=True)
    orden = Column(Integer, nullable=False, default=0)
    descripcion = Column(String(500), nullable=False)
    completado = Column(Boolean, nullable=False, default=False)
    completado_en = Column(DateTime, nullable=True)

    # Captura de datos: checkbox (default) | numero | texto | seleccion
    tipo_campo = Column(String(20), nullable=False, default='checkbox', server_default='checkbox')
    unidad = Column(String(30), nullable=True)
    opciones = Column(JSON, nullable=True)          # lista de strings para 'seleccion'
    valor_min = Column(Numeric(14, 4), nullable=True)
    valor_max = Column(Numeric(14, 4), nullable=True)
    obligatorio = Column(Boolean, nullable=False, default=True, server_default='true')
    valor = Column(String(300), nullable=True)      # dato digitado por el técnico

    mantenimiento = relationship('Mantenimiento', back_populates='pasos')
