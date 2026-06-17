# SIGA Escolar — Guía Completa: Crear Sprint 2 Manualmente en Jira

> **Capacidad comprometida:** 34 puntos (Marcelo 20 pts + Daniel 14 pts)
> **Duración:** 9 días (16 junio → 24 junio 2026)
> **Todas las tareas entran al Sprint 2 — incluyendo Protocolos RICE (2.4.1 y 2.4.2)**
>
> ⚠️ Sprint agresivo para cumplir fecha límite del 3 de julio. El equipo terminó Sprint 1 con 4 días de anticipación.

---

## PASO 0 — Crear el Sprint 2

1. Ir a **Backlog** del proyecto SIGA-escolar
2. Clic en **Crear sprint**
3. Completar:

| Campo | Valor |
|-------|-------|
| **Nombre** | Sprint 2 |
| **Fecha inicio** | 16/06/2026 |
| **Fecha fin** | 24/06/2026 |
| **Objetivo** | Implementar RBAC completo, gestión de usuarios y estudiantes con importación masiva, registro de incidentes con notificaciones automáticas, trazabilidad de estados y protocolos normativos RICE |

---

## PASO 1 — Crear la Épica

| Campo | Valor |
|-------|-------|
| **Tipo** | Epic |
| **Resumen** | Lógica de Negocio y Módulos Core |
| **Descripción** | Desarrollar los flujos de gestión de convivencia, importación masiva de estudiantes, registro de incidentes con notificaciones automáticas, y protocolos normativos RICE. Esta épica cubre el Sprint 2 completo y los protocolos RICE en Sprint 3. |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `core` |
| **Sprint** | Sprint 2 |

✅ Guardar y anotar el ID generado (ej. `SIGA-13`)

---

## PASO 2 — Crear las Historias de Usuario

---

### HISTORIA 1: HU 2.1 – RBAC Completo y Gestión de Usuarios

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 2.1 – RBAC Completo y Gestión de Usuarios |
| **Épica** | Lógica de Negocio y Módulos Core |
| **Descripción** | **Como** administrador del sistema, **quiero** controlar el acceso por roles y gestionar los usuarios del establecimiento **para** garantizar que cada funcionario solo acceda a la información y funciones correspondientes a su rol. |
| **Criterios de Aceptación** | - Middleware RBAC protege todas las rutas según la matriz de permisos definida. - El administrador puede crear, editar y desactivar usuarios del tenant. - Un docente no puede acceder a rutas de reportería ni administración (retorna 403). - El `tenant_id` del JWT filtra correctamente los datos via RLS en cada request autenticado. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `rbac`, `usuarios` |
| **Sprint** | Sprint 2 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-14`)

---

### HISTORIA 2: HU 2.2 – Gestión de Estudiantes e Importación Masiva

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 2.2 – Gestión de Estudiantes e Importación Masiva |
| **Épica** | Lógica de Negocio y Módulos Core |
| **Descripción** | **Como** administrador o coordinador, **quiero** importar la nómina completa de estudiantes desde un archivo CSV y gestionar sus perfiles **para** tener el registro digital de los 483 alumnos del establecimiento disponible en el sistema. |
| **Criterios de Aceptación** | - Carga exitosa de 483 alumnos desde un CSV real en menos de 5 segundos. - RUT duplicado en el mismo tenant hace upsert (actualiza datos, no duplica). - Perfil del estudiante muestra datos personales, curso, apoderado e historial cronológico de incidentes (RF-05). - Búsqueda de estudiante por nombre o RUT retorna resultados en menos de 1 segundo. - Archivo mayor a 10MB es rechazado con mensaje de error claro. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `estudiantes`, `importacion` |
| **Sprint** | Sprint 2 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-15`)

---

### HISTORIA 3: HU 2.3 – Registro de Incidentes y Notificaciones

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 2.3 – Registro de Incidentes y Notificaciones Automáticas |
| **Épica** | Lógica de Negocio y Módulos Core |
| **Descripción** | **Como** inspector o coordinador, **quiero** registrar incidentes de convivencia en un formulario estructurado y recibir alertas automáticas ante casos graves **para** gestionar la convivencia escolar de forma ágil, trazable y conforme a la normativa. |
| **Criterios de Aceptación** | - Formulario de incidente guarda correctamente en BD con todos los campos obligatorios (RF-06). - Incidente con gravedad Grave o Gravísima genera notificación automática interna (RF-07). - La notificación queda registrada en la tabla `notificaciones` con destinatarios correctos. - El estado del incidente avanza correctamente: En Investigación → Derivado → Cerrado (RF-09). - No se permiten transiciones de estado hacia atrás (ej: Cerrado → En Investigación). - Al registrar incidente Grave o Gravísimo, la UI muestra alerta visual prominente. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `incidentes`, `notificaciones` |
| **Sprint** | Sprint 2 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-16`)

---

### HISTORIA 4: HU 2.4 – Protocolos RICE _(diferida al Sprint 3)_

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 2.4 – Protocolos RICE |
| **Épica** | Lógica de Negocio y Módulos Core |
| **Descripción** | **Como** coordinador de convivencia, **quiero** abrir y gestionar protocolos normativos RICE paso a paso **para** cumplir con las exigencias de la Superintendencia de Educación en los 10 tipos de protocolo definidos. |
| **Criterios de Aceptación** | - Se pueden abrir los 10 tipos de protocolo normativo definidos (RF-08). - Cada protocolo queda vinculado a un estudiante y opcionalmente a un incidente origen. - Los estados son trazables: En Investigación → Derivado → Cerrado (RF-09). - No se puede vincular un protocolo a un estudiante que no participó en el incidente origen. - Al cerrar un protocolo se registra automáticamente la `fecha_cierre`. - El coordinador puede agregar observaciones en cada cambio de estado. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `protocolos`, `rice` |
| **Sprint** | **Backlog** _(no entra al Sprint 2)_ |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-17`)

---

## PASO 3 — Crear las Tareas

---

## Tareas de HU 2.1 (RBAC y Usuarios)

---

### TAREA 1.2.3 (diferida) — Middlewares RBAC 5 roles

> ⚠️ **Esta tarea ya existe en Jira** como `1.2.3` bajo la historia `HU 1.2 – Motor Backend y Autenticación`.
> **No la crees de nuevo.** Solo arrástrala desde el Backlog al Sprint 2.

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 1.2.3 Middlewares de Control de Acceso RBAC (5 roles) |
| **Historia padre** | HU 1.2 – Motor Backend y Autenticación ← **no cambia** |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `seguridad`, `rbac` |
| **Sprint** | Sprint 2 ← **arrastrar al Sprint 2 desde el Backlog** |
| **Descripción** | Implementar los middlewares de autorización para los 5 roles del sistema y la matriz de permisos completa. **Subtareas:** (1) Crear middleware `requireRole(...roles)`: verifica `req.user.rol` en lista de roles permitidos, retorna 403 si no tiene acceso. (2) Crear middleware `setTenantContext`: extrae `tenant_id` de `req.user` y ejecuta `SELECT set_tenant(tenant_id)` para activar RLS en cada request. (3) Aplicar `setTenantContext` globalmente en `app.js` para todas las rutas privadas. (4) Aplicar `requireRole` en cada router según la matriz de permisos. (5) Crear tests en Insomnia para cada combinación crítica rol/ruta. **Matriz de permisos:** Usuarios CRUD → solo Administrador. Estudiantes lectura → todos los roles. Estudiantes escritura → Administrador y Coordinador. Incidentes crear → Administrador, Coordinador e Inspector. Incidentes leer → todos. Incidentes editar/cerrar → Administrador y Coordinador. Protocolos RICE → Administrador y Coordinador. Reportería/Dashboard → Administrador, Coordinador y Directivo. Importación CSV → Administrador y Coordinador. |
| **Criterios de Aceptación** | - Ruta protegida con rol insuficiente → 403 `"Forbidden"`. - Docente no puede acceder a reportería (403). - Inspector puede crear incidentes pero no acceder al dashboard analítico (403). - `tenant_id` se establece correctamente y RLS filtra sin contaminación entre tenants. - Matriz de permisos documentada en README del backend. |

✅ Solo arrastrar al Sprint 2 desde el Backlog — no crear nueva tarea

---

### TAREA 2.1.2 — API CRUD de Usuarios

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 2.1.2 API CRUD de Usuarios |
| **Historia padre** | HU 2.1 – RBAC Completo y Gestión de Usuarios |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `usuarios` |
| **Sprint** | Sprint 2 |
| **Descripción** | Desarrollar los endpoints de gestión de usuarios para el administrador. **Endpoints:** `GET /api/v1/usuarios` — listar usuarios del tenant. `GET /api/v1/usuarios/:id` — obtener usuario por ID. `POST /api/v1/usuarios` — crear usuario con contraseña hasheada. `PUT /api/v1/usuarios/:id` — actualizar datos del usuario. `PATCH /api/v1/usuarios/:id/desactivar` — baja lógica. **Subtareas:** (1) Crear `usuariosController.js` con los 5 handlers. (2) Crear `usuariosService.js` con lógica de negocio (hashear password en creación). (3) Crear `usuarios.routes.js` con `requireRole('Administrador')`. (4) Validar que no se pueda desactivar el último administrador activo del tenant. (5) Validar email único por tenant en creación y edición. (6) Nunca retornar el campo `password` en ninguna respuesta. |
| **Criterios de Aceptación** | - `GET /usuarios` retorna lista de usuarios sin campo `password`. - `POST /usuarios` crea usuario con contraseña hasheada (bcrypt coste 10). - `PATCH /usuarios/:id/desactivar` hace baja lógica (`activo = false`). - Intentar desactivar el último admin activo → 400 con mensaje explicativo. - Email duplicado en el mismo tenant → 409 `"El email ya está registrado"`. - Rol insuficiente en cualquier endpoint → 403. |

✅ Guardar

---

### TAREA 2.1.3 — UI Gestión de Usuarios

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 2.1.3 UI Gestión de Usuarios |
| **Historia padre** | HU 2.1 – RBAC Completo y Gestión de Usuarios |
| **Asignado a** | Daniel Flores |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `usuarios` |
| **Sprint** | Sprint 2 |
| **Descripción** | Construir la pantalla de gestión de usuarios visible solo para el Administrador. **Subtareas:** (1) Crear `UsuariosPage.jsx` con tabla de usuarios: nombre, apellido, email, rol, estado (activo/inactivo). (2) Modal `CrearUsuarioModal.jsx`: formulario con campos nombre, apellido, email, rol, contraseña. (3) Modal `EditarUsuarioModal.jsx`: mismos campos sin contraseña. (4) Botón desactivar con confirmación: `"¿Estás seguro de desactivar a [nombre]?"`. (5) Proteger ruta `/usuarios` con `RoleRoute` que solo permita Administrador. (6) Badge de rol con colores diferenciados por rol. (7) Manejo de errores: email duplicado, último admin, etc. |
| **Criterios de Aceptación** | - Tabla muestra todos los usuarios del tenant. - Crear usuario exitoso agrega la fila a la tabla sin recargar la página. - Desactivar usuario cambia el badge de estado a "Inactivo". - Ruta `/usuarios` redirige a `/no-autorizado` si el rol no es Administrador. - Formulario valida campos requeridos antes de enviar. - Vista responsiva desde 360px. |

✅ Guardar

---

## Tareas de HU 2.2 (Estudiantes)

---

### TAREA 2.2.1 — API CRUD de Estudiantes + Importación CSV

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 2.2.1 API CRUD Estudiantes + Importación masiva CSV/Excel |
| **Historia padre** | HU 2.2 – Gestión de Estudiantes e Importación Masiva |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 5 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `estudiantes`, `importacion` |
| **Sprint** | Sprint 2 |
| **Descripción** | Desarrollar los endpoints de gestión de estudiantes y el procesador de importación masiva. **Dependencias a instalar:** `multer`, `csv-parse`, `xlsx`. **Endpoints:** `GET /api/v1/estudiantes` con filtros (curso, nombre, rut, activo). `GET /api/v1/estudiantes/:id/perfil` — perfil completo con incidentes y apoderados. `POST /api/v1/estudiantes` — crear estudiante individual. `PUT /api/v1/estudiantes/:id` — actualizar datos. `POST /api/v1/estudiantes/importar` — importación masiva CSV/Excel. **Subtareas:** (1) Instalar dependencias: `npm install multer csv-parse xlsx`. (2) Crear `estudiantesController.js` y `estudiantesService.js`. (3) Crear `estudiantes.routes.js` con roles según matriz. (4) Endpoint `POST /importar`: acepta `.csv` o `.xlsx`, columnas esperadas: `rut`, `nombre`, `apellido`, `curso`. Normaliza RUT (elimina puntos y guión, valida formato chileno). Busca o crea el curso por nombre automáticamente. Si RUT ya existe: hace upsert. Si RUT es inválido: agrega al reporte de errores sin detener la importación. Retorna resumen `{ importados, actualizados, errores: [{ fila, rut, motivo }] }`. (5) Búsqueda full-text por nombre y RUT con `ilike`. (6) Rechazar archivos mayores a 10MB. |
| **Criterios de Aceptación** | - CSV de 483 alumnos se procesa en menos de 5 segundos. - RUTs inválidos no detienen la importación — aparecen en el reporte de errores. - RUT duplicado en mismo tenant hace upsert (actualiza, no duplica). - `GET /estudiantes?nombre=juan` retorna resultados filtrados. - `GET /estudiantes/:id/perfil` retorna estudiante + array de incidentes + array de apoderados. - Archivo mayor a 10MB → 400 `"El archivo no puede superar los 10MB"`. - Roles insuficientes → 403. |

✅ Guardar

---

### TAREA 2.2.2 — UI Gestión de Estudiantes e Importación

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 2.2.2 UI Gestión de Estudiantes e Importación masiva |
| **Historia padre** | HU 2.2 – Gestión de Estudiantes e Importación Masiva |
| **Asignado a** | Daniel Flores |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `estudiantes` |
| **Sprint** | Sprint 2 |
| **Descripción** | Construir las vistas de listado, perfil y carga masiva de estudiantes. **Subtareas:** (1) Crear `EstudiantesPage.jsx`: tabla con buscador por nombre/RUT (debounce 300ms), filtro por curso. (2) Crear `EstudiantePerfilPage.jsx`: vista unificada con datos personales, apoderado e historial cronológico de incidentes (RF-05). (3) Crear `ImportarEstudiantesModal.jsx`: dropzone para arrastrar/soltar CSV o Excel, botón de descarga de plantilla CSV de ejemplo, barra de progreso durante importación, tabla de resumen post-importación con conteo de importados, actualizados y errores. (4) Agregar rutas `/estudiantes` y `/estudiantes/:id` al router. (5) Proteger rutas según roles: lectura para todos, escritura solo Administrador y Coordinador. |
| **Criterios de Aceptación** | - Buscador filtra en tiempo real con debounce de 300ms. - Perfil del estudiante muestra historial de incidentes ordenado por fecha descendente. - Importación muestra resumen con conteo de éxitos y errores. - Plantilla CSV descargable con columnas correctas y fila de ejemplo. - Vista responsiva desde 360px. |

✅ Guardar

---

## Tareas de HU 2.3 (Incidentes)

---

### TAREA 2.3.1 — API Incidentes + Notificaciones

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 2.3.1 API Incidentes CRUD + Notificaciones automáticas |
| **Historia padre** | HU 2.3 – Registro de Incidentes y Notificaciones |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 5 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `incidentes`, `notificaciones` |
| **Sprint** | Sprint 2 |
| **Descripción** | Desarrollar los endpoints del módulo de convivencia con validaciones estrictas y notificaciones automáticas para incidentes graves. **Dependencias a instalar:** `zod`. **Endpoints:** `GET /api/v1/incidentes` con filtros (estado, gravedad, fecha, estudiante). `GET /api/v1/incidentes/:id` — detalle completo con estudiantes involucrados. `POST /api/v1/incidentes` — registrar nuevo incidente (RF-06). `PATCH /api/v1/incidentes/:id/estado` — cambiar estado (RF-09). `GET /api/v1/tipos-abordaje` — listar catálogo para poblar el select del formulario. **Subtareas:** (1) Instalar `zod`: `npm install zod`. (2) Crear `incidentesController.js` e `incidentesService.js`. (3) Crear `incidentes.routes.js` con roles según matriz. (4) Endpoint `POST /incidentes`: body con `tipo_abordaje_id`, `fecha`, `gravedad`, `relato`, `medidas`, `estudiantes: [{ estudiante_id, es_victima, observacion }]`. Validar con Zod todos los campos obligatorios y mínimo 1 estudiante involucrado. Insertar en `incidentes` e `incidente_estudiantes` en una transacción. Si gravedad es Grave o Gravísima → disparar `notificacionService.crearAlerta()`. Registrar en `auditoria` con acción CREATE. (5) Crear `notificacionService.js`: método `crearAlerta(incidente, tenant_id)` que inserta en tabla `notificaciones` con `canal: 'interno'`. Destinatarios: todos los usuarios con rol Coordinador o Administrador del tenant. Mensaje: `"Incidente [gravedad] registrado el [fecha] — Estudiante: [nombre]"`. (6) Endpoint `PATCH /incidentes/:id/estado`: valida transiciones permitidas (En Investigación → Derivado, Derivado → Cerrado). No permite retroceder estados. Registra en auditoría con acción UPDATE. |
| **Criterios de Aceptación** | - `POST /incidentes` sin campo `relato` → 400 con mensaje de validación específico. - `POST /incidentes` sin estudiantes → 400 `"Debe incluir al menos un estudiante involucrado"`. - Incidente Gravísimo → registro automático en tabla `notificaciones` con destinatarios correctos. - Incidente Leve → no genera notificación. - `PATCH /estado` con transición inválida → 400 `"Transición de estado no permitida"`. - Auditoría registra el evento CREATE con el `registro_id` del incidente creado. - Todos los campos en la respuesta coinciden con el contrato de API v2. |

✅ Guardar

---

### TAREA 2.3.2 — UI Formulario de Incidentes y Dashboard de Casos

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 2.3.2 UI Formulario de Incidentes y Dashboard de Casos |
| **Historia padre** | HU 2.3 – Registro de Incidentes y Notificaciones |
| **Asignado a** | Daniel Flores |
| **Story Points** | 5 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `incidentes` |
| **Sprint** | Sprint 2 |
| **Descripción** | Construir el formulario de registro de incidentes y la vista de gestión de casos activos. **Subtareas:** (1) Crear `NuevoIncidentePage.jsx`: selector de tipo de abordaje (poblado desde `GET /tipos-abordaje`), selector de fecha, selector de gravedad con colores (Leve/Grave/Gravísima), buscador de estudiantes involucrados (busca al escribir mínimo 2 caracteres, permite agregar múltiples), para cada estudiante: checkbox `es_victima` y campo observación, campo de texto para relato (mínimo 20 caracteres), campo para medidas adoptadas, botón guardar con spinner. (2) Crear `IncidentesPage.jsx`: grilla de casos con filtros por estado, gravedad y fecha. (3) Componente `AlertaGrave.jsx`: banner/toast prominente al registrar incidente Grave o Gravísimo (RF-07). (4) Crear `IncidenteDetallePage.jsx`: vista completa del incidente con todos los datos y botón de cambio de estado. (5) Agregar rutas: `/incidentes`, `/incidentes/nuevo`, `/incidentes/:id`. (6) Proteger rutas según roles: creación solo Administrador, Coordinador e Inspector. |
| **Criterios de Aceptación** | - Formulario no permite enviar con campos obligatorios vacíos. - Buscador de estudiantes muestra resultados al escribir mínimo 2 caracteres. - Al registrar incidente Grave/Gravísimo aparece alerta visual prominente (RF-07). - Grilla muestra estado actual de cada caso con badge de color. - Cambio de estado desde el detalle actualiza la UI sin recargar la página. - Vista responsiva desde 360px. |

✅ Guardar

---

## Tareas de HU 2.4 (Protocolos RICE)

---

### TAREA 2.4.1 — API Protocolos RICE

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 2.4.1 API Protocolos RICE |
| **Historia padre** | HU 2.4 – Protocolos RICE |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 4 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `protocolos`, `rice` |
| **Sprint** | Sprint 2 |
| **Descripción** | Desarrollar los endpoints del módulo RICE con validación de jerarquía estudiante-incidente y trazabilidad de estados. **Endpoints:** `GET /api/v1/protocolos` con filtros. `GET /api/v1/protocolos/:id` — detalle del protocolo. `POST /api/v1/protocolos` — abrir nuevo protocolo. `PATCH /api/v1/protocolos/:id/estado` — avanzar estado con observación. `GET /api/v1/tipos-protocolo` — listar los 10 tipos. **Subtareas:** (1) Crear `protocolosController.js` y `protocolosService.js`. (2) Crear `protocolos.routes.js` con `requireRole('Administrador', 'Coordinador')`. (3) Endpoint `POST /protocolos`: body con `estudiante_id`, `tipo_protocolo_id`, `fecha_apertura`, `incidente_id` (opcional), `observaciones`. Si `incidente_id` presente: validar que `estudiante_id` existe en `incidente_estudiantes` para ese incidente. Estado inicial siempre `En Investigación`. (4) Endpoint `PATCH /protocolos/:id/estado`: valida transiciones (En Investigación → Derivado, Derivado → Cerrado). Al cerrar: establece `fecha_cierre = NOW()`. (5) Registrar todos los eventos en auditoría. |
| **Criterios de Aceptación** | - Abrir protocolo con `estudiante_id` que no pertenece al `incidente_id` → 400 con mensaje claro. - Estado inicial siempre es `En Investigación`. - Transición inválida de estado → 400 `"Transición de estado no permitida"`. - Al cerrar protocolo, `fecha_cierre` se establece automáticamente. - `GET /protocolos?estado=Derivado` retorna solo protocolos en ese estado. - Auditoría registra apertura y cambios de estado. |

✅ Guardar (en Backlog)

---

### TAREA 2.4.2 — UI Módulo RICE

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 2.4.2 UI Módulo RICE |
| **Historia padre** | HU 2.4 – Protocolos RICE |
| **Asignado a** | Daniel Flores |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `rice` |
| **Sprint** | Sprint 2 |
| **Descripción** | Construir las vistas del módulo de protocolos RICE. **Subtareas:** (1) Crear `ProtocolosPage.jsx`: tabla de protocolos activos con filtros por estado y tipo. (2) Crear `NuevoProtocoloPage.jsx`: selector de tipo de protocolo (10 opciones), buscador de estudiante, selector de incidente relacionado (opcional, muestra incidentes del estudiante seleccionado), fecha de apertura, campo de observaciones iniciales. (3) Crear `ProtocoloDetallePage.jsx`: datos completos del protocolo, línea de tiempo visual del estado (En Investigación → Derivado → Cerrado), formulario inline para avanzar estado con observación obligatoria. (4) Agregar rutas `/protocolos`, `/protocolos/nuevo`, `/protocolos/:id`. (5) Proteger rutas con `RoleRoute(['Administrador', 'Coordinador'])`. |
| **Criterios de Aceptación** | - Al seleccionar estudiante en el formulario, carga automáticamente sus incidentes relacionados. - Línea de tiempo visual muestra el estado actual resaltado. - Avanzar estado requiere ingresar observación (campo obligatorio). - Tabla muestra badge de estado con color por etapa. - Vista responsiva desde 360px. |

✅ Guardar (en Backlog)

---

## PASO 4 — Ordenar el Sprint 2 en el Backlog

1. Ir a **Backlog**
2. Arrastrar al Sprint 2 **todas** las tareas en este orden de prioridad:
   - Primero: **1.2.3** (RBAC — ya existe, solo arrastrar. Desbloquea todo lo demás)
   - Segundo: **2.3.1** (API Incidentes — núcleo del negocio)
   - Tercero: **2.3.2** (UI Incidentes)
   - Cuarto: **2.2.1** (API Estudiantes + CSV)
   - Quinto: **2.2.2** (UI Estudiantes)
   - Sexto: **2.4.1** (API Protocolos RICE)
   - Séptimo: **2.4.2** (UI Protocolos RICE)
   - Octavo: **2.1.2** (API Usuarios)
   - Noveno: **2.1.3** (UI Usuarios)
3. No dejar nada en Backlog — todo entra al Sprint 2

---

## PASO 5 — Iniciar el Sprint 2

1. Ir a **Backlog**
2. Clic en **Iniciar sprint** en el bloque del Sprint 2
3. Confirmar fechas: 15/06/2026 → 29/06/2026
4. Confirmar objetivo del sprint
5. Clic en **Iniciar**

---

## Resumen de puntos por persona

| Desarrollador | Tareas | Puntos Sprint 2 |
|---------------|--------|-----------------|
| Marcelo Acevedo | 1.2.3 (diferida), 2.1.2, 2.2.1, 2.3.1, 2.4.1 | 20 pts |
| Daniel Flores | 2.1.3, 2.2.2, 2.3.2, 2.4.2 | 14 pts |
| **Total comprometido** | **9 tareas** | **34 pts** |
| ⚠️ Nota | 1.2.3 ya existe en Jira — solo arrastrar al Sprint 2 | |

---

## Definición de Terminado (DoD) — Sprint 2

Aplica a todas las tareas además del DoD del Sprint 1:

- [ ] Validaciones con Zod en todos los endpoints que reciben body
- [ ] Ningún endpoint retorna el campo `password` de usuarios
- [ ] Transacciones de BD en operaciones que tocan más de una tabla
- [ ] Casos de prueba en Insomnia: happy path + mínimo 2 casos de error por endpoint
- [ ] RLS verificado: datos de un tenant no son visibles desde otro tenant
