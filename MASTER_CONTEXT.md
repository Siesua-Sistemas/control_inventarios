# MASTER_CONTEXT

## 1. Propósito del sistema

El sistema debe funcionar como un **CMMS (Sistema de Gestión de Mantenimiento Computarizado)** de uso empresarial interno, orientado a activos tecnológicos y biomédicos, que sirva como escudo ante auditorías y como motor de eficiencia operativa. Sus pilares son:

- Hoja de vida digital completa de cada activo
- Órdenes de Trabajo (OT) con flujo completo (programado → en proceso → aprobado)
- Trazabilidad inmutable de todos los eventos (audit trail)
- Calendario inteligente con alertas y auto-programación
- Control de cumplimiento para auditorías (certificados, firmas, checklists)
- Gestión por sedes, roles diferenciados (técnico / supervisor / admin)
- Inventario, asignaciones, bodegas y actas de entrega
- **Arquitectura 3 aplicaciones**: IT · Bioingeniería · Portal Admin (ver sección 3)

---

## 2. Arquitectura

### Stack oficial

- **Frontend**: Next.js 14.2 · React · TypeScript · TailwindCSS
- **Backend**: FastAPI · SQLAlchemy 2 · Pydantic · PostgreSQL
- **Infra**: Docker Compose · Nginx (reverse proxy) · Redis

### Contenedores activos (App IT — actual)

| Contenedor | Puerto |
|---|---|
| `inventario-backend` | 8000 |
| `inventario-frontend` | 3000 |
| `inventario-postgres` | 5432 |
| `inventario-redis` | 6379 |

### Convenciones clave

- Migraciones vía `_run_migrations()` en `main.py` — `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (idempotente, sin Alembic).
- Archivos estáticos (fotos, actas, PDFs) en `/storage` montado como volumen.
- Autenticación JWT; permisos RBAC via `require_permissions()` / `require_any_permission()`.

---

## 3. Arquitectura de 3 Aplicaciones (decisión 2026-06-24)

El enfoque original de un único sistema multi-dominio fue descartado. La solución definitiva es **3 aplicaciones independientes**:

| App | Puerto Backend | Puerto Frontend | Base de datos | Estado |
|---|---|---|---|---|
| **App IT** | 8001 | 3001 | `inv_it` | ✅ En producción |
| **App Bioingeniería** | 8002 | 3002 | `inv_bio` | 🔶 Pendiente (clonar de IT) |
| **Portal Admin** | — | 3000 | — | 🔶 Pendiente (launcher unificado) |

### Principios

- Cada app tiene su propio frontend + backend + base de datos. **No comparten tablas.**
- No existe campo `dominio_operativo` en ninguna tabla. Cada app es su propio universo.
- El Portal Admin es una interfaz liviana (sin backend propio) que lanza a las 2 apps.
- Bio se construye clonando IT y adaptando: tipos de equipo, colores (violeta), branding.

---

## 4. Alcance funcional — módulos y estado

### 4.1 Inventario de Activos ✅

| Característica | Estado |
|---|---|
| Código interno automático, marca, modelo, serial | ✅ |
| Tipo de equipo dinámico (tabla `equipment_tipos`) | ✅ |
| Estado operativo (Disponible, Asignado, En mantenimiento, etc.) | ✅ |
| Criticidad del equipo (Alta / Media / Baja) | ✅ |
| Sede, bodega, ubicación física, área | ✅ |
| Fecha compra, valor, proveedor, garantía | ✅ |
| Hoja de vida: ficha técnica (specs dinámicos por tipo), periféricos, fotos, mantenimiento | ✅ |
| Historial completo de asignaciones y movimientos | ✅ |
| Calibración: fecha, vencimiento, frecuencia en meses | ✅ |
| Adjuntar documentos PDF a la ficha (manuales, certificados) | ✅ |

| Generación de código QR / etiqueta por equipo | ⏳ Diferido |

### 4.2 Órdenes de Trabajo (OT) — CMMS Core ✅

| Característica | Estado |
|---|---|
| Registro de mantenimiento (tipo, técnico, fecha, costo, fotos) | ✅ |
| Número de OT auto-generado (`OT-YYYYMMDD-NNNN`) | ✅ |
| Prioridad de la OT (Urgente / Alta / Media / Baja) | ✅ |
| Técnico asignado: FK a usuarios internos + texto libre externos | ✅ |
| Flujo de estados: Programado → En proceso → Pendiente aprobación → Aprobado / Rechazado | ✅ |
| Botón "Iniciar OT" (programado → en_proceso) | ✅ |
| Checklist interactivo de pasos (clickeable con barra de progreso) | ✅ |
| Checklists auto-creados desde plantillas por tipo de equipo | ✅ |
| Firma digital del técnico (cierra OT → pendiente_aprobacion) | ✅ |
| Firma digital del supervisor (aprobación final) | ✅ |
| Botones Aprobar / Rechazar con motivo de rechazo | ✅ |
| Fotos adjuntas (antes / después) | ✅ |
| Auto-creación de OT preventiva por calendario | ✅ Parcial |

### 4.3 Agenda unificada del técnico ✅

| Característica | Estado |
|---|---|
| `AgendaContent`: OTs + Tickets asignados en una sola vista | ✅ |
| KPIs: En proceso / Programadas / Pend. aprobación / Tickets | ✅ |
| Dashboard de inicio cuando `home_dashboard = 'tecnico'` | ✅ |
| Página `/mantenimientos/mi-dia` (misma vista desde subnav) | ✅ |
| Filtrado confiable por `tecnico_id` (FK) — no string matching | ✅ |
| `/mis-ot`: estados activos asignados al usuario | ✅ |
| `/mis-tickets`: tickets asignados al usuario | ✅ |
| Modal OT interactivo desde la agenda (acciones directas) | ✅ |

### 4.4 Calendario y Programación ✅

| Característica | Estado |
|---|---|
| Vista mensual con colores (rojo/naranja/ámbar/cyan/esmeralda) | ✅ |
| Auto-programación de primer preventivo | ✅ |
| Filtros por sede y tipo | ✅ |
| Panel lateral de detalle con edición de próxima fecha | ✅ |

### 4.5 Calibración / Metrología

| Característica | Estado |
|---|---|
| Fecha de vencimiento del certificado de calibración por equipo | ✅ |
| Alerta 30 días antes del vencimiento | ✅ |
| Reporte de equipos con calibración vencida | ✅ |
| Adjuntar PDF del certificado | 🔶 |

### 4.6 Mesa de Ayuda / Portal Empleado ✅

| Característica | Estado |
|---|---|
| Portal público `/portal` (verificación por cédula) | ✅ |
| Redes WiFi por sede | ✅ |
| Crear ticket de soporte con equipos asociados | ✅ |
| Gestión de tickets IT `/tickets` (estados + comentarios) | ✅ |
| Administración de redes WiFi `/configuracion/redes-wifi` | ✅ |
| Auditoría de accesos en BD (`audit_logs`) | ✅ |
| Login con tab "Colaborador" | ✅ |

### 4.7 Asignaciones, Actas y Entregas ✅

| Característica | Estado |
|---|---|
| Entrega individual y en carrito (múltiple) | ✅ |
| Cascada de periféricos en entrega/devolución | ✅ |
| Acta PDF imprimible con firmas (modal pantalla completa) | ✅ |
| Historial completo de movimientos | ✅ |

### 4.8 Usuarios, Roles y Dashboards ✅

| Característica | Estado |
|---|---|
| JWT + RBAC granular | ✅ |
| Dashboard diferenciado por rol (`home_dashboard`) | ✅ |
| Navbar con submenús y grupos (desktop dropdown + móvil acordeón) | ✅ |
| Endpoint `GET /users/basico` (selector ligero para cualquier usuario autenticado) | ✅ |

### 4.9 Firma Digital ✅

- Todas las firmas abren modal pantalla completa (canvas grande, ideal para lápiz/stylus/touch)
- Preview en miniatura cuando hay firma; botón para re-firmar
- Aplica a: entrega, devolución, paz y salvo, bodega inventario, firma técnico OT, firma supervisor OT

---

## 5. Entidades principales

| Entidad | Columnas clave relevantes | Estado |
|---|---|---|
| `equipment` | codigo_interno, marca, modelo, tipo, sede, estado, criticidad | ✅ |
| `equipment_tipos` | nombre, activo, orden | ✅ |
| `bodegas` | nombre, sede, tipo | ✅ |
| `empleados` | cedula, nombres, apellidos, sede, cargo | ✅ |
| `asignaciones` | equipment_id, empleado_id, tipo, fecha | ✅ |
| `actas_entrega` | tipo, firma_entrega, firma_recibe, empleado, sede | ✅ |
| `mantenimientos` | numero_ot, equipment_id, tipo, tecnico (texto), **tecnico_id** (FK), prioridad, estado, firma_tecnico, firma_supervisor, aprobado_por_id | ✅ |
| `mantenimiento_pasos` | mantenimiento_id, descripcion, completado, completado_en | ✅ |
| `mantenimiento_plantilla_pasos` | tipo_equipo, tipo_mantenimiento, descripcion, orden | ✅ |
| `mantenimiento_configs` | tipo_equipo, frecuencia_meses | ✅ |
| `users` | email, full_name, is_active, is_superuser | ✅ |
| `roles` | name, home_dashboard | ✅ |
| `permissions` | code, name, description | ✅ |
| `tickets` | asunto, estado, prioridad, asignado_a_id, documento_identidad, sede | ✅ |
| `ticket_comentarios` | contenido, es_interno, autor_nombre | ✅ |
| `redes_wifi` | sede, nombre_red, contrasena | ✅ |
| `audit_logs` | tipo_acceso, identificador, ip_address, resultado | ✅ |
| `credenciales` | | ✅ |
| `calibracion_certificados` | | 🔶 |
| `equipment_documentos` | | 🔶 |

---

## 6. Permisos del sistema (RBAC)

### Tabla completa de permisos

| Código | Nombre | Uso |
|---|---|---|
| `users:read` | Ver usuarios | Listar usuarios |
| `users:write` | Crear usuarios | Crear y editar usuarios |
| `roles:read` | Ver roles | Listar roles y sus permisos |
| `roles:write` | Gestionar roles | Crear roles, asignar permisos, configurar `home_dashboard` |
| `permissions:read` | Ver permisos | Listar todos los permisos disponibles |
| `equipment:read` | Ver equipos | Listar y buscar equipos |
| `equipment:write` | Gestionar equipos | Crear, editar equipos y sus specs |
| `equipment:hoja_vida` | Ver hoja de vida | Ficha técnica completa, historial, periféricos |
| `equipment:delete` | Eliminar equipos | Eliminar equipos (avanzado) |
| `equipment_types:write` | Gestionar tipos | Crear/editar tipos y plantillas de specs |
| `bodegas:read` | Ver bodegas | Listar bodegas e inventario |
| `bodegas:write` | Gestionar bodegas | Crear y editar bodegas |
| `bodegas:delete` | Eliminar bodegas | Eliminar bodegas (avanzado) |
| `empleados:read` | Ver empleados | Listar empleados |
| `empleados:write` | Gestionar empleados | Crear y editar empleados |
| `asignaciones:read` | Ver asignaciones | Ver historial de movimientos |
| `asignaciones:write` | Gestionar asignaciones | Entregar y recibir equipos, generar actas |
| `asignaciones:trasladar` | Trasladar equipos | Mover equipos entre bodegas |
| `asignaciones:devolver_sin_acta` | Devolver sin acta | Devolución sin firma (avanzado) |
| `mantenimientos:read` | Ver mantenimientos | Ver OTs, registros, dashboard, agenda propia |
| `mantenimientos:create` | Crear OTs | Registrar nuevas OTs |
| `mantenimientos:update` | Actualizar OTs | Iniciar OT, marcar pasos, firmar como técnico |
| `mantenimientos:write` | Editar OTs | Editar contenido completo de OTs |
| `mantenimientos:delete` | Eliminar OTs | Eliminar registros (avanzado) |
| `mantenimientos:approve` | Aprobar OTs | Aprobar o rechazar OTs pendientes (supervisor) |
| `tickets:read` | Ver tickets | Ver tickets + propios vía Mi Agenda |
| `tickets:write` | Gestionar tickets | Actualizar estado, asignar, comentar |
| `wifi:write` | Gestionar WiFi | Crear/editar/eliminar redes WiFi |
| `credenciales:read` | Ver credenciales | Ver credenciales almacenadas |
| `credenciales:write` | Gestionar credenciales | Crear y editar credenciales |
| `credenciales:delete` | Eliminar credenciales | Eliminar credenciales |
| `reports:export` | Descargar reportes | Exportar CSV de equipos, historial y actas |

### Configuración recomendada por perfil de rol

| Rol | `home_dashboard` | Permisos mínimos |
|---|---|---|
| **SUPER_ADMIN** | `general` | Todos los permisos (automático) |
| **Supervisor Técnico** | `general` | `mantenimientos:read/create/write/approve` · `tickets:read/write` · `equipment:read/hoja_vida` |
| **Técnico IT** | `tecnico` | `mantenimientos:read/create/update` · `tickets:read` · `equipment:read/hoja_vida` |
| **Administrativo (Entregas)** | `entregas` | `asignaciones:read/write` · `empleados:read` · `equipment:read` · `bodegas:read` |
| **Compras / Inventarios** | `inventario` | `equipment:read/write/hoja_vida` · `bodegas:read/write` · `equipment_types:write` |

> **Nota:** El permiso `mantenimientos:approve` habilita los botones "Aprobar / Rechazar" en el modal de OT.
> El `home_dashboard = 'tecnico'` activa la vista **Mi Agenda** como pantalla de inicio (OTs propias + tickets asignados).

---

## 7. Flujo de OT (estado completo)

```
PROGRAMADO ──[Iniciar OT]──▶ EN_PROCESO ──[Firmar técnico]──▶ PENDIENTE_APROBACION
                                                                      │
                                              ┌───────────────────────┤
                                              ▼                       ▼
                                          APROBADO               RECHAZADO
```

- **Programado → En proceso**: endpoint `POST /{id}/iniciar` — requiere `mantenimientos:update`
- **En proceso → Pendiente aprobación**: endpoint `POST /{id}/firma-tecnico` — automático al firmar
- **Pendiente → Aprobado/Rechazado**: endpoint `POST /{id}/aprobar` — requiere `mantenimientos:approve`
- También existe `CANCELADO` y `REALIZADO` (estados legacy / directos)

---

## 8. Reglas operativas clave

- No mezclar activos fijos con consumibles.
- Todo evento relevante queda registrado con usuario + timestamp.
- Las OTs correctivas requieren aprobación del supervisor antes de archivarse.
- Los certificados de calibración se adjuntan directamente a la ficha del equipo.
- Los permisos definen qué puede hacer cada rol; el sistema adapta la UI al rol activo.
- La migración de esquema es idempotente: `ALTER TABLE … IF NOT EXISTS` en `_run_migrations()`.
- Los archivos van en `/storage` (montado como volumen), nunca en la base de datos.
- **Cada aplicación (IT / Bio) es completamente independiente: no comparte BD, ni código de dominio.**
- El campo `tecnico` (texto) en mantenimientos convive con `tecnico_id` (FK): usar FK para internos, texto para externos.

---

## 9. Fases de implementación

### Fase 1 — Completada ✅

- Inventario de equipos (hoja de vida, specs, periféricos, fotos)
- Sedes y bodegas · Asignaciones, actas, entrega en carrito
- Mantenimientos base (registro, fotos, dashboard, calendario)
- Roles y permisos granulares · Tema claro/oscuro
- Firma digital modal pantalla completa
- Portal empleado + Mesa de ayuda + Redes WiFi
- Dashboard diferenciado por rol + Navbar con submenús
- **Limpieza multi-dominio → App IT pura** (2026-06-25)
- **OT completa**: número, prioridad, estados, checklist interactivo, firma técnico/supervisor, agenda unificada (2026-06-25)

### Fase 2 — Pendiente 🔶

**App Bioingeniería** (clonar de IT):
1. Clonar repositorio en directorio nuevo
2. Cambiar puertos (backend 8002, frontend 3002) y nombre de BD (`inv_bio`)
3. Adaptar colores de acento (cyan → violeta)
4. Sembrar tipos de equipo biomédico
5. Ajustar branding ("Bioingeniería" en lugar de "IT")

### Fase 3 — Pendiente 🔶

**Portal Admin** (launcher):
- App Next.js liviana en puerto 3000
- Pantalla de acceso con dos tarjetas: [Entrar a IT] · [Entrar a Bioingeniería]
- Sin backend propio; solo redirige a las apps correspondientes

### Fase 4 — Diferida ⏳

- Notificaciones email / push cuando se asigna una OT
- QR y escaneo de equipos
- Modo offline / PWA
- Vista Gantt de OTs · Integración RRHH · App móvil nativa
- Consulta de estado de ticket en portal empleado
- Adjuntar PDF de certificado de calibración (`calibracion_certificados`)
- Documentos adjuntos en ficha del equipo (`equipment_documentos`)

---

## 10. Registro de avances (Changelog)

### 2026-06-02 — Base del sistema (`273e2df`)
- Modelos, repositorios, routers y schemas base.

### 2026-06-11 — Hojas de vida, periféricos, carrito (`f7a80b7`)
- Hoja de vida, cascada periféricos, carrito entrega, acta imprimible.

### 2026-06-12 — Permisos granulares + tema claro/oscuro (`e74cedb`)
- Permisos granulares, `require_any_permission()`, tema dark completo.

### 2026-06-12 — Módulo Mantenimientos
- `mantenimiento_configs`, `mantenimiento_photos`, dashboard, registros, configuración.

### 2026-06-18 — Calendario y auto-preventivo
- `proximo_preventivo`, backfill, calendario interactivo, tipos de equipo reordenables.

### 2026-06-20 — Portal Empleado + Mesa de Ayuda + Redes WiFi
- Portal público (cédula → WiFi + ticket), tickets IT, redes WiFi, auditoría de accesos, login colaborador.

### 2026-06-23 — Firma digital modal pantalla completa
- `SignaturePad` rediseñado: modal fullscreen con canvas grande, preview thumbnail, re-firmar.

### 2026-06-23 — Dashboards por rol + Navbar con submenús
- `home_dashboard` en roles: general / inventario / entregas / técnico.
- Navbar: dropdowns (desktop), acordeones (móvil).

### 2026-06-25 — Limpieza multi-dominio → App IT pura
- Eliminado `dominio_operativo`, `DomainProvider`, `useDomain` (15 archivos frontend + 2 backend).
- Decisión arquitectónica: 3 apps separadas.

### 2026-06-25 — OT completa + Agenda unificada
- **`numero_ot`** auto-generado (`OT-YYYYMMDD-NNNN`) al crear mantenimiento.
- **`tecnico_id`** FK a `users` — asignación confiable de OTs a usuarios internos.
- **Estados**: agrega `en_proceso`; **Prioridades**: agrega `Urgente`.
- **Endpoints nuevos**: `POST /{id}/iniciar`, `GET /mis-ot` (refactorizado), `GET /tickets/mis-tickets`, `GET /users/basico`.
- **Modal OT interactivo**: checklist clickeable, botones de estado, firma técnico/supervisor, rechazo con motivo, callback `onUpdate` para actualizar lista en tiempo real.
- **`AgendaContent`**: componente unificado OTs + Tickets — usado en dashboard técnico (`home_dashboard='tecnico'`) y en `/mantenimientos/mi-dia` (renombrado "Mi agenda").
- **Formulario de OT**: selector de usuario interno + campo texto para externos.

---

## 11. Pendientes inmediatos

### A — App Bioingeniería
Clonar proyecto IT, cambiar puertos/DB/colores/tipos. Ver Fase 2.

### B — Portal Admin
Launcher liviano que unifica acceso a App IT y App Bio. Ver Fase 3.

### C — Documentos adjuntos en ficha del equipo
Tabla `equipment_documentos`, visor PDF, manuales/certificados.

### D — Certificados de calibración
Tabla `calibracion_certificados`, adjuntar PDF, descarga.
