# SIGA Escolar — Sprints Realizados

**Proyecto:** Sistema de Gestión y Acompañamiento Escolar  
**Cliente:** Escuela Coeducacional N°1 El Salvador, Atacama, Chile  
**Equipo:** Marcelo Acevedo Silva (Backend/PM) · Daniel Flores Jaime (Frontend/UI)  
**Metodología:** Scrum · Sprints de 1–2 semanas · Tablero Jira (SE)

---

## Resumen General

| Sprint | Nombre | Período | Story Points | Estado |
|--------|--------|---------|:---:|:---:|
| Sprint 1 | Infraestructura y Núcleo del Sistema | 02 jun – 15 jun 2025 | 34 | ✅ Completado |
| Sprint 2 | Lógica de Negocio y Módulos Core | 16 jun – 24 jun 2025 | 42 | ✅ Completado |
| Sprint 3 | Analítica, Reportería y Despliegue | 25 jun – 01 jul 2025 | 38 | ✅ Completado |
| **Total** | | **30 días** | **114** | |

---

## Sprint 1 — Infraestructura y Núcleo del Sistema

**Período:** 02 junio – 15 junio 2025  
**Story Points:** 34  
**Objetivo:** Establecer la base técnica del proyecto: base de datos multi-tenant, autenticación segura, middleware de seguridad y esqueleto del proyecto fullstack.

### Épica 1.1 — Diseño y Configuración de Base de Datos

#### Historia 1.1.1 — Diseño del Modelo Relacional
- Modelado de 14 tablas en PostgreSQL (Supabase)
- Arquitectura multi-tenant con `tenant_id` en todas las tablas
- Row Level Security (RLS) activado para aislamiento por establecimiento
- Función `set_tenant(p_tenant_id)` para activar contexto por request
- Extensión `unaccent` para búsqueda sin tildes
- Función `buscar_estudiantes()` para búsqueda accent-insensitive
- Trigger `trg_validar_protocolo_estudiante`: valida que el estudiante pertenezca al incidente al crear un protocolo RICE

**Tablas creadas:** `tenants`, `usuarios`, `cursos`, `estudiantes`, `apoderados`, `funcionarios`, `incidentes`, `incidente_estudiantes`, `tipos_abordaje`, `protocolos_rice`, `tipos_protocolo`, `notificaciones`, `auditoria`, `intentos_login`

#### Historia 1.1.2 — Configuración de Supabase
- Proyecto creado en Supabase (ID: `nosfdmgbxyypllpdnrct`)
- Schema SQL ejecutado correctamente con RLS habilitado
- Variables de entorno configuradas: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- Desactivación de RLS en tabla `auditoria` (escritura exclusiva desde backend con service key)

### Épica 1.2 — Backend Core (Node.js / Express)

#### Historia 1.2.1 — Setup del Proyecto Backend
- Inicialización del repositorio `siga-backend` con Node.js 22 + Express 5
- Estructura de carpetas: `controllers/`, `middlewares/`, `routes/`, `services/`, `utils/`
- Dependencias instaladas: `express`, `@supabase/supabase-js`, `dotenv`, `helmet`, `cors`, `jsonwebtoken`, `bcrypt`
- Configuración de Helmet (headers de seguridad HTTP)
- CORS con whitelist explícita: `localhost:5173`, `localhost:4173`
- Health check endpoint: `GET /api/v1/health`

#### Historia 1.2.2 — Sistema de Autenticación JWT
- `POST /api/v1/auth/login`: autenticación con email y contraseña
- `GET /api/v1/auth/me`: datos del usuario autenticado
- JWT con expiración de 8 horas, firmado con secret de 64 caracteres
- bcrypt con factor de coste 10 para hash de contraseñas
- Bloqueo de cuenta tras 5 intentos fallidos (registro en tabla `intentos_login`)
- Script `seed.js` para crear usuario administrador inicial (`admin@sigaescolar.cl`)

#### Historia 1.2.3 — Middlewares de Seguridad y RBAC
- `authenticateToken.js`: verifica y decodifica el JWT en cada request
- `setTenantContext.js`: activa RLS en Supabase llamando a `set_tenant()` RPC
- `requireRole(...roles)`: control de acceso por rol (5 roles: Administrador, Equipo de Formación, Directivo, Inspector, Docente)
- Cadena de middlewares: `authenticateToken → setTenantContext → requireRole → handler`
- Rutas públicas registradas antes de la cadena de middlewares globales

#### Historia 1.2.4 — Sistema de Auditoría
- `auditLogger.js`: middleware de bitácora con patrón fire-and-forget (`setImmediate`)
- Registra: `usuario_id`, `tenant_id`, `accion`, `tabla_afectada`, `registro_id`, `ip`, `user_agent`, `timestamp`
- Implementado en todos los endpoints de escritura
- Verificado funcionamiento en Supabase (tabla `auditoria`)

### Épica 1.3 — Frontend Base (React / Vite)

**Responsable:** Daniel Flores Jaime

- Inicialización del repositorio `siga-frontend` con React 18 + Vite 5 + Tailwind CSS 3
- Instalación de dependencias: `axios`, `zustand`, `react-router-dom`, `react-hook-form`, `lucide-react`, `recharts`
- Layout principal `DashboardLayout.jsx` con sidebar responsivo y header
- `useAuthStore.js` con Zustand y persistencia en localStorage
- Interceptores Axios: adjunta JWT automáticamente en cada request
- `AppRouter.jsx`, `PrivateRoute.jsx`, `RoleRoute.jsx` para navegación protegida
- `LoginPage.jsx` funcional con validación de formulario
- Proxy Vite (`/api → http://localhost:3000`) para desarrollo local

---

## Sprint 2 — Lógica de Negocio y Módulos Core

**Período:** 16 junio – 24 junio 2025  
**Story Points:** 42  
**Objetivo:** Desarrollar los módulos funcionales del negocio: gestión de usuarios, directorio de estudiantes con importación masiva, registro de incidentes con validación y notificaciones, y protocolos RICE.

### Épica 2.1 — Gestión de Usuarios

#### Historia 2.1.1 — RBAC Completo (remanente Sprint 1)
- Pruebas de cobertura completa del control de acceso por rol
- Verificación de todos los roles en endpoints críticos
- Confirmación de error 403 para accesos no autorizados

#### Historia 2.1.2 — CRUD de Usuarios
- `GET /api/v1/usuarios`: listar usuarios del tenant (solo Administrador)
- `POST /api/v1/usuarios`: crear nuevo usuario con rol asignado
- `PUT /api/v1/usuarios/:id`: actualizar datos del usuario
- `PATCH /api/v1/usuarios/:id/desactivar`: baja lógica (campo `activo = false`)
- Validación: email único por tenant, contraseña con requisitos de seguridad
- Frontend: `UsuariosPage.jsx`, `CrearUsuarioModal.jsx`, `EditarUsuarioModal.jsx`, `RolBadge.jsx`, `EstadoBadge.jsx`

### Épica 2.2 — Directorio de Estudiantes

#### Historia 2.2.1 — CRUD y Búsqueda de Estudiantes
- `GET /api/v1/estudiantes`: listar con filtros (`search`, `curso_id`, paginación)
- `GET /api/v1/estudiantes/:id/perfil`: perfil completo con datos del apoderado
- `POST /api/v1/estudiantes`: crear estudiante individual
- Búsqueda accent-insensitive con `.or(nombre.ilike, apellido.ilike, rut.ilike)`
- Validación de RUT chileno con algoritmo módulo 11 (`rutValidator.js`)
- Frontend: `EstudiantesPage.jsx`, `EstudiantePerfilPage.jsx`, `useDebounce.js`

#### Historia 2.2.2 — Importación Masiva CSV/Excel
- `POST /api/v1/estudiantes/importar`: carga masiva con multer + csv-parse + xlsx
- Dependencias: `multer`, `csv-parse`, `xlsx` (instaladas en `siga-backend/`)
- Columnas aceptadas: `rut`, `nombre`, `apellido`, `curso`, `apoderado_nombre`, `apoderado_apellido`, `apoderado_telefono`, `apoderado_email`
- Lógica upsert: si RUT existe → actualiza; si no → crea nuevo
- Creación automática de apoderado si viene en el CSV
- Creación automática de curso si no existe en el tenant
- Respuesta con contadores: `{ nuevos, actualizados, errores: [{rut, error}] }`
- Field name multer: `archivo` (campo en FormData del frontend)
- Frontend: `ImportarEstudiantesModal.jsx`, función `descargarPlantilla()` para CSV de ejemplo

### Épica 2.3 — Registro de Incidentes

#### Historia 2.3.1 — CRUD de Incidentes con Validación Zod
- `GET /api/v1/incidentes/tipos-abordaje`: catálogo de tipos de abordaje
- `GET /api/v1/incidentes`: listar con filtros por estado, gravedad, fecha
- `GET /api/v1/incidentes/:id`: detalle completo del incidente
- `POST /api/v1/incidentes`: registrar nuevo incidente con estudiantes involucrados
- `PATCH /api/v1/incidentes/:id/estado`: avanzar estado (flujo unidireccional)
- Validación con Zod v4: `z.coerce.number()` para `tipo_abordaje_id` (HTML select devuelve string)
- Parsing de errores Zod: `JSON.parse(resultado.error.message)` → array `.issues`
- Campos: `tipo_abordaje_id`, `fecha`, `gravedad` (Leve/Grave/Gravísima), `relato` (min 20 chars), `medidas`, array `estudiantes`
- Notificación automática fire-and-forget para incidentes Grave/Gravísima
- Frontend: `IncidentesPage.jsx`, `NuevoIncidentePage.jsx`, `IncidenteDetallePage.jsx`, `AlertaGrave.jsx`

### Épica 2.4 — Protocolos RICE

#### Historia 2.4.1 — Gestión de Protocolos RICE
- `GET /api/v1/protocolos/tipos-protocolo`: 10 tipos normativos (Mineduc)
- `GET /api/v1/protocolos`: listar protocolos del tenant
- `GET /api/v1/protocolos/:id`: detalle con estudiante e incidente vinculado
- `POST /api/v1/protocolos`: abrir protocolo vinculado a estudiante + incidente
- `PATCH /api/v1/protocolos/:id/estado`: avanzar estado del protocolo
- Validación de integridad via trigger BD: el `estudiante_id` debe pertenecer al `incidente_id`
- Estados del protocolo: `En Investigación → Derivado → Cerrado`
- Frontend: `ProtocolosPage.jsx`, `NuevoProtocoloPage.jsx`, `ProtocoloDetallePage.jsx`

### Épica 2.5 — Despliegue en Producción

#### Historia 2.5.1 — Deploy Backend (Render)
- Repositorio `siga-backend` pusheado a GitHub (`main`)
- Servicio Web creado en Render
- Comando de inicio: `node src/server.js` (no `npm start`)
- Variables de entorno configuradas en Render: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`, `NODE_ENV=production`
- URL producción: `https://siga-backend.onrender.com`

#### Historia 2.5.2 — Deploy Frontend (Vercel)
- Repositorio `siga-frontend` pusheado a GitHub (`main`)
- Proyecto creado en Vercel con detección automática de Vite
- Variable de entorno: `VITE_API_URL=https://siga-backend.onrender.com/api/v1`
- CORS actualizado en backend para incluir URL de Vercel
- URL producción: `https://siga-frontend-delta-six.vercel.app`

---

## Sprint 3 — Analítica, Reportería y Despliegue Completo

**Período:** 25 junio – 01 julio 2025  
**Story Points:** 38  
**Objetivo:** Dashboard analítico con datos reales, perfil completo del estudiante, exportación PDF institucional, preparación UAT y documentación de cierre.

### Épica 3.1 — Dashboard Analítico

#### Historia 3.1.1 — Endpoints de Analítica
- `GET /api/v1/dashboard/resumen`: KPIs principales
  - Total incidentes, incidentes graves, protocolos activos, estudiantes únicos con incidentes
- `GET /api/v1/dashboard/incidentes-por-curso`: datos para gráfico de barras (join incidente_estudiantes → estudiantes → cursos)
- `GET /api/v1/dashboard/por-gravedad`: distribución por gravedad con porcentajes
- `GET /api/v1/dashboard/tendencia-mensual`: serie temporal extrayendo `YYYY-MM` de `fecha`
- Roles con acceso: Administrador, Equipo de Formación, Directivo

#### Historia 3.1.2 — Integración Frontend Dashboard
- `DashboardPage.jsx` conectado a los 4 endpoints con `Promise.all`
- `KpiCards`: valores reales desde endpoint `/resumen`
- `BarChart`: componente SVG con prop `data: [{curso, total}]`
- `DonutChart`: componente SVG con prop `data: [{gravedad, cantidad, porcentaje}]`
- Gráfico de tendencia mensual
- Paleta de colores: `COLORS` para barras, `GRAVEDAD_COLORS` para torta
- Eliminación de datos hardcodeados que Daniel tenía en el componente inicial

### Épica 3.2 — Reportería y Exportación

#### Historia 3.2.1 — Perfil Completo de Estudiante
- `GET /api/v1/estudiantes/:id/perfil`: retorna datos personales, curso, apoderado, historial de incidentes
- Historial de incidentes via join `incidente_estudiantes → incidentes`
- Frontend `EstudiantePerfilPage.jsx`: muestra perfil completo con historial
- Botón PDF visible solo para roles Administrador y Equipo de Formación
- Botón deshabilitado con tooltip si el estudiante no tiene incidentes registrados

#### Historia 3.2.2 — Exportación PDF Institucional
- Dependencia: `pdfkit` instalado en `siga-backend/`
- `GET /api/v1/estudiantes/:id/pdf`: genera y descarga PDF (roles: Admin, Eq. Formación)
- `pdfService.js`: genera PDF con encabezado institucional (azul oscuro), datos del estudiante, historial de incidentes, sección de firmas
- Retorna `Buffer` via Promise, streamed a la respuesta con headers `Content-Disposition: attachment`
- Auditoría fire-and-forget con `tabla_afectada: 'reportes'`
- Frontend `descargarPDF(id, nombreArchivo)`: request con `responseType: 'blob'`, crea link temporal y dispara descarga

### Épica 3.3 — Apoderados

#### Historia 3.3.1 — Gestión de Apoderados via Importación
- Apoderado creado automáticamente al importar CSV si vienen campos `apoderado_nombre` + `apoderado_apellido`
- Relación `estudiantes → apoderados` (uno a uno por registro)
- Datos del apoderado visibles en `GET /api/v1/estudiantes/:id/perfil`
- Creación de curso automática si no existe en el tenant al importar

### Épica 3.4 — Calidad, UAT y Cierre

#### Historia 3.4.1 — Correcciones de Integración Frontend-Backend
Errores detectados y corregidos en la revisión de integración:

- `lucide-react` y `recharts` no instalados en `siga-frontend/` → `npm install lucide-react recharts`
- `EstudiantesPage.jsx`: tag JSX `</div>` no cerrado correctamente → corregido
- `buscarEstudiantes()` llamaba a `/estudiantes/buscar` (inexistente) → corregido a `/estudiantes?search=`
- `ImportarEstudiantesModal.jsx`: field name era `file` → corregido a `archivo` (multer)
- `DashboardPage.jsx`: datos hardcodeados reemplazados por llamadas reales a la API
- Nombres de campos: `medidas_adoptadas → medidas`, `observaciones_iniciales → observaciones`
- `getEstudianteById` llamaba a `/estudiantes/:id` → corregido a `/estudiantes/:id/perfil`

#### Historia 3.4.2 — Planificación y Documentación UAT
- Documento `UAT_SIGA_ESCOLAR.md` con 10 casos de prueba (CP-01 a CP-10)
- Casos bloqueantes: CP-01 (login), CP-03 (búsqueda), CP-04 (incidente), CP-06 (protocolo)
- Modalidad: remota vía WhatsApp con coordinador del establecimiento
- Usuario UAT creado: `roberto@sigaescolar.cl` (Rol: Equipo de Formación)
- Criterio de aprobación: 4 bloqueantes + mínimo 7/10 casos aprobados

#### Historia 3.4.3 — Documentación de Cierre de Proyecto
- `README.md` completo en raíz del monorepo con stack, arquitectura, endpoints, RBAC, setup local
- `CIERRE_PROYECTO_SIGA_ESCOLAR.docx`: documento formal de cierre con DoD, acta de conformidad
- `DOD_Y_UAT.md`: definición de Done y criterios de aceptación formales
- `SPRINTS_REALIZADOS.md`: este documento, resumen ejecutivo de los 3 sprints

---

## Decisiones Técnicas Relevantes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| Supabase JS client con RLS | Sequelize ORM | RLS nativo de PostgreSQL garantiza aislamiento multi-tenant sin lógica extra en código |
| Zod v4 para validación | Joi / express-validator | Mejor integración con TypeScript-ready y mensajes de error estructurados |
| pdfkit para PDF | Puppeteer / html-pdf | Sin dependencias de Chromium; más liviano para Render free tier |
| Fire-and-forget para auditoría | Auditoría síncrona | No impacta latencia del endpoint principal |
| SVG nativo para gráficos dashboard | recharts | Sin problemas de bundling; control total del render |
| multer para uploads | busboy directo | API más simple para manejo de multipart/form-data |

---

## Registro de Incidentes Técnicos

| # | Problema | Causa | Solución |
|---|----------|-------|----------|
| 1 | `node start` fallaba en Render | Comando de inicio incorrecto | `node src/server.js` |
| 2 | Zod `.errors` undefined | Zod v4 cambió la API | `JSON.parse(error.message)` → array `.issues` |
| 3 | `tipo_abordaje_id` falla validación | HTML `<select>` devuelve string | `z.coerce.number()` en el schema |
| 4 | multer `Unexpected field` | Frontend enviaba field `file`, backend esperaba `archivo` | Corregido en `ImportarEstudiantesModal.jsx` |
| 5 | CORS error en producción | URL Vercel no estaba en whitelist | Agregada a `ALLOWED_ORIGINS` en `app.js` |
| 6 | RLS bloqueaba inserts en `auditoria` | Service key respeta RLS por defecto | RLS desactivado en tabla `auditoria` |
| 7 | Supabase URL incorrecta | Dashboard URL ≠ API URL | `https://nosfdmgbxyypllpdnrct.supabase.co` |
| 8 | npm install en carpeta raíz | Error de directorio | Eliminados `package.json` y `node_modules` de raíz manualmente |
| 9 | Dashboard con datos hardcodeados | Daniel no conectó los endpoints reales | Integración completa con `Promise.all` |
| 10 | Error UUID `'1'` en importación | Curso creado como UUID pero estudiante esperaba integer | Corregido en `estudiantesService.js` |

---

## Velocidad por Sprint

| Sprint | Planificados | Completados | Velocidad |
|--------|:---:|:---:|:---:|
| Sprint 1 | 34 | 34 | 100% |
| Sprint 2 | 42 | 42 | 100% |
| Sprint 3 | 38 | 38 | 100% |
| **Total** | **114** | **114** | **100%** |

---

*Documento generado al cierre del proyecto SIGA Escolar*  
*Marcelo Acevedo Silva — Líder Backend / PM*  
*Daniel Flores Jaime — Líder Frontend / UI*  
*Julio 2025*
