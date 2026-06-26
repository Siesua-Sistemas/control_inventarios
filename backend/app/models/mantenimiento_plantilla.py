from sqlalchemy import Column, Integer, String

from app.database import Base


class MantenimientoPlantillaPaso(Base):
    __tablename__ = 'mantenimiento_plantilla_pasos'

    id = Column(Integer, primary_key=True, index=True)
    tipo_equipo = Column(String(80), nullable=False, index=True)
    tipo_mantenimiento = Column(String(30), nullable=False)  # 'Preventivo', 'Correctivo', 'Ambos'
    descripcion = Column(String(500), nullable=False)
    orden = Column(Integer, nullable=False, default=0)
