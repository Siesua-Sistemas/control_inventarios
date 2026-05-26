from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect

from app.config import settings
from app.database import Base, engine
from app.models.user import Permission, Role, User
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.security import get_password_hash


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_data()
    yield


app = FastAPI(title='Inventarios API', version='1.0.0', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.CORS_ORIGINS.split(',') if origin.strip()],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth_router)
app.include_router(users_router)


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
        ]

        existing_permissions = {permission.code: permission for permission in db.query(Permission).all()}
        for code, name, description in permissions:
            if code not in existing_permissions:
                db.add(Permission(code=code, name=name, description=description))

        if not db.query(Role).count():
            admin_role = Role(name='SUPER_ADMIN', description='Administrador del sistema')
            db.add(admin_role)

        db.commit()

        admin_role = db.query(Role).filter(Role.name == 'SUPER_ADMIN').first()
        if admin_role and not admin_role.permissions:
            permission_rows = db.query(Permission).all()
            admin_role.permissions = permission_rows
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
