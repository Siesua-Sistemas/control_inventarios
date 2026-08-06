import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.config import settings
from app.database import Base, engine
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.acta_entrega import ActaEntrega  # noqa: F401
from app.models.asignacion import Asignacion  # noqa: F401
from app.models.bodega import Bodega  # noqa: F401
from app.models.credencial import Credencial  # noqa: F401
from app.models.empleado import Empleado  # noqa: F401
from app.models.equipment import Equipment  # noqa: F401
from app.models.equipment_documento import EquipmentDocumento  # noqa: F401
from app.models.equipment_photo import EquipmentPhoto  # noqa: F401
from app.models.equipment_tipo import EquipmentTipo, EquipmentTipoSpec  # noqa: F401
from app.models.mantenimiento import Mantenimiento  # noqa: F401
from app.models.mantenimiento_config import MantenimientoConfig
from app.models.mantenimiento_paso import MantenimientoPaso  # noqa: F401
from app.models.mantenimiento_plantilla import MantenimientoPlantillaPaso  # noqa: F401
from app.models.mantenimiento_photo import MantenimientoPhoto  # noqa: F401
from app.models.jornada import RegistroJornada  # noqa: F401
from app.models.jornada_associations import empleado_sedes_jornada, sede_jornada_bodegas  # noqa: F401
from app.models.sede_jornada import SedeJornada  # noqa: F401
from app.models.integracion_siesua import SiesuaMapping  # noqa: F401
from app.models.red_wifi import RedWifi  # noqa: F401
from app.models.ticket import Ticket, TicketComentario, ticket_equipos  # noqa: F401
from app.models.ticket_imagen import TicketImagen  # noqa: F401
from app.models.user import Permission, Role, User
from app.routers.actas import router as actas_router
from app.routers.asignaciones import router as asignaciones_router
from app.routers.auth import router as auth_router
from app.routers.bodegas import router as bodegas_router
from app.routers.credenciales import router as credenciales_router
from app.routers.jornada import router as jornada_router
from app.routers.portal import router as portal_router
from app.routers.redes_wifi import router as redes_wifi_router
from app.routers.integraciones import router as integraciones_router
from app.routers.tickets import router as tickets_router
from app.routers.dashboard import router as dashboard_router
from app.routers.empleados import router as empleados_router
from app.routers.equipment import router as equipment_router
from app.routers.mantenimientos import router as mantenimientos_router
from app.routers.users import router as users_router
from app.security import get_password_hash
from app.specs_config import SPECS_BY_TIPO


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
        conn.execute(text(
            "ALTER TABLE roles ADD COLUMN IF NOT EXISTS home_dashboard VARCHAR(20) NOT NULL DEFAULT 'general'"
        ))
        conn.execute(text(
            "ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'programado'"
        ))
        conn.execute(text(
            'ALTER TABLE equipment ADD COLUMN IF NOT EXISTS proximo_preventivo DATE'
        ))
        conn.execute(text(
            'ALTER TABLE mantenimiento_configs ADD COLUMN IF NOT EXISTS tiene_mantenimiento BOOLEAN NOT NULL DEFAULT true'
        ))
        # Backfill proximo_preventivo for equipment with no preventive maintenance
        conn.execute(text("""
            UPDATE equipment e
            SET proximo_preventivo = e.garantia_vence
            WHERE e.is_active = true
              AND e.garantia_vence IS NOT NULL
              AND e.proximo_preventivo IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM mantenimientos m
                  WHERE m.equipment_id = e.id AND m.tipo = 'Preventivo' AND m.is_active = true
              )
              AND e.tipo NOT IN (SELECT nombre FROM equipment_tipos WHERE es_periferico = true)
        """))
        conn.execute(text("""
            UPDATE equipment e
            SET proximo_preventivo = (
                e.fecha_compra + (mc.frecuencia_meses || ' months')::interval
            )::date
            FROM mantenimiento_configs mc
            WHERE e.tipo = mc.tipo_equipo
              AND e.is_active = true
              AND e.garantia_vence IS NULL
              AND e.fecha_compra IS NOT NULL
              AND e.proximo_preventivo IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM mantenimientos m
                  WHERE m.equipment_id = e.id AND m.tipo = 'Preventivo' AND m.is_active = true
              )
              AND e.tipo NOT IN (SELECT nombre FROM equipment_tipos WHERE es_periferico = true)
        """))
        conn.execute(text("""
            UPDATE equipment e
            SET proximo_preventivo = (
                e.created_at::date + (mc.frecuencia_meses || ' months')::interval
            )::date
            FROM mantenimiento_configs mc
            WHERE e.tipo = mc.tipo_equipo
              AND e.is_active = true
              AND e.garantia_vence IS NULL
              AND e.fecha_compra IS NULL
              AND e.proximo_preventivo IS NULL
              AND NOT EXISTS (
                  SELECT 1 FROM mantenimientos m
                  WHERE m.equipment_id = e.id AND m.tipo = 'Preventivo' AND m.is_active = true
              )
              AND e.tipo NOT IN (SELECT nombre FROM equipment_tipos WHERE es_periferico = true)
        """))
        conn.execute(text(
            "ALTER TABLE equipment ADD COLUMN IF NOT EXISTS criticidad VARCHAR(10) NOT NULL DEFAULT 'Media'"
        ))
        conn.execute(text('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS fecha_calibracion DATE'))
        conn.execute(text('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS vencimiento_calibracion DATE'))
        conn.execute(text('ALTER TABLE equipment ADD COLUMN IF NOT EXISTS frecuencia_calibracion_meses INTEGER'))
        # P5: OT completa
        conn.execute(text(
            "ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) NOT NULL DEFAULT 'Media'"
        ))
        conn.execute(text('ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS firma_tecnico TEXT'))
        conn.execute(text('ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS firma_supervisor TEXT'))
        conn.execute(text(
            'ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS aprobado_por_id INTEGER REFERENCES users(id) ON DELETE SET NULL'
        ))
        conn.execute(text('ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS aprobado_en TIMESTAMP'))
        conn.execute(text('ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS comentario_aprobacion VARCHAR(500)'))
        # Ampliar columna estado para los nuevos valores
        conn.execute(text("ALTER TABLE mantenimientos ALTER COLUMN estado TYPE VARCHAR(30)"))
        conn.execute(text("ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS numero_ot VARCHAR(20)"))
        conn.execute(text(
            "ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS tecnico_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
        ))
        # Mi Jornada — tabla de registros de ingreso/salida
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS registros_jornada (
                id SERIAL PRIMARY KEY,
                empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
                tipo VARCHAR(10) NOT NULL,
                timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
                sede VARCHAR(120),
                notas VARCHAR(500)
            )
        """))
        conn.execute(text(
            'CREATE INDEX IF NOT EXISTS ix_registros_jornada_empleado_id ON registros_jornada(empleado_id)'
        ))
        # Fase 1 — evidencia fotográfica y geolocalización
        conn.execute(text('ALTER TABLE registros_jornada ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500)'))
        conn.execute(text('ALTER TABLE registros_jornada ADD COLUMN IF NOT EXISTS latitud FLOAT'))
        conn.execute(text('ALTER TABLE registros_jornada ADD COLUMN IF NOT EXISTS longitud FLOAT'))
        conn.execute(text('ALTER TABLE registros_jornada ADD COLUMN IF NOT EXISTS ip_publica VARCHAR(45)'))
        conn.execute(text('ALTER TABLE registros_jornada ADD COLUMN IF NOT EXISTS dispositivo VARCHAR(300)'))
        conn.execute(text('ALTER TABLE registros_jornada ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT false'))
        # Fase 2 — sedes con geovalla
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sedes_jornada (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(120) UNIQUE NOT NULL,
                direccion VARCHAR(250),
                ciudad VARCHAR(100),
                latitud FLOAT NOT NULL,
                longitud FLOAT NOT NULL,
                radio_metros INTEGER NOT NULL DEFAULT 100,
                ip_autorizada VARCHAR(45),
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        conn.execute(text(
            'CREATE INDEX IF NOT EXISTS ix_sedes_jornada_nombre ON sedes_jornada(nombre)'
        ))
        # Jornada personal: flag en_jornada + relaciones multi-sede y sede-bodega
        conn.execute(text(
            'ALTER TABLE empleados ADD COLUMN IF NOT EXISTS en_jornada BOOLEAN NOT NULL DEFAULT FALSE'
        ))
        conn.execute(text(
            'ALTER TABLE empleados ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE'
        ))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS empleado_sedes_jornada (
                empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
                sede_jornada_id INTEGER NOT NULL REFERENCES sedes_jornada(id) ON DELETE CASCADE,
                PRIMARY KEY (empleado_id, sede_jornada_id)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sede_jornada_bodegas (
                sede_jornada_id INTEGER NOT NULL REFERENCES sedes_jornada(id) ON DELETE CASCADE,
                bodega_id INTEGER NOT NULL REFERENCES bodegas(id) ON DELETE CASCADE,
                PRIMARY KEY (sede_jornada_id, bodega_id)
            )
        """))
        conn.execute(text(
            "ALTER TABLE sedes_jornada ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'empresa'"
        ))
        conn.execute(text(
            "ALTER TABLE sedes_jornada ADD COLUMN IF NOT EXISTS horario_config JSONB"
        ))
        # Almuerzo manual — override puntual del descuento automático por sede/día
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS jornada_almuerzo_manual (
                id SERIAL PRIMARY KEY,
                empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
                fecha DATE NOT NULL,
                almuerzo_min INTEGER NOT NULL,
                created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_jornada_almuerzo_empleado_fecha UNIQUE (empleado_id, fecha)
            )
        """))
        # Integración SIESUA — tabla de mapeo aislada
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS integracion_siesua_mapping (
                id SERIAL PRIMARY KEY,
                tipo VARCHAR(20) NOT NULL,
                ext_id VARCHAR(50) NOT NULL,
                internal_id INTEGER NOT NULL,
                synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
                CONSTRAINT uq_siesua_tipo_ext_id UNIQUE (tipo, ext_id)
            )
        """))
        # Dominios de inventario — IT / Bioingeniería / General
        conn.execute(text(
            "ALTER TABLE equipment ADD COLUMN IF NOT EXISTS dominio VARCHAR(30) NOT NULL DEFAULT 'IT'"
        ))
        conn.execute(text(
            "ALTER TABLE bodegas ADD COLUMN IF NOT EXISTS dominio VARCHAR(30) NOT NULL DEFAULT 'IT'"
        ))
        conn.execute(text(
            "ALTER TABLE equipment_tipos ADD COLUMN IF NOT EXISTS dominio VARCHAR(30) NOT NULL DEFAULT 'IT'"
        ))
        conn.execute(text(
            "ALTER TABLE actas_entrega ADD COLUMN IF NOT EXISTS dominio VARCHAR(30) NOT NULL DEFAULT 'IT'"
        ))
        conn.execute(text(
            "ALTER TABLE roles ADD COLUMN IF NOT EXISTS dominios JSON NOT NULL DEFAULT '[\"IT\"]'"
        ))

        # Checklist con captura de datos (numero/texto/seleccion además de checkbox)
        for tabla in ('mantenimiento_plantilla_pasos', 'mantenimiento_pasos'):
            conn.execute(text(
                f"ALTER TABLE {tabla} ADD COLUMN IF NOT EXISTS tipo_campo VARCHAR(20) NOT NULL DEFAULT 'checkbox'"
            ))
            conn.execute(text(f'ALTER TABLE {tabla} ADD COLUMN IF NOT EXISTS unidad VARCHAR(30)'))
            conn.execute(text(f'ALTER TABLE {tabla} ADD COLUMN IF NOT EXISTS opciones JSON'))
            conn.execute(text(f'ALTER TABLE {tabla} ADD COLUMN IF NOT EXISTS valor_min NUMERIC(14,4)'))
            conn.execute(text(f'ALTER TABLE {tabla} ADD COLUMN IF NOT EXISTS valor_max NUMERIC(14,4)'))
            conn.execute(text(
                f'ALTER TABLE {tabla} ADD COLUMN IF NOT EXISTS obligatorio BOOLEAN NOT NULL DEFAULT true'
            ))
        conn.execute(text('ALTER TABLE mantenimiento_pasos ADD COLUMN IF NOT EXISTS valor VARCHAR(300)'))

        # Tiempo de mano de obra — preparado (sin cálculo/UI aún)
        conn.execute(text('ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS iniciado_en TIMESTAMP'))
        conn.execute(text('ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS finalizado_en TIMESTAMP'))

        # Dominio de tickets (IT / Bioingeniería / General) — existentes quedan como IT
        conn.execute(text("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS dominio VARCHAR(30) NOT NULL DEFAULT 'IT'"))
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
os.makedirs('storage/equipment_docs', exist_ok=True)
os.makedirs('storage/mantenimiento_photos', exist_ok=True)
os.makedirs('storage/ticket_fotos', exist_ok=True)
os.makedirs('storage/jornadas', exist_ok=True)
app.mount('/storage', StaticFiles(directory='storage'), name='storage')
# También bajo /api/storage para que Traefik lo enrute con el prefijo /api
app.mount('/api/storage', StaticFiles(directory='storage'), name='api_storage')

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(equipment_router)
app.include_router(bodegas_router)
app.include_router(empleados_router)
app.include_router(asignaciones_router)
app.include_router(actas_router)
app.include_router(dashboard_router)
app.include_router(mantenimientos_router)
app.include_router(credenciales_router)
app.include_router(jornada_router)
app.include_router(integraciones_router)
app.include_router(portal_router)
app.include_router(redes_wifi_router)
app.include_router(tickets_router)


def seed_data():
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        permissions = [
            ('users:read', 'Ver usuarios', 'Permite listar usuarios'),
            ('users:write', 'Crear usuarios', 'Permite crear usuarios'),
            ('roles:read', 'Ver roles', 'Permite listar roles'),
            ('roles:write', 'Gestionar roles', 'Permite crear roles y editar sus permisos'),
            ('permissions:read', 'Ver permisos', 'Permite listar permisos'),
            ('auth:refresh', 'Refrescar sesión', 'Permite renovar tokens'),
            ('equipment:read', 'Ver equipos', 'Permite listar y consultar equipos'),
            ('equipment:write', 'Gestionar equipos', 'Permite crear, editar y eliminar equipos'),
            ('equipment:hoja_vida', 'Ver hoja de vida', 'Permite ver la hoja de vida completa de un equipo'),
            ('equipment:delete', 'Eliminar equipos', 'Permite eliminar equipos (usuario avanzado)'),
            ('bodegas:read', 'Ver bodegas', 'Permite listar bodegas'),
            ('bodegas:write', 'Gestionar bodegas', 'Permite crear y editar bodegas'),
            ('bodegas:delete', 'Editar y eliminar bodegas', 'Permite editar y eliminar bodegas (usuario avanzado)'),
            ('empleados:read', 'Ver empleados', 'Permite listar empleados'),
            ('empleados:write', 'Gestionar empleados', 'Permite crear y editar empleados'),
            ('asignaciones:read', 'Ver asignaciones', 'Permite ver historial de movimientos'),
            ('asignaciones:entregar', 'Nueva entrega', 'Permite entregar equipos a empleados y generar actas de entrega'),
            ('asignaciones:write', 'Gestionar asignaciones', 'Permite entregar, recibir y gestionar todos los movimientos de equipos'),
            ('asignaciones:trasladar', 'Trasladar equipos', 'Permite trasladar equipos entre bodegas'),
            ('asignaciones:devolver_sin_acta', 'Devolver sin acta', 'Permite devolver equipos sin generar acta firmada'),
            ('mantenimientos:read', 'Ver mantenimientos', 'Permite ver registros de mantenimiento'),
            ('mantenimientos:create', 'Crear mantenimientos', 'Permite registrar nuevos mantenimientos'),
            ('mantenimientos:update', 'Actualizar mantenimientos', 'Permite marcar como realizado y reprogramar la próxima fecha'),
            ('mantenimientos:write', 'Editar mantenimientos', 'Permite editar el contenido de mantenimientos registrados'),
            ('mantenimientos:delete', 'Eliminar mantenimientos', 'Permite eliminar registros de mantenimiento'),
            ('equipment_types:write', 'Gestionar tipos de equipo', 'Permite crear y editar tipos de equipo y su ficha técnica'),
            ('reports:export', 'Descargar reportes CSV', 'Permite descargar reportes en formato CSV (equipos, historial y actas)'),
            ('credenciales:read', 'Ver credenciales', 'Permite ver las credenciales almacenadas (equipos y cuentas)'),
            ('credenciales:write', 'Gestionar credenciales', 'Permite crear y editar credenciales'),
            ('credenciales:delete', 'Eliminar credenciales', 'Permite eliminar credenciales'),
            ('mantenimientos:approve', 'Aprobar OT', 'Permite aprobar o rechazar órdenes de trabajo completadas (supervisor)'),
            ('tickets:read', 'Ver tickets', 'Permite ver todos los tickets de soporte y los propios via Mi Agenda'),
            ('tickets:write', 'Gestionar tickets', 'Permite actualizar estado, asignar y comentar tickets'),
            ('wifi:write', 'Gestionar redes WiFi', 'Permite crear, editar y eliminar redes WiFi'),
            ('jornada:admin', 'Administrar Ubicaciones', 'Permite crear, editar y eliminar sedes del control de asistencia'),
            ('jornada:read', 'Ver asistencia', 'Permite consultar registros de jornada del personal'),
            ('integraciones:write', 'Ejecutar integraciones', 'Permite sincronizar datos desde sistemas externos'),
        ]

        existing_permissions = {p.code: p for p in db.query(Permission).all()}
        new_permission_codes = {code for code, _, _ in permissions if code not in existing_permissions}
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

        if 'reports:export' in new_permission_codes:
            supervisor_role = db.query(Role).filter(Role.name == 'SUPERVISOR TECNICO').first()
            reports_export_perm = db.query(Permission).filter(Permission.code == 'reports:export').first()
            if supervisor_role and reports_export_perm and reports_export_perm not in supervisor_role.permissions:
                supervisor_role.permissions.append(reports_export_perm)
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

        DEFAULT_FRECUENCIAS = {'Servidor': 3, 'Portátil': 6, 'Impresora': 6}
        DEFAULT_FRECUENCIA_FALLBACK = 12

        existing_tipos = {c.tipo_equipo for c in db.query(MantenimientoConfig).all()}
        for tipo_equipo in SPECS_BY_TIPO.keys():
            if tipo_equipo not in existing_tipos:
                db.add(MantenimientoConfig(
                    tipo_equipo=tipo_equipo,
                    frecuencia_meses=DEFAULT_FRECUENCIAS.get(tipo_equipo, DEFAULT_FRECUENCIA_FALLBACK),
                    descripcion=None,
                ))
        db.commit()

        TIPOS_PERIFERICO = {'Accesorio', 'Monitor', 'Audífonos', 'Cámara', 'Red', 'Otro'}

        if not db.query(EquipmentTipo).count():
            for orden, (tipo_nombre, fields) in enumerate(SPECS_BY_TIPO.items()):
                tipo = EquipmentTipo(
                    nombre=tipo_nombre,
                    es_periferico=tipo_nombre in TIPOS_PERIFERICO,
                    activo=True,
                    orden=orden,
                )
                tipo.specs = [
                    EquipmentTipoSpec(
                        key=f['key'], label=f['label'], field_type=f['type'],
                        options=f.get('options'), min_value=f.get('min'), max_value=f.get('max'),
                        placeholder=f.get('placeholder'), orden=spec_idx,
                    )
                    for spec_idx, f in enumerate(fields)
                ]
                db.add(tipo)
            db.commit()

        db.commit()
    finally:
        db.close()


@app.get('/health')
def health():
    return {'status': 'ok'}
