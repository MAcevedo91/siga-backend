# SIGA Escolar — Sprint 2: Lógica de Negocio y Módulos Core

**Proyecto:** SIGA-Escolar
**Sprint:** Sprint 2
**Duración:** 2 semanas
**Capacidad del equipo:** 20 puntos (Marcelo Acevedo + Daniel Flores)
**Objetivo:** Implementar los módulos de gestión de usuarios, importación masiva de estudiantes, registro de incidentes con notificaciones automáticas, protocolos RICE y el RBAC completo de 5 roles.

---

## Requerimientos cubiertos en este sprint

| RF | Módulo | Estado Sprint 1 | Estado Sprint 2 |
|----|--------|-----------------|-----------------|
| RF-01 | Autenticación | ✅ Completo | — |
| RF-02 | RBAC 5 roles | ⚠️ Diferido | ✅ Se completa |
| RF-03 | Bitácora auditoría | ✅ Completo | — |
| RF-04 | Importación masiva CSV | ❌ Pendiente | ✅ Se implementa |
| RF-05 | Perfil unificado estudiante | ❌ Pendiente | ✅ Se implementa |
| RF-06 | Registro de incidentes | ❌ Pendiente | ✅ Se implementa |
| RF-07 | Notificaciones automáticas | ❌ Pendiente | ✅ Se implementa |
| RF-08 | Flujos RICE | ❌ Pendiente | ✅ Se implementa |
| RF-09 | Trazabilidad de estados | ❌ Pendiente | ✅ Se implementa |
| RF-10 | Dashboard analítico | ❌ Pendiente | ⚠️ Sprint 3 |
| RF-11 | Exportación PDF | ❌ Pendiente | ⚠️ Sprint 3 |

---

## ÉPICA 2: Lógica de Negocio y Módulos Core

---

## HU 2.1 — RBAC Completo y Gestión de Usuarios

**Como** administrador del sistema, **quiero** controlar el acceso por roles y gestionar los usuarios del establecimiento **para** garantizar que cada funcionario solo acceda a la información correspondiente a su función.

**Criterios de Aceptación de la Historia:**
- [ ] Middleware RBAC protege todas las rutas según la matriz de permisos
- [ ] El administrador puede crear, editar y desactivar usuarios
- [ ] Un docente no puede acceder a rutas de reportería ni de administración
- [ ] El `tenant_id` del JWT filtra correctamente los datos via RLS en cada request

---

### TAREA 2.1.1 — Middlewares RBAC 5 roles

**Asignado a:** Marcelo Acevedo
**Estimación:** 3 puntos
**Prioridad:** Alta
**Etiquetas:** `backend`, `seguridad`, `rbac`

**Descripción:**
Implementar los middlewares de autorización para los 5 roles del sistema y la matriz de permisos completa.

**Matriz de permisos:**
| Recurso | Administrador | Coordinador | Directivo | Inspector | Docente |
|---------|:---:|:---:|:---:|:---:|:---:|
| Usuarios (CRUD) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Estudiantes (lectura) | ✅ | ✅ | ✅ | ✅ | ✅ (solo sus cursos) |
| Estudiantes (escritura) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Incidentes (crear) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Incidentes (leer) | ✅ | ✅ | ✅ | ✅ | ✅ (solo sus cursos) |
| Incidentes (editar/cerrar) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Protocolos RICE | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reportería/Dashboard | ✅ | ✅ | ✅ | ❌ | ❌ |
| Importación CSV | ✅ | ✅ | ❌ | ❌ | ❌ |

**Subtareas:**
- [ ] Crear middleware `requireRole(...roles)`: verifica `req.user.rol` en lista de roles permitidos, retorna 403 si no tiene acceso
- [ ] Crear middleware `setTenantContext`: extrae `tenant_id` de `req.user` y ejecuta `SELECT set_tenant(tenant_id)` en cada request para activar RLS
- [ ] Aplicar `setTenantContext` globalmente en `app.js` para todas las rutas privadas
- [ ] Aplicar `requireRole` en cada router según la matriz de permisos
- [ ] Crear tests en Insomnia para cada combinación crítica rol/ruta

**Criterios de Aceptación:**
- [ ] Ruta protegida sin token → 401
- [ ] Ruta con token pero rol insuficiente → 403 `"No tienes permisos para realizar esta acción"`
- [ ] Docente no puede crear incidentes ni acceder al dashboard (403)
- [ ] Inspector puede crear incidentes pero no acceder a reportería (403)
- [ ] `tenant_id` se establece en cada request y RLS filtra sin contaminación entre tenants
- [ ] Colección Insomnia actualizada con casos de prueba RBAC

---

### TAREA 2.1.2 — API CRUD de Usuarios

**Asignado a:** Marcelo Acevedo
**Estimación:** 3 puntos
**Prioridad:** Alta
**Etiquetas:** `backend`, `usuarios`

**Descripción:**
Desarrollar los endpoints de gestión de usuarios para el administrador.

**Endpoints:**
- `GET /api/v1/usuarios` — listar usuarios del tenant (solo admin)
- `GET /api/v1/usuarios/:id` — obtener usuario por ID (solo admin)
- `POST /api/v1/usuarios` — crear usuario con contraseña hasheada (solo admin)
- `PUT /api/v1/usuarios/:id` — actualizar datos del usuario (solo admin)
- `PATCH /api/v1/usuarios/:id/desactivar` — baja lógica (solo admin)

**Subtareas:**
- [ ] Crear `usuariosController.js` con los 5 handlers
- [ ] Crear `usuariosService.js` con la lógica de negocio (hashear password en creación)
- [ ] Crear `usuarios.routes.js` con `requireRole('Administrador')`
- [ ] Validar que no se pueda desactivar el último administrador activo del tenant
- [ ] Validar email único por tenant en creación y edición
- [ ] Nunca retornar el campo `password` en ninguna respuesta

**Criterios de Aceptación:**
- [ ] `GET /api/v1/usuarios` retorna lista de usuarios sin campo `password`
- [ ] `POST /api/v1/usuarios` crea usuario con contraseña hasheada (bcrypt coste 10)
- [ ] `PATCH /api/v1/usuarios/:id/desactivar` hace baja lógica (`activo = false`)
- [ ] Intentar desactivar el último admin retorna 400 con mensaje explicativo
- [ ] Email duplicado en el mismo tenant retorna 409 `"El email ya está registrado"`
- [ ] Rol con acceso insuficiente retorna 403

---

### TAREA 2.1.3 — UI Gestión de Usuarios (Frontend)

**Asignado a:** Daniel Flores
**Estimación:** 3 puntos
**Prioridad:** Alta
**Etiquetas:** `frontend`, `ui`, `usuarios`

**Descripción:**
Construir la pantalla de gestión de usuarios visible solo para el Administrador.

**Subtareas:**
- [ ] Crear `UsuariosPage.jsx` con tabla de usuarios (nombre, apellido, email, rol, estado)
- [ ] Modal `CrearUsuarioModal.jsx`: formulario con campos nombre, apellido, email, rol, contraseña
- [ ] Modal `EditarUsuarioModal.jsx`: mismos campos sin contraseña (la edición de contraseña es aparte)
- [ ] Botón desactivar con confirmación: `"¿Estás seguro de desactivar a [nombre]?"`
- [ ] Proteger ruta `/usuarios` con `RoleRoute` que solo permita `Administrador`
- [ ] Mostrar badge de rol con colores diferenciados por rol
- [ ] Manejo de errores: email duplicado, último admin, etc.

**Criterios de Aceptación:**
- [ ] Tabla muestra todos los usuarios del tenant con paginación básica
- [ ] Crear usuario exitoso agrega la fila a la tabla sin recargar la página
- [ ] Desactivar usuario cambia el badge de estado a "Inactivo"
- [ ] Ruta `/usuarios` redirige a `/no-autorizado` si el rol no es Administrador
- [ ] Formulario valida campos requeridos antes de enviar

---

## HU 2.2 — Gestión de Estudiantes e Importación Masiva

**Como** administrador o coordinador, **quiero** importar la nómina completa de estudiantes desde un archivo CSV y gestionar sus perfiles **para** tener el registro digital de los 483 alumnos del establecimiento.

**Criterios de Aceptación de la Historia:**
- [ ] Carga exitosa de 483 alumnos desde un CSV real
- [ ] RUT duplicado en el mismo tenant es rechazado o actualizado según configuración
- [ ] Perfil de estudiante muestra datos personales, curso, apoderado e historial de incidentes
- [ ] Búsqueda de estudiante por nombre o RUT retorna resultados en menos de 1 segundo

---

### TAREA 2.2.1 — API CRUD de Estudiantes + Importación CSV

**Asignado a:** Marcelo Acevedo
**Estimación:** 5 puntos
**Prioridad:** Alta
**Etiquetas:** `backend`, `estudiantes`, `importacion`

**Descripción:**
Desarrollar los endpoints de gestión de estudiantes y el procesador de importación masiva desde CSV/Excel.

**Endpoints:**
- `GET /api/v1/estudiantes` — listar con filtros (curso, nombre, rut, activo)
- `GET /api/v1/estudiantes/:id` — perfil completo con incidentes y apoderados
- `POST /api/v1/estudiantes` — crear estudiante individual
- `PUT /api/v1/estudiantes/:id` — actualizar datos
- `POST /api/v1/estudiantes/importar` — importación masiva desde CSV/Excel (RF-04)

**Dependencias adicionales:** `multer` (upload de archivos), `csv-parse` (parseo CSV), `xlsx` (parseo Excel)

**Subtareas:**
- [ ] Instalar dependencias: `npm install multer csv-parse xlsx`
- [ ] Crear `estudiantesController.js` y `estudiantesService.js`
- [ ] Crear `estudiantes.routes.js` con roles permitidos según matriz
- [ ] Endpoint `POST /importar`:
  - Acepta archivo `.csv` o `.xlsx`
  - Columnas esperadas: `rut`, `nombre`, `apellido`, `curso` (nombre del curso)
  - Normaliza RUT: elimina puntos y guión, valida formato chileno
  - Busca o crea el curso por nombre automáticamente
  - Si RUT ya existe en el tenant: actualiza datos (upsert)
  - Si RUT es inválido: lo agrega al reporte de errores sin detener la importación
  - Retorna resumen: `{ importados, actualizados, errores: [{ rut, motivo }] }`
- [ ] Endpoint `GET /api/v1/estudiantes/:id/perfil` — retorna estudiante + incidentes + apoderados
- [ ] Búsqueda full-text por nombre y RUT con `ilike`

**Criterios de Aceptación:**
- [ ] CSV de 483 alumnos se procesa en menos de 5 segundos
- [ ] RUTs inválidos no detienen la importación — aparecen en el reporte de errores
- [ ] RUT duplicado en mismo tenant hace upsert (actualiza datos, no duplica)
- [ ] `GET /api/v1/estudiantes?nombre=juan` retorna resultados filtrados
- [ ] `GET /api/v1/estudiantes/:id/perfil` retorna estudiante + array de incidentes + array de apoderados
- [ ] Archivo de más de 10MB es rechazado con 400

---

### TAREA 2.2.2 — UI Gestión de Estudiantes (Frontend)

**Asignado a:** Daniel Flores
**Estimación:** 4 puntos
**Prioridad:** Alta
**Etiquetas:** `frontend`, `ui`, `estudiantes`

**Descripción:**
Construir las vistas de listado, perfil y carga masiva de estudiantes.

**Subtareas:**
- [ ] Crear `EstudiantesPage.jsx`: tabla con buscador por nombre/RUT, filtro por curso
- [ ] Crear `EstudiantePerfilPage.jsx`: vista unificada con datos personales, apoderado, historial cronológico de incidentes (RF-05)
- [ ] Crear `ImportarEstudiantesModal.jsx`:
  - Dropzone para arrastrar/soltar archivo CSV o Excel
  - Botón de descarga de plantilla CSV de ejemplo
  - Barra de progreso durante la importación
  - Tabla de resumen post-importación: importados ✅, actualizados 🔄, errores ❌
- [ ] Agregar ruta `/estudiantes` y `/estudiantes/:id` al router
- [ ] Proteger según roles: lectura para todos, escritura solo admin y coordinador

**Criterios de Aceptación:**
- [ ] Buscador filtra en tiempo real (debounce 300ms)
- [ ] Perfil del estudiante muestra historial de incidentes ordenado por fecha descendente
- [ ] Importación muestra resumen con conteo de éxitos y errores
- [ ] Plantilla CSV descargable con las columnas correctas y un ejemplo de datos
- [ ] Vista responsiva desde 360px

---

## HU 2.3 — Registro de Incidentes y Notificaciones

**Como** inspector o coordinador, **quiero** registrar incidentes de convivencia en un formulario estructurado y recibir alertas automáticas ante casos graves **para** gestionar la convivencia escolar de forma ágil y trazable.

**Criterios de Aceptación de la Historia:**
- [ ] Formulario de incidente guarda correctamente en BD con todos los campos obligatorios
- [ ] Incidente con gravedad Grave o Gravísima genera notificación automática interna
- [ ] La notificación queda registrada en tabla `notificaciones`
- [ ] El estado del incidente avanza correctamente: En Investigación → Derivado → Cerrado

---

### TAREA 2.3.1 — API de Incidentes (CRUD + Notificaciones)

**Asignado a:** Marcelo Acevedo
**Estimación:** 5 puntos
**Prioridad:** Alta
**Etiquetas:** `backend`, `incidentes`, `notificaciones`

**Descripción:**
Desarrollar los endpoints del módulo de convivencia con validaciones estrictas y notificaciones automáticas para incidentes graves.

**Endpoints:**
- `GET /api/v1/incidentes` — listar con filtros (estado, gravedad, fecha, estudiante)
- `GET /api/v1/incidentes/:id` — detalle completo del incidente con estudiantes involucrados
- `POST /api/v1/incidentes` — registrar nuevo incidente (RF-06)
- `PATCH /api/v1/incidentes/:id/estado` — cambiar estado del incidente (RF-09)
- `GET /api/v1/tipos-abordaje` — listar catálogo de tipos (para poblar el select del formulario)

**Dependencias adicionales:** `nodemailer` (opcional para Sprint 3 — en Sprint 2 solo notificación interna)

**Subtareas:**
- [ ] Instalar dependencia de validación: `npm install zod`
- [ ] Crear `incidentesController.js` y `incidentesService.js`
- [ ] Crear `incidentes.routes.js` con roles según matriz
- [ ] Endpoint `POST /api/v1/incidentes`:
  - Body: `{ tipo_abordaje_id, fecha, gravedad, relato, medidas, estudiantes: [{ estudiante_id, es_victima, observacion }] }`
  - Validar con Zod: todos los campos obligatorios, al menos 1 estudiante involucrado
  - Insertar en `incidentes` e `incidente_estudiantes` en una transacción
  - Si `gravedad` es `'Grave'` o `'Gravísima'` → disparar `notificacionService.crearAlerta()`
  - Registrar en `auditoria` con acción `CREATE`
- [ ] Servicio `notificacionService.js`:
  - `crearAlerta(incidente, tenant_id)`: inserta en tabla `notificaciones` con `canal: 'interno'`
  - Destinatario: todos los usuarios con rol `Coordinador` o `Administrador` del tenant
  - Mensaje: `"Incidente [gravedad] registrado el [fecha] — Estudiante: [nombre]"`
- [ ] Endpoint `PATCH /api/v1/incidentes/:id/estado`:
  - Valida transiciones permitidas: `En Investigación → Derivado`, `Derivado → Cerrado`
  - No permite retroceder estados
  - Registra en `auditoria` con acción `UPDATE`

**Criterios de Aceptación:**
- [ ] `POST /incidentes` sin campo `relato` → 400 con mensaje de validación específico
- [ ] `POST /incidentes` sin estudiantes → 400 `"Debe incluir al menos un estudiante involucrado"`
- [ ] Incidente Gravísimo → registro automático en tabla `notificaciones`
- [ ] Incidente Leve → no genera notificación
- [ ] `PATCH /estado` con transición inválida (ej: Cerrado → En Investigación) → 400
- [ ] Todos los campos en la respuesta coinciden con el contrato de API
- [ ] Auditoría registra el evento CREATE con el `registro_id` del incidente creado

---

### TAREA 2.3.2 — UI Formulario de Incidentes y Dashboard de Casos

**Asignado a:** Daniel Flores
**Estimación:** 5 puntos
**Prioridad:** Alta
**Etiquetas:** `frontend`, `ui`, `incidentes`

**Descripción:**
Construir el formulario de registro de incidentes y la vista de gestión de casos activos con vista Kanban/Grilla.

**Subtareas:**
- [ ] Crear `NuevoIncidentePage.jsx`:
  - Selector de tipo de abordaje (poblado desde `GET /tipos-abordaje`)
  - Selector de fecha (date picker)
  - Selector de gravedad: Leve / Grave / Gravísima (con colores)
  - Buscador de estudiantes involucrados (busca mientras escribe, agrega múltiples)
  - Para cada estudiante involucrado: checkbox es_victima y campo observación
  - Campo de texto largo para relato (mínimo 20 caracteres)
  - Campo de texto para medidas adoptadas
  - Botón guardar con spinner
- [ ] Crear `IncidentesPage.jsx`: grilla de casos con filtros por estado, gravedad y fecha
- [ ] Componente `KanbanBoard.jsx`: columnas POR HACER / EN CURSO / DERIVADO / CERRADO con drag-and-drop básico (RF-09)
- [ ] Componente `AlertaGrave.jsx`: banner/toast prominente que aparece al registrar un incidente Grave o Gravísimo
- [ ] Crear `IncidenteDetallePage.jsx`: vista completa del incidente con todos los datos y botón de cambio de estado
- [ ] Agregar rutas: `/incidentes`, `/incidentes/nuevo`, `/incidentes/:id`

**Criterios de Aceptación:**
- [ ] Formulario no permite enviar con campos obligatorios vacíos
- [ ] Buscador de estudiantes muestra resultados al escribir mínimo 2 caracteres
- [ ] Al registrar incidente Grave/Gravísimo aparece alerta visual prominente (RF-07)
- [ ] Grilla muestra estado actual de cada caso con badge de color
- [ ] Cambio de estado desde el detalle actualiza la UI sin recargar la página
- [ ] Vista responsiva desde 360px

---

## HU 2.4 — Protocolos RICE

**Como** coordinador de convivencia, **quiero** abrir y gestionar protocolos normativos RICE paso a paso **para** cumplir con las exigencias de la Superintendencia de Educación.

**Criterios de Aceptación de la Historia:**
- [ ] Se pueden abrir los 10 tipos de protocolo definidos
- [ ] Cada protocolo queda vinculado a un estudiante y opcionalmente a un incidente
- [ ] Los estados del protocolo son trazables: En Investigación → Derivado → Cerrado
- [ ] El coordinador puede agregar observaciones en cada etapa

---

### TAREA 2.4.1 — API de Protocolos RICE

**Asignado a:** Marcelo Acevedo
**Estimación:** 4 puntos
**Prioridad:** Alta
**Etiquetas:** `backend`, `protocolos`, `rice`

**Descripción:**
Desarrollar los endpoints del módulo RICE con validación de jerarquía estudiante-incidente y trazabilidad de estados.

**Endpoints:**
- `GET /api/v1/protocolos` — listar con filtros (estado, tipo, estudiante)
- `GET /api/v1/protocolos/:id` — detalle del protocolo
- `POST /api/v1/protocolos` — abrir nuevo protocolo
- `PATCH /api/v1/protocolos/:id/estado` — avanzar estado con observación
- `GET /api/v1/tipos-protocolo` — listar los 10 tipos (para el select del formulario)

**Subtareas:**
- [ ] Crear `protocolosController.js` y `protocolosService.js`
- [ ] Crear `protocolos.routes.js` con `requireRole('Administrador', 'Coordinador')`
- [ ] Endpoint `POST /api/v1/protocolos`:
  - Body: `{ estudiante_id, tipo_protocolo_id, fecha_apertura, incidente_id (opcional), observaciones }`
  - Si `incidente_id` está presente: validar que `estudiante_id` existe en `incidente_estudiantes` para ese incidente (el trigger de BD ya lo hace, pero validar antes para dar error legible)
  - Estado inicial siempre `En Investigación`
  - Registrar en auditoría
- [ ] Endpoint `PATCH /api/v1/protocolos/:id/estado`:
  - Body: `{ estado, observaciones }`
  - Valida transiciones: `En Investigación → Derivado`, `Derivado → Cerrado`
  - Al cerrar: establece `fecha_cierre = NOW()`
  - Registra en auditoría
- [ ] `GET /api/v1/protocolos` con filtros: `?estado=`, `?tipo_protocolo_id=`, `?estudiante_id=`

**Criterios de Aceptación:**
- [ ] Abrir protocolo con `estudiante_id` que no pertenece al `incidente_id` → 400 con mensaje claro
- [ ] Estado inicial siempre es `En Investigación`
- [ ] Transición inválida de estado → 400 `"Transición de estado no permitida"`
- [ ] Al cerrar protocolo, `fecha_cierre` se establece automáticamente
- [ ] `GET /protocolos?estado=Derivado` retorna solo protocolos en ese estado
- [ ] Auditoría registra apertura y cambios de estado

---

### TAREA 2.4.2 — UI Módulo RICE (Frontend)

**Asignado a:** Daniel Flores
**Estimación:** 3 puntos
**Prioridad:** Alta
**Etiquetas:** `frontend`, `ui`, `rice`

**Descripción:**
Construir las vistas del módulo de protocolos RICE con formulario estructurado y vista de seguimiento.

**Subtareas:**
- [ ] Crear `ProtocolosPage.jsx`: tabla de protocolos activos con filtros por estado y tipo
- [ ] Crear `NuevoProtocoloPage.jsx`:
  - Selector de tipo de protocolo (10 opciones)
  - Buscador de estudiante
  - Selector de incidente relacionado (opcional, muestra incidentes del estudiante seleccionado)
  - Fecha de apertura
  - Campo de observaciones iniciales
- [ ] Crear `ProtocoloDetallePage.jsx`:
  - Datos completos del protocolo
  - Línea de tiempo visual del estado (En Investigación → Derivado → Cerrado)
  - Formulario inline para avanzar estado con observación obligatoria
- [ ] Agregar rutas: `/protocolos`, `/protocolos/nuevo`, `/protocolos/:id`
- [ ] Proteger rutas con `RoleRoute(['Administrador', 'Coordinador'])`

**Criterios de Aceptación:**
- [ ] Al seleccionar un estudiante en el formulario, carga automáticamente sus incidentes relacionados
- [ ] Línea de tiempo visual muestra el estado actual resaltado
- [ ] Avanzar estado requiere ingresar observación (campo obligatorio)
- [ ] Tabla de protocolos muestra badge de estado con color por etapa
- [ ] Vista responsiva desde 360px

---

## Ítems diferidos al Sprint 3 (Backlog)

| Tarea | Puntos | Motivo |
|-------|--------|--------|
| Dashboard analítico con gráficos (RF-10) | 5 | Requiere datos reales acumulados de Sprint 2 |
| Exportación PDF con membrete (RF-11) | 4 | Depende del perfil de estudiante completo |
| Deploy a producción (Render/Railway + Vercel) | 3 | Se hace cuando los módulos core están estables |
| Pruebas UAT con el cliente | 2 | Después del deploy |

---

## Resumen de puntos Sprint 2

| ID | Tarea | Asignado | Puntos |
|----|-------|----------|--------|
| 2.1.1 | Middlewares RBAC 5 roles | Marcelo | 3 |
| 2.1.2 | API CRUD Usuarios | Marcelo | 3 |
| 2.1.3 | UI Gestión Usuarios | Daniel | 3 |
| 2.2.1 | API Estudiantes + Importación CSV | Marcelo | 5 |
| 2.2.2 | UI Estudiantes + Importación | Daniel | 4 |
| 2.3.1 | API Incidentes + Notificaciones | Marcelo | 5 |
| 2.3.2 | UI Formulario Incidentes + Kanban | Daniel | 5 |
| 2.4.1 | API Protocolos RICE | Marcelo | 4 |
| 2.4.2 | UI Módulo RICE | Daniel | 3 |
| | **TOTAL** | | **35 pts** |

> ⚠️ **Ajuste de capacidad:** El sprint suma 35 pts vs. capacidad de 20.
> **Recomendación para la Sprint Planning:**
> - Prioridad 1 (no negociables): 2.1.1, 2.3.1, 2.3.2 — el núcleo de la aplicación
> - Prioridad 2 (importantes): 2.2.1, 2.2.2 — importación de estudiantes
> - Prioridad 3 (pueden diferirse): 2.4.1, 2.4.2 — protocolos RICE al Sprint 2.5 o Sprint 3
> - Con este corte el sprint queda en **25 pts** — más cercano a la capacidad real

---

## Definición de Terminado (DoD) — Sprint 2

Igual que Sprint 1, más:
- [ ] Validaciones con Zod en todos los endpoints que reciben body
- [ ] Ningún endpoint retorna el campo `password` de usuarios
- [ ] Transacciones de BD usadas en operaciones que tocan más de una tabla
- [ ] Casos de prueba en Insomnia para el happy path y al menos 2 casos de error por endpoint

---

## Contrato de API v2 — Nuevos endpoints

### POST `/api/v1/incidentes`
```json
// Request body
{
  "tipo_abordaje_id": 1,
  "fecha": "2026-06-15",
  "gravedad": "Grave",
  "relato": "Descripción detallada del incidente...",
  "medidas": "Medidas adoptadas por el inspector...",
  "estudiantes": [
    { "estudiante_id": "uuid", "es_victima": true, "observacion": "Estudiante afectado" },
    { "estudiante_id": "uuid", "es_victima": false, "observacion": "Estudiante agresor" }
  ]
}

// Response 201
{
  "status": "success",
  "message": "Incidente registrado exitosamente",
  "data": {
    "id": "uuid",
    "tenant_id": "uuid",
    "usuario_id": "uuid",
    "tipo_abordaje_id": 1,
    "fecha": "2026-06-15",
    "gravedad": "Grave",
    "relato": "...",
    "medidas": "...",
    "estado": "En Investigación",
    "fecha_creacion": "2026-06-15T20:00:00Z",
    "estudiantes": [...]
  }
}
```

### POST `/api/v1/estudiantes/importar`
```json
// Request: multipart/form-data con campo "archivo" (CSV o Excel)

// Response 200
{
  "status": "success",
  "message": "Importación completada",
  "data": {
    "importados": 450,
    "actualizados": 30,
    "errores": [
      { "fila": 12, "rut": "12.345.678-9", "motivo": "RUT inválido" },
      { "fila": 47, "rut": "", "motivo": "RUT requerido" }
    ]
  }
}
```

### PATCH `/api/v1/incidentes/:id/estado`
```json
// Request body
{
  "estado": "Derivado"
}

// Response 200
{
  "status": "success",
  "message": "Estado actualizado a Derivado",
  "data": {
    "id": "uuid",
    "estado": "Derivado",
    "updated_at": "2026-06-15T21:00:00Z"
  }
}
```
