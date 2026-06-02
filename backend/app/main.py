import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import settings
from app.database import Base, engine
from app.models.acta_entrega import ActaEntrega  # noqa: F401
from app.models.asignacion import Asignacion  # noqa: F401
from app.models.bodega import Bodega  # noqa: F401
from app.models.empleado import Empleado  # noqa: F401
from app.models.equipment import Equipment  # noqa: F401
from app.models.equipment_photo import EquipmentPhoto  # noqa: F401
from app.models.mantenimiento import Mantenimiento  # noqa: F401
from app.models.user import Permission, Role, User
from app.routers.actas import router as actas_router
from app.routers.asignaciones import router as asignaciones_router
from app.routers.auth import router as auth_router
from app.routers.bodegas import router as bodegas_router
from app.routers.dashboard import router as dashboard_router
from app.routers.empleados import router as empleados_router
from app.routers.equipment import router as equipment_router
from app.routers.mantenimientos import router as mantenimientos_router
from app.routers.users import router as users_router
from app.security import get_password_hash


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    seed_data()
    yield


def _run_migrations() -> None:
    """Add/rename columns on existing tables without Alembic."""
    with engine.connect() as conn:
        conn.execute(text(
            'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS bodega_id INTEGER REFERENCES bodegas(id) ON DELETE SET NULL'
        ))
        conn.execute(text(
            'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS empleado_id INTEGER REFERENCES empleados(id) ON DELETE SET NULL'
        ))
        # Rename area → ubicacion (idempotent)
        conn.execute(text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='equipment' AND column_name='area'
                ) AND NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='equipment' AND column_name='ubicacion'
                ) THEN
                    ALTER TABLE equipment RENAME COLUMN area TO ubicacion;
                END IF;
            END $$;
        """))
        conn.execute(text(
            'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS specs JSON'
        ))
        conn.execute(text(
            'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS parent_equipment_id INTEGER REFERENCES equipment(id) ON DELETE SET NULL'
        ))
        # actas_entrega: columnas opcionales por si la tabla ya existía parcialmente
        conn.execute(text(
            'ALTER TABLE actas_entrega ADD COLUMN IF NOT EXISTS firma_entrega TEXT'
        ))
        conn.execute(text(
            'ALTER TABLE actas_entrega ADD COLUMN IF NOT EXISTS firma_recibe TEXT'
        ))
        conn.commit()


app = FastAPI(title='Inventarios API', version='1.0.0', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(',') if origin.strip()],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

os.makedirs('storage/equipment_photos', exist_ok=True)
app.mount('/storage', StaticFiles(directory='storage'), name='storage')

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(equipment_router)
app.include_router(bodegas_router)
app.include_router(empleados_router)
app.include_router(asignaciones_router)
app.include_router(actas_router)
app.include_router(dashboard_router)
app.include_router(mantenimientos_router)


def seed_data():
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        permissions = [
            ('users:read', 'Ver usuarios', 'Permite listar usuarios'),
            ('users:write', 'Crear usuarios', 'Permite crear usuarios'),
            ('roles:read', 'Ver roles', 'Permite listar roles'),
            ('permissions:read', 'Ver permisos', 'Permite listar permisos'),
            ('auth:refresh', 'Refrescar sesión', 'Permite renovar tokens'),
            ('equipment:read', 'Ver equipos', 'Permite listar y consultar equipos'),
            ('equipment:write', 'Gestionar equipos', 'Permite crear, editar y eliminar equipos'),
            ('bodegas:read', 'Ver bodegas', 'Permite listar bodegas'),
            ('bodegas:write', 'Gestionar bodegas', 'Permite crear y editar bodegas'),
            ('empleados:read', 'Ver empleados', 'Permite listar empleados'),
            ('empleados:write', 'Gestionar empleados', 'Permite crear y editar empleados'),
            ('asignaciones:read', 'Ver asignaciones', 'Permite ver historial de movimientos'),
            ('asignaciones:write', 'Gestionar asignaciones', 'Permite entregar y recibir equipos'),
            ('mantenimientos:read', 'Ver mantenimientos', 'Permite ver registros de mantenimiento'),
            ('mantenimientos:write', 'Gestionar mantenimientos', 'Permite crear y editar mantenimientos'),
        ]

        existing_permissions = {p.code: p for p in db.query(Permission).all()}
        for code, name, description in permissions:
            if code not in existing_permissions:
                db.add(Permission(code=code, name=name, description=description))

        if not db.query(Role).count():
            admin_role = Role(name='SUPER_ADMIN', description='Administrador del sistema')
            db.add(admin_role)

        db.commit()

        admin_role = db.query(Role).filter(Role.name == 'SUPER_ADMIN').first()
        if admin_role:
            all_permissions = db.query(Permission).all()
            existing_codes = {p.code for p in admin_role.permissions}
            for perm in all_permissions:
                if perm.code not in existing_codes:
                    admin_role.permissions.append(perm)
            db.commit()

        if settings.SEED_ADMIN_PASSWORD and not db.query(User).count():
            user = User(
                email=settings.SEED_ADMIN_EMAIL,
                full_name='Administrador del Sistema',
                password_hash=get_password_hash(settings.SEED_ADMIN_PASSWORD),
                is_active=True,
                is_superuser=True,
            )
            user.roles.append(admin_role)
            db.add(user)
            db.commit()
    finally:
        db.close()


@app.get('/health')
def health():
    return {'status': 'ok'}
