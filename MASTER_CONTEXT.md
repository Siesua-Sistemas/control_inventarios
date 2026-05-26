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
- Control de licencias
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
