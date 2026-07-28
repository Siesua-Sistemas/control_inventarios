import calendar
import math
from collections import defaultdict
from datetime import date, datetime, timezone, timedelta
from pathlib import Path
from uuid import uuid4

from pydantic import field_validator

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_permissions
from app.models.bodega import Bodega
from app.models.empleado import Empleado
from app.models.jornada import RegistroJornada
from app.models.jornada_associations import empleado_sedes_jornada, sede_jornada_bodegas
from app.models.sede_jornada import SedeJornada

router = APIRouter(prefix='/api/v1/jornada', tags=['jornada'])

BOGOTA_OFFSET = timedelta(hours=-5)
JORNADAS_DIR = Path('storage/jornadas')
ALLOWED_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'}
MAX_IMAGE_SIZE = 8 * 1024 * 1024  # 8 MB


# ── Utilidades ────────────────────────────────────────────────────────────────

def _bogota_now() -> datetime:
    return datetime.now(timezone.utc).astimezone(timezone(BOGOTA_OFFSET)).replace(tzinfo=None)


def _today_range_utc():
    now_bog = _bogota_now()
    start_bog = now_bog.replace(hour=0, minute=0, second=0, microsecond=0)
    end_bog = start_bog + timedelta(days=1)
    start_utc = start_bog - BOGOTA_OFFSET
    end_utc = end_bog - BOGOTA_OFFSET
    return start_utc, end_utc


def _extract_ip(request: Request) -> str | None:
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.client.host if request.client else None


def _haversine_metros(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


async def _guardar_foto(foto: UploadFile | None, empleado_id: int) -> str | None:
    if not foto or not foto.filename:
        return None
    content_type = foto.content_type or ''
    if content_type not in ALLOWED_IMAGE_TYPES and not content_type.startswith('image/'):
        return None
    data = await foto.read()
    if not data or len(data) > MAX_IMAGE_SIZE:
        return None
    JORNADAS_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(foto.filename).suffix.lower() or '.jpg'
    fname = f'{empleado_id}_{uuid4().hex}{ext}'
    (JORNADAS_DIR / fname).write_bytes(data)
    return f'/storage/jornadas/{fname}'


def _ultimo_domingo_mes(year: int, month: int) -> date:
    """Retorna la fecha del último domingo del mes dado."""
    last_day = calendar.monthrange(year, month)[1]
    d = date(year, month, last_day)
    # weekday(): Lunes=0 … Domingo=6
    offset = (d.weekday() + 1) % 7  # días a retroceder para llegar al domingo
    return d - timedelta(days=offset)


def _almuerzo_minutos(fecha_dia: date, horario_config: dict | None) -> int:
    """
    Minutos de almuerzo a descontar del tiempo bruto según el tipo de horario de la sede.

    Turno único:
      Lun–Sáb → almuerzo_semana_min / almuerzo_sabado_min
      Dom     → almuerzo_domingo_min solo si es el último domingo del mes

    Doble turno:
      Lun–Vie → 0 (sin almuerzo)
      Sáb/Dom → almuerzo_sabado_min / almuerzo_domingo_min (cuando haya registro)
    """
    if not horario_config:
        return 0
    wd = fecha_dia.weekday()  # 0=Lun … 6=Dom
    if wd < 5:
        return int(horario_config.get('almuerzo_semana_min', 0))
    if wd == 5:
        return int(horario_config.get('almuerzo_sabado_min', 0))
    # Domingo
    regla = horario_config.get('domingo_regla', 'si_trabaja')
    if regla == 'ultimo_mes' and fecha_dia != _ultimo_domingo_mes(fecha_dia.year, fecha_dia.month):
        return 0  # domingo no programado para esta sede
    return int(horario_config.get('almuerzo_domingo_min', 0))


def _horarios_por_nombre(db: Session) -> dict[str, dict]:
    """Carga horario_config de todas las sedes activas, indexado por nombre."""
    return {
        s.nombre: (s.horario_config or {})
        for s in db.scalars(select(SedeJornada).where(SedeJornada.is_active.is_(True))).all()
    }


def _emp_sedes_ids(db: Session, empleado_id: int) -> list[int]:
    return list(db.scalars(
        select(empleado_sedes_jornada.c.sede_jornada_id)
        .where(empleado_sedes_jornada.c.empleado_id == empleado_id)
    ).all())


def _load_sedes(db: Session, sede_ids: list[int]) -> list[SedeJornada]:
    if not sede_ids:
        return []
    return list(db.scalars(
        select(SedeJornada).where(
            SedeJornada.id.in_(sede_ids),
            SedeJornada.is_active.is_(True),
        )
    ).all())




# ── Schemas ───────────────────────────────────────────────────────────────────

class RegistroJornadaOut(BaseModel):
    id: int
    tipo: str
    timestamp: datetime
    sede: str | None
    notas: str | None
    foto_url: str | None
    latitud: float | None
    longitud: float | None
    ip_publica: str | None
    dispositivo: str | None
    is_manual: bool = False

    @field_validator('timestamp', mode='before')
    @classmethod
    def mark_utc(cls, v: datetime) -> datetime:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    class Config:
        from_attributes = True


class SedeInfoOut(BaseModel):
    id: int
    nombre: str
    latitud: float
    longitud: float
    radio_metros: int
    tipo: str = 'empresa'

    class Config:
        from_attributes = True


class HoyResponse(BaseModel):
    empleado_id: int
    nombres: str
    apellidos: str
    sede: str | None
    cargo: str | None
    registros: list[RegistroJornadaOut]
    proximo: str  # 'entrada' | 'salida'
    sede_info: SedeInfoOut | None        # primera sede (compat)
    sedes_info: list[SedeInfoOut]        # sedes asignadas al empleado
    todas_sedes_info: list[SedeInfoOut]  # todas las sedes activas (para geovalla)
    ip_verificada: bool = False          # True si la IP del request coincide con una sede
    foto_requerida: bool = False         # True si este empleado es uno de los 2 del día


class DiaRegistros(BaseModel):
    fecha: str          # "2026-06-23"
    dia_semana: str     # "Lunes"
    es_hoy: bool
    registros: list[RegistroJornadaOut]
    tiempo_sede: str | None  # tiempo NETO (descontado almuerzo) o None si sin par
    almuerzo_min: int = 0   # minutos de almuerzo descontados (para info)


class SemanaResponse(BaseModel):
    dias: list[DiaRegistros]


class BodegaInfo(BaseModel):
    id: int
    nombre: str


class SedeJornadaOut(BaseModel):
    id: int
    nombre: str
    direccion: str | None
    ciudad: str | None
    latitud: float
    longitud: float
    radio_metros: int
    ip_autorizada: str | None
    tipo: str  # 'empresa' | 'home_office'
    is_active: bool
    bodegas: list[BodegaInfo] = []
    horario_config: dict | None = None


class SedeJornadaCreate(BaseModel):
    nombre: str
    direccion: str | None = None
    ciudad: str | None = None
    latitud: float
    longitud: float
    radio_metros: int = 100
    ip_autorizada: str | None = None
    tipo: str = 'empresa'
    bodega_ids: list[int] = []
    horario_config: dict | None = None


class SedeJornadaUpdate(BaseModel):
    nombre: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    latitud: float | None = None
    longitud: float | None = None
    radio_metros: int | None = None
    ip_autorizada: str | None = None
    tipo: str | None = None
    is_active: bool | None = None
    bodega_ids: list[int] | None = None
    horario_config: dict | None = None


class RegistroResumen(BaseModel):
    timestamp: datetime
    foto_url: str | None

    @field_validator('timestamp', mode='before')
    @classmethod
    def mark_utc(cls, v: datetime) -> datetime:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class EmpleadoAsistenciaOut(BaseModel):
    empleado_id: int
    nombres: str
    apellidos: str
    sede: str | None
    cargo: str | None
    estado: str  # 'presente' | 'completo' | 'ausente'
    entrada: RegistroResumen | None
    salida: RegistroResumen | None
    total_minutos: int | None


class AsistenciaResponse(BaseModel):
    fecha: str
    total_empleados: int
    presentes: int
    completos: int
    ausentes: int
    empleados: list[EmpleadoAsistenciaOut]


# ── Helpers de serialización ──────────────────────────────────────────────────

def _sede_to_out(sede: SedeJornada) -> SedeJornadaOut:
    return SedeJornadaOut(
        id=sede.id,
        nombre=sede.nombre,
        direccion=sede.direccion,
        ciudad=sede.ciudad,
        latitud=sede.latitud,
        longitud=sede.longitud,
        radio_metros=sede.radio_metros,
        ip_autorizada=sede.ip_autorizada,
        tipo=sede.tipo,
        is_active=sede.is_active,
        bodegas=[BodegaInfo(id=b.id, nombre=b.nombre) for b in (sede.bodegas or [])],
        horario_config=sede.horario_config,
    )


# ── Endpoints públicos ────────────────────────────────────────────────────────

@router.post('/registrar', response_model=RegistroJornadaOut, status_code=status.HTTP_201_CREATED)
async def registrar_jornada(
    request: Request,
    cedula: str = Form(...),
    tipo: str | None = Form(None),
    notas: str | None = Form(None),
    latitud: float | None = Form(None),
    longitud: float | None = Form(None),
    dispositivo: str | None = Form(None),
    foto: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    empleado = db.scalar(select(Empleado).where(Empleado.cedula == cedula.strip()))
    if not empleado or not empleado.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Empleado no encontrado o inactivo')

    ip_actual = _extract_ip(request)
    sedes_conf = _load_sedes(db, _emp_sedes_ids(db, empleado.id))

    # Todas las sedes activas: fallback cuando el empleado cubre otra sede sin asignación previa
    todas_sedes = list(db.scalars(select(SedeJornada).where(SedeJornada.is_active.is_(True))).all())

    # Determinar tipo PRIMERO para saber si aplicar restricción de geovalla
    start_utc, end_utc = _today_range_utc()
    ultimo = db.scalar(
        select(RegistroJornada)
        .where(
            RegistroJornada.empleado_id == empleado.id,
            RegistroJornada.timestamp >= start_utc,
            RegistroJornada.timestamp < end_utc,
        )
        .order_by(RegistroJornada.timestamp.desc())
        .limit(1)
    )
    tipo_final = tipo if tipo else ('salida' if (ultimo and ultimo.tipo == 'entrada') else 'entrada')

    def _detectar_sede(pool: list[SedeJornada]) -> SedeJornada | None:
        """Detecta sede por IP primero, luego por GPS. Sin bloqueo."""
        if ip_actual:
            for s in pool:
                if s.ip_autorizada and s.ip_autorizada == ip_actual:
                    return s
        if latitud is not None and longitud is not None:
            for s in pool:
                if _haversine_metros(latitud, longitud, s.latitud, s.longitud) <= s.radio_metros:
                    return s
        return None

    sede_detectada: SedeJornada | None = None

    if tipo_final == 'entrada':
        # 1. Buscar en sedes asignadas
        sede_detectada = _detectar_sede(sedes_conf)
        # 2. Si no encontró en las asignadas, buscar en TODAS las sedes activas
        #    (cubre el caso de empleado enviado a otra sede sin actualizar perfil)
        if sede_detectada is None:
            sede_detectada = _detectar_sede(todas_sedes)
        # 3. Bloquear si hay sedes configuradas y no se encontró coincidencia por IP ni GPS
        if sede_detectada is None and todas_sedes:
            if latitud is not None and longitud is not None:
                closest = min(todas_sedes, key=lambda s: _haversine_metros(latitud, longitud, s.latitud, s.longitud))
                dist = int(_haversine_metros(latitud, longitud, closest.latitud, closest.longitud))
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f'Estás fuera del rango de todas las sedes ({dist} m de "{closest.nombre}", máx {closest.radio_metros} m)',
                )
            # Sin IP autorizada y sin GPS: no hay forma de verificar la ubicación, bloquear
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail='No se pudo verificar tu ubicación. Activa el GPS en tu navegador e inténtalo de nuevo.',
            )
    else:
        # Salida: sin restricción, detectar sede para el registro (asignadas primero, luego todas)
        sede_detectada = _detectar_sede(sedes_conf) or _detectar_sede(todas_sedes)

    # Actualizar sede de bodega
    if tipo_final == 'entrada' and sede_detectada:
        db.execute(delete(empleado_sedes_jornada).where(empleado_sedes_jornada.c.empleado_id == empleado.id))
        db.execute(empleado_sedes_jornada.insert().values(empleado_id=empleado.id, sede_jornada_id=sede_detectada.id))
    elif tipo_final == 'salida':
        sede_principal: SedeJornada | None = None
        if empleado.sede:
            sede_principal = db.scalar(
                select(SedeJornada).where(SedeJornada.nombre == empleado.sede, SedeJornada.is_active.is_(True))
            )
        db.execute(delete(empleado_sedes_jornada).where(empleado_sedes_jornada.c.empleado_id == empleado.id))
        if sede_principal:
            db.execute(empleado_sedes_jornada.insert().values(empleado_id=empleado.id, sede_jornada_id=sede_principal.id))

    foto_url = await _guardar_foto(foto, empleado.id)

    if not foto_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='La foto es obligatoria para registrar la jornada. Asegúrate de que la cámara esté activa.',
        )

    registro = RegistroJornada(
        empleado_id=empleado.id,
        tipo=tipo_final,
        timestamp=datetime.now(timezone.utc),
        sede=sede_detectada.nombre if sede_detectada else empleado.sede,
        notas=notas,
        foto_url=foto_url,
        latitud=latitud,
        longitud=longitud,
        ip_publica=ip_actual,
        dispositivo=dispositivo,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return registro


@router.get('/hoy/{cedula}', response_model=HoyResponse)
def get_hoy(cedula: str, request: Request, db: Session = Depends(get_db)):
    empleado = db.scalar(select(Empleado).where(Empleado.cedula == cedula.strip()))
    if not empleado or not empleado.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Empleado no encontrado')

    start_utc, end_utc = _today_range_utc()
    registros = list(db.scalars(
        select(RegistroJornada)
        .where(
            RegistroJornada.empleado_id == empleado.id,
            RegistroJornada.timestamp >= start_utc,
            RegistroJornada.timestamp < end_utc,
        )
        .order_by(RegistroJornada.timestamp.asc())
    ).all())

    ultimo = registros[-1] if registros else None
    proximo = 'salida' if (ultimo and ultimo.tipo == 'entrada') else 'entrada'

    sedes = _load_sedes(db, _emp_sedes_ids(db, empleado.id))
    sedes_out = [SedeInfoOut.model_validate(s) for s in sedes]

    todas_sedes = list(db.scalars(
        select(SedeJornada).where(SedeJornada.is_active.is_(True))
    ).all())
    todas_sedes_out = [SedeInfoOut.model_validate(s) for s in todas_sedes]

    ip_actual = _extract_ip(request)
    ip_verificada = bool(ip_actual and any(
        s.ip_autorizada and s.ip_autorizada == ip_actual for s in todas_sedes
    ))

    return HoyResponse(
        empleado_id=empleado.id,
        nombres=empleado.nombres,
        apellidos=empleado.apellidos,
        sede=empleado.sede,
        cargo=empleado.cargo,
        registros=registros,
        proximo=proximo,
        sede_info=sedes_out[0] if sedes_out else None,
        sedes_info=sedes_out,
        todas_sedes_info=todas_sedes_out,
        ip_verificada=ip_verificada,
        foto_requerida=True,
    )


_DIAS_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
_BOGOTA = timezone(BOGOTA_OFFSET)


@router.get('/semana/{cedula}', response_model=SemanaResponse)
def get_semana(cedula: str, db: Session = Depends(get_db)):
    empleado = db.scalar(select(Empleado).where(Empleado.cedula == cedula.strip(), Empleado.is_active.is_(True)))
    if not empleado:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Empleado no encontrado')

    hoy_bog = _bogota_now().date()
    lunes = hoy_bog - timedelta(days=hoy_bog.weekday())

    # Rango UTC de toda la semana
    inicio_bog = datetime(lunes.year, lunes.month, lunes.day, 0, 0, 0)
    inicio_utc = inicio_bog - BOGOTA_OFFSET
    fin_utc = inicio_utc + timedelta(days=7)

    todos = list(db.scalars(
        select(RegistroJornada)
        .where(
            RegistroJornada.empleado_id == empleado.id,
            RegistroJornada.timestamp >= inicio_utc,
            RegistroJornada.timestamp < fin_utc,
        )
        .order_by(RegistroJornada.timestamp.asc())
    ).all())

    horarios = _horarios_por_nombre(db)

    dias: list[DiaRegistros] = []
    for i in range(7):
        fecha_dia = lunes + timedelta(days=i)
        regs = [
            r for r in todos
            if (r.timestamp + BOGOTA_OFFSET).date() == fecha_dia
        ]

        entradas_ord = sorted([r for r in regs if r.tipo == 'entrada'], key=lambda r: r.timestamp)
        salidas_ord  = sorted([r for r in regs if r.tipo == 'salida'],  key=lambda r: r.timestamp)
        pares = min(len(entradas_ord), len(salidas_ord))

        tiempo_sede = None
        almuerzo_min = 0
        if pares > 0:
            bruto_min = sum(
                max(0, int((salidas_ord[j].timestamp - entradas_ord[j].timestamp).total_seconds() // 60))
                for j in range(pares)
            )
            # Descuento de almuerzo según sede del primer registro del día
            sede_del_dia = regs[0].sede if regs else None
            horario_cfg = horarios.get(sede_del_dia) if sede_del_dia else None
            almuerzo_min = _almuerzo_minutos(fecha_dia, horario_cfg)
            neto_min = max(0, bruto_min - almuerzo_min)
            tiempo_sede = f"{neto_min // 60}h {neto_min % 60:02d}m"

        dias.append(DiaRegistros(
            fecha=fecha_dia.isoformat(),
            dia_semana=_DIAS_ES[i],
            es_hoy=(fecha_dia == hoy_bog),
            registros=[RegistroJornadaOut.model_validate(r) for r in regs],
            tiempo_sede=tiempo_sede,
            almuerzo_min=almuerzo_min,
        ))

    return SemanaResponse(dias=dias)


@router.get('/sedes', response_model=list[SedeJornadaOut])
def list_sedes(db: Session = Depends(get_db)):
    items = db.scalars(
        select(SedeJornada)
        .options(selectinload(SedeJornada.bodegas))
        .where(SedeJornada.is_active.is_(True))
        .order_by(SedeJornada.nombre)
    ).all()
    return [_sede_to_out(s) for s in items]


# ── Endpoints admin ───────────────────────────────────────────────────────────

class SalidaManualIn(BaseModel):
    empleado_id: int
    fecha: str   # "YYYY-MM-DD" en hora Bogotá
    hora: str    # "HH:MM" en hora Bogotá
    notas: str | None = None


@router.post('/admin/registros/salida-manual', response_model=RegistroJornadaOut, status_code=status.HTTP_201_CREATED)
def registrar_salida_manual(
    body: SalidaManualIn,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('jornada:admin')),
):
    from app.models.empleado import Empleado

    empleado = db.get(Empleado, body.empleado_id)
    if not empleado:
        raise HTTPException(status_code=404, detail='Empleado no encontrado')

    # Parsear fecha+hora en Bogotá y convertir a UTC
    try:
        ts_bog = datetime.strptime(f'{body.fecha} {body.hora}', '%Y-%m-%d %H:%M')
    except ValueError:
        raise HTTPException(status_code=400, detail='Formato de fecha u hora inválido')

    ts_utc = ts_bog - BOGOTA_OFFSET  # Bogotá = UTC-5, entonces +5 para UTC

    hoy_bog = _bogota_now().date()
    fecha_bog = ts_bog.date()

    if fecha_bog >= hoy_bog:
        raise HTTPException(status_code=400, detail='Solo se puede registrar salida manual en días anteriores al día de hoy')

    # Rango del día en UTC
    start_bog = datetime(fecha_bog.year, fecha_bog.month, fecha_bog.day)
    start_utc = start_bog - BOGOTA_OFFSET
    end_utc = start_utc + timedelta(days=1)

    regs_dia = list(db.scalars(
        select(RegistroJornada)
        .where(
            RegistroJornada.empleado_id == body.empleado_id,
            RegistroJornada.timestamp >= start_utc,
            RegistroJornada.timestamp < end_utc,
        )
        .order_by(RegistroJornada.timestamp)
    ).all())

    entradas = [r for r in regs_dia if r.tipo == 'entrada']
    salidas  = [r for r in regs_dia if r.tipo == 'salida']

    if not entradas:
        raise HTTPException(status_code=400, detail='No hay registro de entrada ese día para este empleado')

    if len(salidas) >= len(entradas):
        raise HTTPException(status_code=400, detail='El empleado ya tiene salida registrada para ese día')

    # La hora de salida debe ser posterior a la última entrada sin par
    ultima_entrada_sin_par = entradas[len(salidas)]
    if ts_utc <= ultima_entrada_sin_par.timestamp:
        raise HTTPException(status_code=400, detail='La hora de salida debe ser posterior a la hora de entrada')

    registro = RegistroJornada(
        empleado_id=body.empleado_id,
        tipo='salida',
        timestamp=ts_utc,
        sede=ultima_entrada_sin_par.sede,
        notas=body.notas or 'Salida registrada manualmente por administrador',
        foto_url=None,
        is_manual=True,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return registro

@router.post('/admin/sedes', response_model=SedeJornadaOut, status_code=status.HTTP_201_CREATED)
def create_sede(
    body: SedeJornadaCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('jornada:admin')),
):
    existe = db.scalar(select(SedeJornada).where(SedeJornada.nombre == body.nombre))
    if existe:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Ya existe una sede con ese nombre')

    sede = SedeJornada(**body.model_dump(exclude={'bodega_ids'}))
    db.add(sede)
    db.flush()

    if body.bodega_ids:
        bodegas = list(db.scalars(select(Bodega).where(Bodega.id.in_(body.bodega_ids[:2]))).all())
        sede.bodegas = bodegas

    db.commit()
    db.refresh(sede)
    _ = sede.bodegas  # trigger lazy load while session is open
    return _sede_to_out(sede)


@router.put('/admin/sedes/{sede_id}', response_model=SedeJornadaOut)
def update_sede(
    sede_id: int,
    body: SedeJornadaUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('jornada:admin')),
):
    sede = db.scalar(select(SedeJornada).where(SedeJornada.id == sede_id))
    if not sede:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Sede no encontrada')

    for field, value in body.model_dump(exclude_unset=True, exclude={'bodega_ids'}).items():
        setattr(sede, field, value)

    if body.bodega_ids is not None:
        bodegas = list(db.scalars(select(Bodega).where(Bodega.id.in_(body.bodega_ids[:2]))).all())
        sede.bodegas = bodegas

    db.add(sede)
    db.commit()
    db.refresh(sede)
    _ = sede.bodegas
    return _sede_to_out(sede)


@router.delete('/admin/sedes/{sede_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_sede(
    sede_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('jornada:admin')),
):
    sede = db.scalar(select(SedeJornada).where(SedeJornada.id == sede_id))
    if not sede:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Sede no encontrada')
    sede.is_active = False
    db.add(sede)
    db.commit()


# ── Endpoints de supervisión ──────────────────────────────────────────────────

@router.get('/asistencia', response_model=AsistenciaResponse)
def get_asistencia(
    fecha: date | None = Query(None),
    sede: str | None = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('jornada:read')),
):
    if fecha is None:
        fecha = _bogota_now().date()

    start_utc = datetime.combine(fecha, datetime.min.time()) - BOGOTA_OFFSET
    end_utc = start_utc + timedelta(days=1)

    emp_q = select(Empleado).where(
        Empleado.is_active.is_(True),
        Empleado.en_jornada.is_(True),
    )
    if sede:
        # Filtra por employees que tienen esa sede en la junction table
        sede_jornada = db.scalar(select(SedeJornada).where(SedeJornada.nombre == sede, SedeJornada.is_active.is_(True)))
        if sede_jornada:
            emp_q = emp_q.where(
                Empleado.id.in_(
                    select(empleado_sedes_jornada.c.empleado_id)
                    .where(empleado_sedes_jornada.c.sede_jornada_id == sede_jornada.id)
                )
            )
        else:
            emp_q = emp_q.where(False)

    emp_q = emp_q.order_by(Empleado.apellidos, Empleado.nombres)
    empleados = list(db.scalars(emp_q).all())
    emp_ids = [e.id for e in empleados]

    records: list[RegistroJornada] = []
    if emp_ids:
        records = list(db.scalars(
            select(RegistroJornada)
            .where(
                RegistroJornada.empleado_id.in_(emp_ids),
                RegistroJornada.timestamp >= start_utc,
                RegistroJornada.timestamp < end_utc,
            )
            .order_by(RegistroJornada.empleado_id, RegistroJornada.timestamp.asc())
        ).all())

    records_by_emp: dict[int, list[RegistroJornada]] = defaultdict(list)
    for r in records:
        records_by_emp[r.empleado_id].append(r)

    horarios_dia = _horarios_por_nombre(db)
    empleados_out: list[EmpleadoAsistenciaOut] = []
    presentes = 0
    completos = 0

    for emp in empleados:
        emp_records = records_by_emp.get(emp.id, [])

        if not emp_records:
            empleados_out.append(EmpleadoAsistenciaOut(
                empleado_id=emp.id, nombres=emp.nombres, apellidos=emp.apellidos,
                sede=emp.sede, cargo=emp.cargo, estado='ausente',
                entrada=None, salida=None, total_minutos=None,
            ))
            continue

        entradas = [r for r in emp_records if r.tipo == 'entrada']
        salidas  = [r for r in emp_records if r.tipo == 'salida']
        primer_entrada = entradas[0] if entradas else None
        ultima_salida  = salidas[-1] if salidas else None

        # El estado se determina por el tipo del registro más reciente,
        # no por si existe alguna salida (soporta múltiples ciclos entrada/salida en el día)
        ultimo_registro = emp_records[-1]  # ya ordenados por timestamp asc
        if ultimo_registro.tipo == 'salida':
            estado = 'completo'
            completos += 1
        else:
            estado = 'presente'
            presentes += 1

        total_min: int | None = None
        if primer_entrada and ultima_salida:
            bruto = int((ultima_salida.timestamp - primer_entrada.timestamp).total_seconds() / 60)
            sede_nombre = primer_entrada.sede
            horario_cfg = horarios_dia.get(sede_nombre) if sede_nombre else None
            almuerzo = _almuerzo_minutos(fecha, horario_cfg)
            total_min = max(0, bruto - almuerzo)

        empleados_out.append(EmpleadoAsistenciaOut(
            empleado_id=emp.id, nombres=emp.nombres, apellidos=emp.apellidos,
            sede=emp.sede, cargo=emp.cargo, estado=estado,
            entrada=RegistroResumen(timestamp=primer_entrada.timestamp, foto_url=primer_entrada.foto_url) if primer_entrada else None,
            salida=RegistroResumen(timestamp=ultima_salida.timestamp, foto_url=ultima_salida.foto_url) if ultima_salida else None,
            total_minutos=total_min,
        ))

    return AsistenciaResponse(
        fecha=fecha.isoformat(),
        total_empleados=len(empleados),
        presentes=presentes,
        completos=completos,
        ausentes=len(empleados) - presentes - completos,
        empleados=empleados_out,
    )


# ── Reporte semanal ───────────────────────────────────────────────────────────

class EmpleadoSemanaOut(BaseModel):
    empleado_id: int
    nombres: str
    apellidos: str
    cargo: str | None
    sede: str | None
    dias: list[DiaRegistros]
    dias_asistidos: int    # días con entrada + salida
    dias_incompletos: int  # días con solo entrada
    total_minutos: int


class ReporteSemanalOut(BaseModel):
    semana_inicio: str   # "2026-06-23" (lunes)
    semana_fin: str      # "2026-06-29" (domingo)
    empleados: list[EmpleadoSemanaOut]


@router.get('/admin/reporte-semanal', response_model=ReporteSemanalOut)
def reporte_semanal(
    fecha: str | None = Query(None, description='Cualquier fecha de la semana (YYYY-MM-DD)'),
    sede_id: int | None = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('jornada:read')),
):
    if fecha:
        try:
            ref = date.fromisoformat(fecha)
        except ValueError:
            ref = _bogota_now().date()
    else:
        ref = _bogota_now().date()

    lunes = ref - timedelta(days=ref.weekday())
    domingo = lunes + timedelta(days=6)

    # Resolver nombre de sede para filtrar por registro.sede
    sede_nombre_filter: str | None = None
    if sede_id:
        sede_obj = db.scalar(select(SedeJornada).where(SedeJornada.id == sede_id))
        if sede_obj:
            sede_nombre_filter = sede_obj.nombre

    empleados = list(db.scalars(
        select(Empleado)
        .where(Empleado.en_jornada.is_(True), Empleado.is_active.is_(True))
        .order_by(Empleado.apellidos, Empleado.nombres)
    ).all())

    if not empleados:
        return ReporteSemanalOut(
            semana_inicio=lunes.isoformat(),
            semana_fin=domingo.isoformat(),
            empleados=[],
        )

    emp_ids = [e.id for e in empleados]
    inicio_utc = datetime(lunes.year, lunes.month, lunes.day) - BOGOTA_OFFSET
    fin_utc = inicio_utc + timedelta(days=7)

    todos = list(db.scalars(
        select(RegistroJornada)
        .where(
            RegistroJornada.empleado_id.in_(emp_ids),
            RegistroJornada.timestamp >= inicio_utc,
            RegistroJornada.timestamp < fin_utc,
        )
        .order_by(RegistroJornada.timestamp.asc())
    ).all())

    # Filtrar empleados que tengan al menos un registro en la sede pedida
    if sede_nombre_filter:
        ids_con_sede = {r.empleado_id for r in todos if r.sede == sede_nombre_filter}
        empleados = [e for e in empleados if e.id in ids_con_sede]
        if not empleados:
            return ReporteSemanalOut(
                semana_inicio=lunes.isoformat(),
                semana_fin=domingo.isoformat(),
                empleados=[],
            )

    by_emp: dict[int, list] = defaultdict(list)
    for r in todos:
        by_emp[r.empleado_id].append(r)

    hoy = _bogota_now().date()
    horarios = _horarios_por_nombre(db)
    resultado: list[EmpleadoSemanaOut] = []

    for emp in empleados:
        emp_regs = by_emp.get(emp.id, [])
        dias: list[DiaRegistros] = []
        total_min = 0
        dias_asistidos = 0
        dias_incompletos = 0

        for i in range(7):
            fecha_dia = lunes + timedelta(days=i)
            regs_dia = [r for r in emp_regs if (r.timestamp + BOGOTA_OFFSET).date() == fecha_dia]

            # Si hay filtro de sede, solo contar tiempo y mostrar registros de esa sede
            regs = [r for r in regs_dia if r.sede == sede_nombre_filter] if sede_nombre_filter else regs_dia

            entradas_ord = sorted([r for r in regs if r.tipo == 'entrada'], key=lambda r: r.timestamp)
            salidas_ord  = sorted([r for r in regs if r.tipo == 'salida'],  key=lambda r: r.timestamp)

            # Sumar todos los pares entrada→salida cronológicos
            pares = min(len(entradas_ord), len(salidas_ord))
            bruto_min = sum(
                max(0, int((salidas_ord[j].timestamp - entradas_ord[j].timestamp).total_seconds() // 60))
                for j in range(pares)
            )

            tiempo_sede = None
            almuerzo_min = 0
            if pares > 0:
                # Descuento de almuerzo según sede del primer registro del día
                sede_del_dia = regs[0].sede if regs else None
                horario_cfg = horarios.get(sede_del_dia) if sede_del_dia else None
                almuerzo_min = _almuerzo_minutos(fecha_dia, horario_cfg)
                dia_min = max(0, bruto_min - almuerzo_min)
                tiempo_sede = f"{dia_min // 60}h {dia_min % 60:02d}m"
                total_min += dia_min
                dias_asistidos += 1
            elif entradas_ord:
                dias_incompletos += 1

            dias.append(DiaRegistros(
                fecha=fecha_dia.isoformat(),
                dia_semana=_DIAS_ES[i],
                es_hoy=(fecha_dia == hoy),
                registros=[RegistroJornadaOut.model_validate(r) for r in regs],
                tiempo_sede=tiempo_sede,
                almuerzo_min=almuerzo_min,
            ))

        resultado.append(EmpleadoSemanaOut(
            empleado_id=emp.id,
            nombres=emp.nombres,
            apellidos=emp.apellidos,
            cargo=emp.cargo,
            sede=emp.sede,
            dias=dias,
            dias_asistidos=dias_asistidos,
            dias_incompletos=dias_incompletos,
            total_minutos=total_min,
        ))

    return ReporteSemanalOut(
        semana_inicio=lunes.isoformat(),
        semana_fin=domingo.isoformat(),
        empleados=resultado,
    )


@router.get('/empleado/{empleado_id}/registros', response_model=list[RegistroJornadaOut])
def get_registros_empleado(
    empleado_id: int,
    fecha: date | None = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_permissions('jornada:read')),
):
    if fecha is None:
        fecha = _bogota_now().date()

    start_utc = datetime.combine(fecha, datetime.min.time()) - BOGOTA_OFFSET
    end_utc = start_utc + timedelta(days=1)

    return list(db.scalars(
        select(RegistroJornada)
        .where(
            RegistroJornada.empleado_id == empleado_id,
            RegistroJornada.timestamp >= start_utc,
            RegistroJornada.timestamp < end_utc,
        )
        .order_by(RegistroJornada.timestamp.asc())
    ).all())


