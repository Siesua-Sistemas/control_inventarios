from sqlalchemy import Boolean, Column, Integer, JSON, Numeric, String

from app.database import Base


class MantenimientoPlantillaPaso(Base):
    __tablename__ = 'mantenimiento_plantilla_pasos'

    id = Column(Integer, primary_key=True, index=True)
    tipo_equipo = Column(String(80), nullable=False, index=True)
    tipo_mantenimiento = Column(String(30), nullable=False)  # 'Preventivo', 'Correctivo', 'Ambos'
    descripcion = Column(String(500), nullable=False)
    orden = Column(Integer, nullable=False, default=0)

    # Captura de datos: checkbox (default) | numero | texto | seleccion
    tipo_campo = Column(String(20), nullable=False, default='checkbox', server_default='checkbox')
    unidad = Column(String(30), nullable=True)
    opciones = Column(JSON, nullable=True)          # lista de strings para 'seleccion'
    valor_min = Column(Numeric(14, 4), nullable=True)
    valor_max = Column(Numeric(14, 4), nullable=True)
    obligatorio = Column(Boolean, nullable=False, default=True, server_default='true')
