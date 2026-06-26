from sqlalchemy import Column, ForeignKey, Integer, Table

from app.database import Base

# Junction: empleado ↔ sedes_jornada (un empleado puede estar en varias sedes de jornada)
empleado_sedes_jornada = Table(
    'empleado_sedes_jornada',
    Base.metadata,
    Column('empleado_id', Integer, ForeignKey('empleados.id', ondelete='CASCADE'), primary_key=True),
    Column('sede_jornada_id', Integer, ForeignKey('sedes_jornada.id', ondelete='CASCADE'), primary_key=True),
)

# Junction: sedes_jornada ↔ bodegas (una sede puede tener hasta 2 bodegas asociadas)
sede_jornada_bodegas = Table(
    'sede_jornada_bodegas',
    Base.metadata,
    Column('sede_jornada_id', Integer, ForeignKey('sedes_jornada.id', ondelete='CASCADE'), primary_key=True),
    Column('bodega_id', Integer, ForeignKey('bodegas.id', ondelete='CASCADE'), primary_key=True),
)
