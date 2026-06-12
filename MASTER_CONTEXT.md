# MASTER_CONTEXT

## 1. Propósito del sistema

El sistema debe funcionar como una plataforma empresarial interna para la gestión de inventarios, activos tecnológicos y operaciones de soporte, con foco en:

- Control de equipos y activos
- Trazabilidad completa de movimientos
- Mantenimientos preventivos y correctivos
- Asignación de equipos a empleados
- Gestión por sedes
- Bodega y stock
- Entregas, devoluciones y actas
- Auditoría y reportes
- Gestión de usuarios, roles y permisos
- Alertas y notificaciones
- Documentación y evidencias
- Dashboard gerencial

## 2. Arquitectura recomendada

### Stack oficial

- Frontend: Next.js, React, TypeScript, TailwindCSS, Shadcn/UI
- Backend: FastAPI, SQLAlchemy 2, Alembic, Pydantic
- Base de datos: PostgreSQL
- Infraestructura: Docker, Docker Compose, Nginx, Redis

### Separación obligatoria

- Frontend y backend desacoplados
- FastAPI como API REST exclusiva
- Next.js como cliente web exclusivo
- PostgreSQL como motor principal
- Archivos y evidencias fuera del contenedor, en /storage

### Infraestructura esperada

- Nginx como reverse proxy
- Redis para cache, colas y sesiones
- Docker Compose para orquestación
- Volúmenes persistentes para PostgreSQL y storage

## 3. Alcance funcional por módulos

### 3.1 Inventario General

Este es el núcleo del sistema.

#### Objetivo

Administrar la hoja de vida completa de cada equipo y activo tecnológico.

#### Datos obligatorios por equipo

- Código interno automático
- Tipo de equipo
- Marca
- Modelo
- Serial
- IMEI (si aplica)
- Placa interna
- Código QR
- Estado actual

#### Clasificación

- Portátiles
- Celulares
- Tablets
- Cámaras
- Audífonos
- Monitores
- Impresoras
- Redes
- Accesorios

#### Información financiera

- Fecha de compra
- Valor
- Proveedor
- Factura
- Garantía
- Fecha de vencimiento de garantía

#### Estado operativo

- Disponible
- Asignado
- En mantenimiento
- Dañado
- Prestado
- En bodega
- Perdido
- Dado de baja

#### Ubicación

- Sede
- Área
- Responsable
- Oficina/Bodega
- Puesto físico

#### Reglas funcionales

- Cada equipo debe tener una hoja de vida trazable
- Debe existir soporte para QR
- Debe permitir adjuntar documentos y evidencias
- Debe conservar historial completo de cambios, asignaciones y mantenimiento

### 3.2 Control por Sedes

#### Objetivo

Gestionar inventario y operaciones por sede, con visibilidad centralizada para 10 sedes o más.

#### Funcionalidades obligatorias

- Ver inventario por sede
- Contar equipos activos por sede
- Identificar equipos faltantes
- Identificar equipos dañados
- Identificar equipos sin mantenimiento
- Gestionar traslados entre sedes

#### Vista recomendada

- Tabla resumen por sede y categoría
- Totales por tipo de equipo
- Indicadores de riesgo por sede

### 3.3 Asignación a Empleados

#### Objetivo

Gestionar la entrega, uso, devolución y trazabilidad de equipos asignados a personas.

#### Información requerida

- Equipo entregado
- Empleado responsable
- Cargo
- Fecha de entrega
- Fecha de devolución
- Estado de entrega
- Observaciones

#### Reglas funcionales

- Historial completo de asignaciones
- Auditoría del ciclo completo del activo
- Posibilidad de ver la secuencia de responsables y estados
- Firma digital en entrega, recibido y devolución
- Generación automática de actas PDF

#### Flujo ideal

1. Escaneo de QR
2. Selección del empleado
3. Firma del responsable
4. Generación automática de acta

### 3.4 Mantenimientos

#### Objetivo

Manejar mantenimiento preventivo y correctivo con control de costos y alertas.

#### Tipos

- Preventivo
- Correctivo

#### Datos del mantenimiento

- Equipo
- Fecha
- Tipo
- Técnico
- Observaciones
- Costo
- Evidencias
- Próximo mantenimiento

#### Alertas automáticas

- Mantenimiento vencido
- Garantía próxima a vencer
- Falla recurrente
- Equipo en estado crítico

### 3.5 Movimientos y Trazabilidad

#### Objetivo

Registrar todo cambio sobre los equipos y activos para auditoría, control y análisis.

#### Acciones que deben registrarse

- Cambios
- Traslados
- Modificaciones
- Bajas
- Asignaciones
- Devoluciones
- Mantenimientos
- Estados críticos

#### Reglas funcionales

- Registro inmutable de eventos
- Relación con usuario y sesión
- Trazabilidad por fecha, IP y entidad modificada

### 3.6 Entregas y Actas

#### Objetivo

Facilitar entregas rápidas y operar el inventario con flujos simples.

#### Funcionalidades

- Entrega rápida
- Recepción de devolución
- Actas de entrega, devolución y traslado
- Firma y documentos adjuntos

#### Rol recomendado

- Usuario encargado de sede

#### Permisos del encargado de sede

Permitido:
- Entregar equipos
- Recibir devoluciones
- Consultar inventario de su sede

No permitido:
- Borrar equipos
- Modificar seriales
- Eliminar historial

### 3.7 Usuarios y Roles

#### Roles sugeridos

- SUPER_ADMIN
- IT_ADMIN
- ADMINISTRATIVE
- BRANCH_MANAGER
- AUDITOR

#### Reglas funcionales

- Autenticación con JWT
- Refresh tokens
- RBAC estricto
- Validación de permisos por sede y módulo
- Registro de acceso y actividad

### 3.8 Alertas y Notificaciones

#### Objetivo

Notificar eventos críticos y operativos.

#### Alertas recomendadas

- Mantenimiento vencido
- Devolución pendiente
- Garantía próxima a vencer
- Equipo dañado
- Equipo sin responsable
- Stock bajo

#### Canales

- Correo
- WhatsApp
- Dashboard interno

### 3.9 Reportes y Auditoría

#### Objetivo

Exportar información operativa y de auditoría para decisiones gerenciales y cumplimiento.

#### Reportes obligatorios

- Inventario por sede
- Equipos por empleado
- Equipos dañados
- Historial de movimientos
- Equipos sin mantenimiento
- Garantías próximas a vencer
- Equipos dados de baja

#### Exportaciones

- Excel
- PDF

#### Auditoría

- Quién modificó qué
- Fecha y hora
- IP
- Cambios realizados
- Entidad afectada

### 3.10 Bodega y Stock

#### Objetivo

Controlar inventario en bodega, entradas, salidas y alertas de stock mínimo.

#### Reglas funcionales

- Separar activos fijos de consumibles
- Controlar entradas y salidas
- Reportar stock disponible
- Generar alertas de inventario bajo

#### Ejemplos

- 3 portátiles disponibles
- 5 cargadores disponibles
- 8 mouse disponibles
- 2 celulares reserva

### 3.11 Documentación y Evidencias

#### Objetivo

Adjuntar información documental para soporte, garantía, diagnóstico y evidencia legal.

#### Tipos permitidos

- Factura
- Garantía
- Fotos
- Actas
- Diagnósticos
- Evidencias de daño
- Informes de mantenimiento

#### Reglas funcionales

- Almacenamiento centralizado en /storage
- Altas y bajas controladas
- Asociación a equipos, movimientos o mantenimientos

### 3.12 Dashboard Gerencial

#### Objetivo

Mostrar indicadores clave para la administración.

#### Indicadores recomendados

#### Operación

- Total activos
- Equipos por sede
- Equipos dañados
- Equipos sin usar

#### Mantenimiento

- Mantenimientos pendientes
- Costos mensuales
- Fallas recurrentes

#### Auditoría

- Pérdidas
- Equipos sin responsable
- Equipos vencidos

## 4. Entidades principales

- Sedes
- Usuarios
- Empleados
- Equipos
- Categorías
- Movimientos
- Mantenimientos
- Actas
- Proveedores
- Garantías
- Bodegas
- Auditorías
- Documentos
- Alertas
- Tickets IT
- Reservas de equipos
- Licencias

## 5. Reglas operativas clave

- No mezclar activos fijos con consumibles
- Separar claramente activos y consumibles
- Utilizar QR en cada equipo
- Registrar todo evento relevante
- Soportar firma digital
- Generar actas automáticas
- Preparar el sistema para escalamiento futuro
- Mantener auditoría completa de acciones sensibles

## 6. Fases de implementación recomendadas

### Fase 1

- Inventario
- Sedes
- Asignaciones
- QR
- Actas
- Mantenimientos

### Fase 2

- Tickets IT
- Dashboard
- Alertas
- Firma digital
- Auditoría avanzada

### Fase 3

- App móvil
- Escaneo masivo QR
- Integración RRHH
- Automatizaciones por WhatsApp y correo

## 7. Funcionalidades avanzadas que valen la pena

- Checklist de entrega
- Fotografías antes y después
- Reserva de equipos
- Control de licencias Y CLAVES 
- Escaneo masivo QR
- Integración con personal y RRHH
- Notificaciones automáticas por correo y WhatsApp

## 8. Recomendación de almacenamiento

Separar datos y archivos físicos:

- Base de datos: /data/postgres
- Archivos: /data/storage

## 9. Criterios de éxito del proyecto

El sistema será exitoso si:

- Tiene trazabilidad total
- Permite operar por sede de forma independiente
- Genera actas y firma digital sin fricción
- Mantiene auditoría completa
- Ofrece dashboard gerencial útil
- Escala sin perder claridad operativa
- Mantiene seguridad, permisos y control de acceso

## 10. Resumen operativo

El sistema debe convertirse en una plataforma interna de gestión completa, moderna y escalable, capaz de cubrir inventario, asignaciones, mantenimiento, trazabilidad, actas, reportes, auditoría, bodega, documentación y analítica gerencial, con un modelo de permisos sólido y una experiencia operativa rápida para usuarios de sede y administración.

## 11. Registro de avances (Changelog)

> Esta sección documenta lo que **ya está implementado** en el código (a diferencia de las secciones anteriores, que describen el alcance recomendado/objetivo). Se actualiza por sesión de trabajo para que cualquier sesión futura entienda el estado real del proyecto sin tener que leer todo el historial de git.

### 2026-06-02 — Base del sistema de inventario (commit `273e2df`)

- Modelos, repositorios, routers y schemas base para: Equipos, Empleados, Bodegas, Asignaciones, Actas de entrega, Mantenimientos.
- Configuración de despliegue para VPS Hostinger (Docker, docker-compose, variables `NEXT_PUBLIC_API_URL`, devcontainer).
- 

### 2026-06-11 — Hojas de vida, periféricos y mejoras de Asignaciones (sesión actual, pendiente de commit/build)

**Hoja de vida del equipo (`/equipos/[id]/hoja-de-vida`)**
- Página nueva con 4 pestañas: **Ficha técnica**, **Periféricos**, **Fotos**, **Mantenimiento**.
- Backend: nueva columna `equipment.specs` (JSON) para especificaciones dinámicas por tipo de equipo, renderizadas en la pestaña "Ficha técnica" según `specs_template` (campos texto/número/select/booleano/escala).
- Backend: nueva columna `equipment.parent_equipment_id` (FK auto-referencial) para modelar relaciones equipo principal ↔ periféricos (ej. portátil ↔ mouse, cargador, monitor).
- Endpoint `PATCH /api/v1/equipos/{id}/parent` (recibe `parent_id` como **query param**, no body).
- Subida/borrado de fotos del equipo: `UploadFile` + montaje de `StaticFiles` en `/storage/equipment_photos`.
- Pestaña **Periféricos**: permite vincular/desvincular equipos existentes como periféricos, y crear periféricos nuevos al vuelo con dos modales rápidos:
  - **"+ Nuevo periférico"**: tipo (Accesorio/Monitor/Audífonos/Cámara/Red/Otro), serial, marca, modelo. Hereda sede/bodega/ubicación del equipo padre y queda en estado "En bodega".
  - **"⚡ Nuevo cargador"**: solo pide marca y potencia (W); genera serial `CARG-<timestamp>`, modelo `Cargador {W}W` y guarda `specs.potencia_w`.
- Pestaña **Mantenimiento**: CRUD completo (alta, edición, borrado) con formulario inline; nuevo router `mantenimientos` registrado en `main.py` con permisos `mantenimientos:read` / `mantenimientos:write`.

**Cascada de periféricos en Asignaciones**
- Al **entregar** un equipo, todos sus periféricos (`parent_equipment_id`) que estén en estado entregable (`Disponible`/`En bodega`) pasan automáticamente a `Asignado` con el mismo empleado, generando su propio registro de auditoría (`Asignacion` con observación "Periférico de {código}").
- Al **devolver** un equipo, sus periféricos en estado devolvible se devuelven igual (mismo estado destino y bodega).
- Antes de este cambio los periféricos quedaban "huérfanos" (seguían como Asignados a un empleado que ya no tenía el equipo).

**Entrega múltiple ("carrito") en Asignaciones**
- Nuevo endpoint `POST /api/v1/asignaciones/entregar-multiple` (`entregar_multiple` en el service, recorre `entregar()` por cada equipo para reutilizar toda la lógica/cascada existente).
- Frontend: pestaña de entrega rediseñada como carrito — buscador de equipos (`equiposEntregables` = unión de `Disponible` + `En bodega`, antes solo se buscaba en `Disponible`, lo que rompía la búsqueda), selección de empleado/bodega/observaciones, y entrega de todos los ítems del carrito en una sola operación.
- Tras entregar, redirige automáticamente a la vista previa del acta (`/asignaciones/acta?emp=...&eqs=...`).

**Actas: vista previa e impresión**
- Nueva página `/asignaciones/acta` (vista previa, no imprimible): agrupa el equipo principal y sus periféricos (con prefijo `└` y fondo distinto), datos del empleado, badges de estado.
- Nueva página `/asignaciones/[equipment_id]/imprimir` (formato imprimible, fondo blanco): encabezado, datos del empleado, tabla de equipos (principal + periféricos aplanados), observaciones y líneas de firma. Usa `window.print()` para generar PDF.
- Botones "Vista previa" e "🖨 Imprimir" agregados a la pestaña "Activas" de Asignaciones.
- Paleta de colores de los botones de Asignaciones corregida (texto ilegible en blanco → `bg-blue-400 text-slate-950 font-semibold` para entrega, esmeralda para devolución, violeta para traslado).

**Bug fixes de esta sesión**
- `setEquipmentParent` daba 422: el backend espera `parent_id` como query param, no en el body — corregido en `frontend/src/lib/api.ts`.
- "Devolución" seguía apareciendo en "Activas": `get_activas()` comparaba el estado histórico/inmutable de la `Asignacion` (`estado_despues == 'Asignado'`) en vez del estado **actual** del equipo. Corregido con un JOIN contra `Equipment.estado` (`Asignado`/`Prestado` + `is_active`).
- Buscador de "Equipos a entregar" no mostraba resultados: solo se cargaban equipos en estado `Disponible`, pero `ESTADOS_ENTREGABLES` también incluye `En bodega`. Corregido cargando ambos estados.
- Error de build `Cannot find name 'setEquiposDisp'`: referencia residual tras renombrar `equiposDisp` → `equiposEntregables`; eliminada.
- `tsconfig.json`: eliminado `baseUrl: "."` (deprecado), se mantiene `paths` con `@/*`.
- `EquipmentPayload` ahora incluye `specs` y `parent_equipment_id` en los formularios de "nuevo equipo" y "editar equipo".

**Pendiente / por revisar en próxima sesión**
- El botón "Iniciar Entrega →" agregado en `/asignaciones/acta/page.tsx` apunta a la ruta `/asignaciones/entrega?emp=...&eqs=...`, **que todavía no existe** — falta crearla o decidir si se reutiliza otra vista.
- Reconstruir contenedores Docker (backend + frontend) para aplicar las migraciones de `specs`/`parent_equipment_id` y los cambios de `main.py`/StaticFiles en el entorno desplegado.
- Falta hacer commit de todos los cambios de esta sesión (modelos, routers, frontend de hoja de vida, asignaciones, actas).

### 2026-06-11 (cont.) — Inventario de bodegas completo, datos demo adicionales y tablas ordenables

**Fix: inventario de bodega no mostraba todos los equipos de la sede**
- `bodega_repository.py`: `count_equipos()` y `get_equipos()` ahora filtran por `Equipment.sede == bodega.sede` (en vez de `bodega_id`), ya que los equipos `Asignado`/`Prestado` tienen `bodega_id = NULL` y antes quedaban excluidos. Ahora el inventario de bodega refleja **todos** los elementos de la sede (en bodega + asignados a empleados).
- Nuevo computed property `Equipment.empleado_nombre` (modelo `equipment.py`, schema `EquipmentOut`, tipo `EquipmentRow` en `frontend/src/lib/api.ts`) — nombre completo del empleado actualmente asignado, o `null`.
- `/bodegas/[id]/inventario`: nueva columna **"Ubicación física"** (antes "Asignado a / Ubicación") — muestra `empleado_nombre` si el equipo está asignado, o "En bodega"/`ubicacion` en caso contrario.
- Verificado end-to-end vía API (`entregar` → `devolver`): tras una entrega, la columna refleja inmediatamente al último empleado asignado (sin necesidad de cambios adicionales, la lógica ya propagaba `empleado_id` correctamente).

**Datos demo adicionales (scripts idempotentes en `backend/app/scripts/`)**
- `seed_home_office_accesorios.py`: agrega cargador + mouse a cada uno de los 6 portátiles de "HOME OFFICE", y monitor para cargos en `CARGOS_CON_MONITOR` (Contador/a, Desarrollador/a de Software, Gerente Administrativo). Total: 15 equipos + 15 asignaciones.
- `seed_camaras_seguridad.py`: agrega cámaras CCTV (`tipo='Cámara'`, serial `CAM...`) — 3 para sedes de alto volumen (CENTRO MAYOR, UNICENTRO), 1 para el resto. Total: 11 equipos + 11 asignaciones.
- Nueva bodega **"HOME OFFICE"** (id=10, sede="HOME OFFICE") creada manualmente vía SQL para agrupar el inventario de teletrabajo (23 equipos).

**UI: lightbox de fotos y tablas ordenables**
- `EquipoModal`: la foto del equipo ahora es clickeable (`cursor-zoom-in`) y abre un lightbox a pantalla completa; Escape cierra primero el lightbox y luego el modal.
- `/bodegas/[id]/inventario/acta`: el código de cada equipo ahora abre `EquipoModal` al hacer clic.
- Encabezados de columna ordenables (▲/▼/⇅, clic para alternar asc/desc) agregados a:
  - `/bodegas/[id]/inventario` — Código, Serial, Tipo, Marca/Modelo, Ubicación física, Estado.
  - `/equipos` — Código, Serial, Tipo, Marca/Modelo, Sede, Estado.
  - `/historial` — ambas pestañas: **Movimientos** (Fecha, Tipo, Equipo, Empleado/Destino, Estado, Registrado por) y **Actas firmadas** (Fecha, Tipo, Sede, Entrega, Recibe, Dispositivos, Firmas), usando helpers compartidos `compareValues()` y `SortableTh()` definidos en `historial/page.tsx`.
