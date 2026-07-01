# Diseño de Integración de Funcionalidades Enterprise - SIGA Escolar

**Fecha:** 2026-07-01  
**Proyecto:** SIGA Escolar (Sistema Integral de Gestión y Atención Escolar)  
**Alcance:** Integración de 15 funcionalidades enterprise-level para elevar el sistema a nivel producción  

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura de Alto Nivel](#arquitectura-de-alto-nivel)
3. [Funcionalidades por Capa](#funcionalidades-por-capa)
4. [Especificaciones Técnicas Detalladas](#especificaciones-técnicas-detalladas)
5. [Estructura de Archivos](#estructura-de-archivos)
6. [Dependencias](#dependencias)
7. [Base de Datos](#base-de-datos)
8. [Testing](#testing)
9. [CI/CD](#cicd)
10. [Consideraciones de Seguridad](#consideraciones-de-seguridad)

---

## Resumen Ejecutivo

Este diseño integra 15 funcionalidades enterprise en SIGA Escolar, transformándolo de un sistema CRUD funcional a una aplicación production-ready de nivel industrial. Las funcionalidades se organizan en 5 capas que se construyen unas sobre otras:

1. **Infraestructura** (logging, rate limiting, caché)
2. **Comunicación** (WebSockets, emails, notificaciones)
3. **Inteligencia** (analytics, búsqueda, predicción de riesgo)
4. **Experiencia** (PWA, dark mode, optimistic UI)
5. **Calidad** (testing, versionado API, auditoría avanzada)

---

## Arquitectura de Alto Nivel

### Flujo de Request Completo

```
┌─────────────┐
│   Cliente   │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP/WS
       ▼
┌─────────────────────────────────────────┐
│         NGINX (opcional)                │
│      Load Balancer / SSL Term           │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│      Express Middleware Chain           │
│  ┌──────────────────────────────────┐   │
│  │ 1. Rate Limiter                  │   │
│  │ 2. Request ID (UUID)             │   │
│  │ 3. Logger (entrada)              │   │
│  │ 4. Helmet (security headers)     │   │
│  │ 5. CORS                          │   │
│  │ 6. Auth (JWT verify)             │   │
│  │ 7. Tenant Context (RLS)          │   │
│  │ 8. Cache Check (Redis)           │   │
│  └──────────────────────────────────┘   │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│         Controllers                     │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│          Services                       │
│  ┌──────────────────────────────────┐   │
│  │ Business Logic                   │   │
│  │ ├─ Validation (Zod)              │   │
│  │ ├─ DB Operations                 │   │
│  │ ├─ Cache Invalidation            │   │
│  │ └─ Event Emission                │   │
│  └──────────────────────────────────┘   │
└──────┬──────────────────────────────────┘
       │
       ├────────────────┬────────────────┐
       ▼                ▼                ▼
   ┌────────┐     ┌─────────┐     ┌──────────┐
   │  Redis │     │ Supabase│     │Socket.io │
   │ Cache  │     │   DB    │     │ (notify) │
   └────────┘     └─────────┘     └──────────┘
       │                │                │
       └────────────────┴────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Response +     │
              │  Logger (salida)│
              └─────────────────┘
```

### Componentes Principales

#### Backend (Express + Node.js)
- **Puerto API REST:** 3000
- **Puerto WebSocket:** 3001 (Socket.io)
- **Base de datos:** Supabase (PostgreSQL)
- **Caché:** Redis (puerto 6379)
- **Queue:** Bull (sobre Redis)

#### Frontend (React + Vite)
- **Puerto dev:** 5173
- **Build output:** `dist/`
- **Service Worker:** PWA con Workbox
- **Estado global:** Zustand
- **WebSocket client:** Socket.io-client

---

## Funcionalidades por Capa

### CAPA 1: Infraestructura (Base para todo)

#### 1.1 Logging Estructurado (Winston + Sentry)

**Objetivo:** Trazabilidad completa de requests, errores y eventos del sistema.

**Implementación:**
- Winston con transports a archivos rotados + consola
- Sentry para captura de excepciones y stack traces
- Middleware que genera `requestId` (UUID) para correlación
- Logs estructurados en formato JSON

**Niveles:**
- `error`: Errores críticos que requieren atención inmediata
- `warn`: Situaciones anómalas pero no críticas
- `info`: Eventos importantes del sistema (login, creación de incidentes)
- `http`: Logs de requests HTTP
- `debug`: Información detallada para debugging

**Formato de log:**
```json
{
  "timestamp": "2026-07-01T10:30:45.123Z",
  "level": "info",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "user-456",
  "tenantId": "tenant-789",
  "method": "POST",
  "url": "/api/v1/incidentes",
  "statusCode": 201,
  "responseTime": "45ms",
  "message": "Incidente creado exitosamente"
}
```

**Rotación de archivos:**
- `logs/app-%DATE%.log`: Todos los logs (max 14 días)
- `logs/error-%DATE%.log`: Solo errores (max 30 días)

---

#### 1.2 Rate Limiting + Security Hardening

**Objetivo:** Proteger la API de abusos, ataques de fuerza bruta y vulnerabilidades comunes.

**Rate Limiting por Endpoint:**

| Endpoint | Límite | Ventana | Motivo |
|----------|--------|---------|--------|
| `/api/v1/auth/login` | 5 requests | 15 min | Prevenir fuerza bruta |
| `/api/v1/auth/*` | 20 requests | 15 min | Proteger auth endpoints |
| `/api/v1/*` (general) | 100 requests | 15 min | Uso general |
| Usuario autenticado | 200 requests | 15 min | Usuarios legítimos más permiso |

**Security Headers (Helmet):**
```javascript
{
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'same-origin' }
}
```

**Sanitización:**
- Validación con Zod (ya implementado) en todos los inputs
- Prevención de SQL injection (queries parametrizados)
- Escape de HTML en outputs

---

#### 1.3 Sistema de Caché con Redis

**Objetivo:** Reducir latencia de queries frecuentes de 500-2000ms a <50ms.

**Patrón Cache-Aside:**
1. Request llega
2. Check Redis por clave (`dashboard:stats:tenant-123`)
3. Si hit → return datos cacheados
4. Si miss → query DB → store en Redis con TTL → return datos

**Estrategia de Caché:**

| Recurso | TTL | Invalidación |
|---------|-----|--------------|
| Dashboard stats | 5 min | Al crear/actualizar incidente |
| Lista estudiantes | 10 min | Al crear/actualizar estudiante |
| Lista incidentes | 5 min | Al crear/actualizar incidente |
| Tipos abordaje/protocolo | 1 hora | Al actualizar catálogos (raro) |
| Perfil usuario | 30 min | Al actualizar usuario |

**Invalidación Inteligente:**
- Al crear incidente → invalida: `incidentes:list:tenant-X`, `dashboard:stats:tenant-X`
- Al actualizar estudiante → invalida: `estudiantes:list:tenant-X`, `estudiante:detail:id-Y`

**Keys en Redis:**
```
dashboard:stats:tenant-{tenantId}
estudiantes:list:tenant-{tenantId}
incidentes:list:tenant-{tenantId}:page-{page}
estudiante:detail:{estudianteId}
tipos:abordaje
tipos:protocolo
```

---

### CAPA 2: Comunicación (Sistema Nervioso)

#### 2.1 Notificaciones en Tiempo Real (WebSockets)

**Objetivo:** Actualizar UI instantáneamente cuando ocurren eventos relevantes.

**Tecnología:** Socket.io (WebSocket + fallback a polling)

**Arquitectura:**
```
Backend (Express) ──┬── HTTP Server (puerto 3000)
                    └── Socket.io Server (puerto 3001)

Frontend ────────────── Socket.io Client
```

**Eventos a emitir:**

| Evento | Cuándo | Payload | Receptores |
|--------|--------|---------|------------|
| `incidente:nuevo` | Se crea incidente | `{ id, titulo, gravedad }` | Admins + Coordinadores |
| `protocolo:asignado` | Se asigna protocolo | `{ id, estudianteNombre }` | Usuario asignado |
| `notificacion:nueva` | Cualquier notificación | `{ tipo, titulo, mensaje, url }` | Usuario específico |
| `dashboard:actualizado` | Cambio en stats | `{ stats }` | Todos viendo dashboard |

**Rooms de Socket.io:**
- `tenant-{tenantId}`: Todos los usuarios del tenant
- `user-{userId}`: Usuario específico (notificaciones privadas)
- `role-{rol}`: Por rol (ej: solo admins)

**Conexión:**
```javascript
// Cliente se conecta con token JWT
io.connect('http://localhost:3001', {
  auth: { token: localStorage.getItem('token') }
})

// Backend valida token y une a rooms
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  const user = verifyToken(token)
  socket.userId = user.id
  socket.tenantId = user.tenantId
  socket.join(`tenant-${user.tenantId}`)
  socket.join(`user-${user.id}`)
  next()
})
```

**Centro de Notificaciones (UI):**
- Badge en navbar con contador de no leídas
- Drawer lateral con listado
- Marcar como leída al hacer click
- Deep links a la entidad relacionada

---

#### 2.2 Sistema de Comunicación Integrado (Emails + Queue)

**Objetivo:** Enviar emails a apoderados y profesores de forma asíncrona y confiable.

**Arquitectura:**
```
Service emite evento ─→ Bull Queue (Redis) ─→ Worker procesa ─→ Nodemailer envía
                                                     ↓
                                          Retry automático (3 intentos)
```

**Cuándo enviar emails:**
- Incidente Grave/Gravísimo creado → email a apoderado del estudiante
- Protocolo RICE abierto → email a apoderado
- Protocolo vencido sin cerrar → email a coordinador
- Reporte mensual automático → email a directivos

**Templates:**
- HTML responsive con logo del establecimiento
- Variables: `{estudianteNombre}`, `{incidenteFecha}`, `{gravedadLabel}`

**Queue Config:**
```javascript
{
  attempts: 3,  // Reintentos
  backoff: {
    type: 'exponential',
    delay: 2000  // 2s, 4s, 8s
  },
  removeOnComplete: true,
  removeOnFail: false  // Mantener fallidos para debug
}
```

---

#### 2.3 Búsqueda Full-Text + Filtros Avanzados

**Objetivo:** Buscar estudiantes e incidentes por texto natural con resultados relevantes.

**Tecnología:** PostgreSQL `tsvector` (full-text search nativo)

**Implementación:**
1. Agregar columna `search_vector tsvector` a `estudiantes` e `incidentes`
2. Trigger que actualiza `search_vector` automáticamente en INSERT/UPDATE
3. Índice GIN en `search_vector` para búsquedas rápidas

**Búsqueda en estudiantes:**
```sql
SELECT * FROM estudiantes
WHERE search_vector @@ to_tsquery('spanish', 'juan:*')
  AND tenant_id = $1
ORDER BY ts_rank(search_vector, to_tsquery('spanish', 'juan:*')) DESC
LIMIT 20;
```

**Búsqueda en incidentes:**
```sql
SELECT * FROM incidentes
WHERE search_vector @@ to_tsquery('spanish', 'pelea & patio:*')
  AND tenant_id = $1
  AND fecha >= $2  -- filtro adicional
ORDER BY fecha DESC
LIMIT 20;
```

**Autocompletado:**
- Frontend hace request después de 3 caracteres con debounce de 300ms
- Backend retorna top 10 matches

**Filtros guardados:**
- Usuarios pueden guardar combinaciones de filtros
- Tabla `busquedas_guardadas` con columna JSONB
- Quick access desde UI

---

### CAPA 3: Inteligencia (Cerebro del Sistema)

#### 3.1 Analytics Dashboard Avanzado

**Objetivo:** Visualizar métricas clave con gráficos interactivos para toma de decisiones.

**Librería:** Recharts (ligera, responsive, React-friendly)

**KPIs en Dashboard:**

1. **Resumen General (Cards)**
   - Total incidentes mes actual
   - Variación vs mes anterior (↑ +15% o ↓ -8%)
   - Incidentes abiertos
   - Estudiantes con > 3 incidentes (alertas)

2. **Tendencia de Incidentes (Line Chart)**
   - Eje X: Últimos 12 meses
   - Eje Y: Cantidad de incidentes
   - Series: Por gravedad (Leve, Grave, Gravísimo)
   - Tooltip: Detalle al hover

3. **Distribución por Gravedad (Donut Chart)**
   - Leve: X%
   - Grave: Y%
   - Gravísimo: Z%
   - Centro: Total incidentes

4. **Heatmap por Curso**
   - Filas: Cursos (1°A, 1°B, ..., 8°B)
   - Columnas: Meses
   - Color: Intensidad según cantidad incidentes
   - Scale: Verde (0-5) → Amarillo (6-15) → Rojo (16+)

5. **Top 5 Estudiantes con más Incidentes**
   - Bar chart horizontal
   - Nombre + cantidad
   - Click para ir a perfil

6. **Tiempo Promedio de Resolución**
   - Gauge chart
   - Meta: < 7 días
   - Actual: X días

**Filtros del Dashboard:**
- Rango de fechas (último mes, 3 meses, 6 meses, año, custom)
- Por curso
- Por gravedad
- Por estado (abierto, cerrado)

**Exportación:**
- Botón "Exportar a Excel"
- Genera XLSX con datos del período seleccionado
- Incluye gráficos como imágenes (opcional)

---

#### 3.2 Sistema de Predicción de Riesgo

**Objetivo:** Identificar proactivamente estudiantes en riesgo de deserción o problemas graves.

**Algoritmo (heurístico simple pero efectivo):**

```javascript
function calcularRiesgo(estudiante, incidentesUltimos3Meses) {
  let score = 0
  
  // Factor 1: Frecuencia
  const cantidad = incidentesUltimos3Meses.length
  if (cantidad >= 5) score += 40
  else if (cantidad >= 3) score += 25
  else if (cantidad >= 2) score += 10
  
  // Factor 2: Gravedad
  const gravisimoCount = incidentesUltimos3Meses.filter(i => i.gravedad === 'Gravísima').length
  score += gravisimoCount * 20
  
  const graveCount = incidentesUltimos3Meses.filter(i => i.gravedad === 'Grave').length
  score += graveCount * 10
  
  // Factor 3: Tendencia (crecimiento)
  const ultimoMes = incidentesUltimos3Meses.filter(i => estaEnUltimoMes(i.fecha)).length
  const penultimoMes = incidentesUltimos3Meses.filter(i => estaEnPenultimoMes(i.fecha)).length
  if (ultimoMes > penultimoMes * 1.5) score += 15  // Crecimiento > 50%
  
  // Factor 4: Protocolos RICE abiertos
  if (estudiante.protocolosAbiertos > 0) score += 15
  
  // Factor 5: Reincidencia rápida (2+ incidentes en misma semana)
  const tieneReincidenciaRapida = verificarReincidenciaRapida(incidentesUltimos3Meses)
  if (tieneReincidenciaRapida) score += 20
  
  // Normalizar a 0-100
  score = Math.min(score, 100)
  
  return {
    score,
    nivel: score >= 70 ? 'ALTO' : score >= 40 ? 'MEDIO' : 'BAJO',
    color: score >= 70 ? 'red' : score >= 40 ? 'yellow' : 'green'
  }
}
```

**Dashboard de Alertas Tempranas:**
- Lista de estudiantes con score >= 40 (riesgo medio/alto)
- Ordenados por score DESC
- Incluye: nombre, curso, score, últimos 3 incidentes
- Acción sugerida: "Programar entrevista con apoderado"

**Recalculo:**
- Job que corre diariamente a las 6am
- Actualiza scores de todos los estudiantes activos
- Genera notificación a coordinadores si aparecen nuevos estudiantes en riesgo alto

---

### CAPA 4: Experiencia de Usuario (Cara al Usuario)

#### 4.1 PWA (Progressive Web App)

**Objetivo:** App instalable, que funciona offline y da experiencia nativa.

**Manifest (`public/manifest.json`):**
```json
{
  "name": "SIGA Escolar",
  "short_name": "SIGA",
  "description": "Sistema Integral de Gestión y Atención Escolar",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Service Worker (Workbox):**
- Cache-first para assets estáticos (JS, CSS, imágenes)
- Network-first para API requests
- Offline fallback page cuando no hay internet

**Estrategia de Caché:**
```javascript
// Precache (al instalar SW)
- /index.html
- /assets/*.js
- /assets/*.css
- /icons/*

// Runtime cache
- API /estudiantes → 5 min
- API /dashboard → 3 min
- Imágenes → 1 día
```

**Offline Queue:**
- Mutations (POST, PUT, DELETE) se guardan en IndexedDB cuando offline
- Al reconectar, se envían automáticamente en orden
- UI muestra badge "Pendiente de sincronizar"

---

#### 4.2 Optimistic UI

**Objetivo:** UI responde instantáneamente, antes de confirmación del servidor.

**Patrón:**
1. Usuario hace acción (ej: marcar notificación como leída)
2. UI actualiza inmediatamente (optimista)
3. Request va al backend
4. Si success → nada (ya estaba actualizado)
5. Si error → rollback + mostrar error

**Ejemplo:**
```javascript
function marcarComoLeida(notifId) {
  // 1. Actualización optimista
  setNotificaciones(prev => 
    prev.map(n => n.id === notifId ? {...n, leida: true} : n)
  )
  
  // 2. Request al backend
  api.patch(`/notificaciones/${notifId}`, { leida: true })
    .catch(error => {
      // 3. Rollback si falla
      setNotificaciones(prev => 
        prev.map(n => n.id === notifId ? {...n, leida: false} : n)
      )
      toast.error('Error al marcar como leída')
    })
}
```

**Casos de uso:**
- Marcar notificaciones leídas/no leídas
- Toggle favorito en búsquedas guardadas
- Cambios simples de estado

---

#### 4.3 Sistema de Temas + Dark Mode

**Objetivo:** Preferencia de usuario para modo claro/oscuro, persistente.

**Implementación:**
- Context API: `ThemeProvider`
- Estado en Zustand: `useThemeStore`
- Persiste en localStorage: `theme: 'light' | 'dark' | 'auto'`
- Auto: detecta preferencia del sistema con `prefers-color-scheme`

**Paleta de Colores:**

| Color | Light | Dark |
|-------|-------|------|
| Background | `#ffffff` | `#1a1a1a` |
| Surface | `#f9fafb` | `#2d2d2d` |
| Primary | `#3b82f6` | `#60a5fa` |
| Text | `#111827` | `#f9fafb` |
| Text Secondary | `#6b7280` | `#9ca3af` |
| Border | `#e5e7eb` | `#374151` |

**Tailwind Config:**
```javascript
darkMode: 'class',  // <html class="dark">
theme: {
  extend: {
    colors: {
      background: 'var(--color-background)',
      surface: 'var(--color-surface)',
      // ...
    }
  }
}
```

**Toggle:**
- Botón en navbar (icono sol/luna)
- Menú dropdown: Claro, Oscuro, Auto (sistema)
- Transición suave con CSS

---

#### 4.4 Accesibilidad (WCAG 2.1 Level AA)

**Objetivo:** App usable por personas con discapacidades.

**Checklist:**

1. **Contraste de colores:**
   - Ratio mínimo 4.5:1 para texto normal
   - Ratio mínimo 3:1 para texto grande
   - Validar con herramientas (Axe, Wave)

2. **Navegación por teclado:**
   - Todos los elementos interactivos accesibles con Tab
   - Focus visible (outline)
   - Skip links ("Saltar al contenido principal")

3. **ARIA labels:**
   - Botones sin texto → `aria-label="Cerrar"`
   - Campos de formulario → `<label>` asociado o `aria-label`
   - Estados dinámicos → `aria-live="polite"` para notificaciones

4. **Landmarks:**
   - `<header>`, `<nav>`, `<main>`, `<aside>`, `<footer>`
   - Roles ARIA cuando HTML semántico no alcanza

5. **Imágenes:**
   - `alt` text descriptivo
   - Decorativas: `alt=""`

6. **Forms:**
   - Labels visibles
   - Errores de validación asociados con `aria-describedby`
   - Required fields marcados

7. **Screen readers:**
   - Testear con NVDA (Windows) o VoiceOver (Mac)

---

### CAPA 5: Calidad y Mantenibilidad

#### 5.1 Testing Suite Completo

**Objetivo:** Confianza en deploys, prevenir regresiones.

**Estructura:**

```
tests/
├── unit/                    # Jest (backend) / Vitest (frontend)
│   ├── services/
│   │   ├── estudiantesService.test.js
│   │   ├── incidentesService.test.js
│   │   └── riskService.test.js
│   └── utils/
│       ├── logger.test.js
│       └── cache.test.js
│
├── integration/             # Supertest (API endpoints)
│   ├── auth.test.js
│   ├── estudiantes.test.js
│   ├── incidentes.test.js
│   └── dashboard.test.js
│
└── e2e/                     # Playwright (user flows)
    ├── login.spec.js
    ├── crear-incidente.spec.js
    └── dashboard.spec.js
```

**Coverage mínimo:** 70% de líneas

**Unit Tests (ejemplo):**
```javascript
// tests/unit/services/riskService.test.js
describe('calcularRiesgo', () => {
  it('debe retornar riesgo ALTO con 5+ incidentes gravísimos', () => {
    const incidentes = [
      { gravedad: 'Gravísima', fecha: '2026-06-15' },
      { gravedad: 'Gravísima', fecha: '2026-06-20' },
      { gravedad: 'Gravísima', fecha: '2026-06-25' },
      { gravedad: 'Gravísima', fecha: '2026-06-28' },
      { gravedad: 'Gravísima', fecha: '2026-06-30' },
    ]
    const resultado = calcularRiesgo(estudiante, incidentes)
    expect(resultado.nivel).toBe('ALTO')
    expect(resultado.score).toBeGreaterThanOrEqual(70)
  })
})
```

**Integration Tests (ejemplo):**
```javascript
// tests/integration/estudiantes.test.js
describe('POST /api/v1/estudiantes', () => {
  it('debe crear estudiante y retornar 201', async () => {
    const response = await request(app)
      .post('/api/v1/estudiantes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rut: '12345678-9',
        nombre: 'Juan',
        apellido: 'Pérez',
        curso_id: cursoId
      })
    
    expect(response.status).toBe(201)
    expect(response.body.data).toHaveProperty('id')
  })
})
```

**E2E Tests (ejemplo):**
```javascript
// tests/e2e/crear-incidente.spec.js
test('coordinador puede crear incidente', async ({ page }) => {
  await page.goto('http://localhost:5173/login')
  await page.fill('input[name="email"]', 'coord@test.cl')
  await page.fill('input[name="password"]', 'test123')
  await page.click('button[type="submit"]')
  
  await page.click('text=Incidentes')
  await page.click('text=Nuevo Incidente')
  await page.selectOption('select[name="gravedad"]', 'Grave')
  await page.fill('textarea[name="relato"]', 'Pelea en el patio')
  await page.click('button:has-text("Guardar")')
  
  await expect(page.locator('text=Incidente creado')).toBeVisible()
})
```

---

#### 5.2 Versionado de API

**Objetivo:** Evolucionar API sin romper clientes existentes.

**Estrategia:** URL-based versioning

**Estructura:**
```
/api/v1/*  (actual, estable)
/api/v2/*  (futura, breaking changes)
```

**Deprecation:**
- Header `X-API-Deprecation: true` en v1
- Header `X-API-Upgrade: Use /api/v2/estudiantes instead`
- Documentar sunset date (ej: v1 se apaga en 6 meses)

**Mantenimiento:**
- v1 se mantiene durante período de transición
- v2 recibe nuevas features
- Ambas versiones pueden coexistir

**Ejemplo breaking change:**
```
// v1: estudiante.curso = "5°A" (string)
// v2: estudiante.curso = { id, nombre: "5°A" } (objeto)
```

---

#### 5.3 Sistema de Auditoría Avanzado

**Objetivo:** Timeline visual de cambios, diff antes/después.

**Tabla `auditoria` (ya existe, expandir):**
```sql
CREATE TABLE auditoria (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  usuario_id UUID,
  accion VARCHAR(20),  -- CREATE, UPDATE, DELETE, LOGIN, etc.
  tabla_afectada VARCHAR(100),
  registro_id UUID,
  detalle JSONB,  -- { before: {...}, after: {...} }
  ip VARCHAR(45),
  user_agent TEXT,  -- NUEVO
  fecha_hora TIMESTAMP DEFAULT NOW()
);
```

**Mejoras:**
1. **Diff Visual en UI:**
   - Componente que muestra before/after lado a lado
   - Resalta campos que cambiaron
   - Usa diff library (react-diff-viewer)

2. **Timeline de Entidad:**
   - GET `/auditoria/estudiante/:id/timeline`
   - Retorna array de eventos ordenados por fecha
   - UI: componente vertical con iconos por tipo de acción

3. **Búsqueda en Auditoría:**
   - Filtros: usuario, tabla, fecha range, acción
   - Full-text en campo `detalle`

4. **Exportación:**
   - Descargar logs de auditoría en CSV/JSON
   - Por rango de fechas

---

#### 5.4 Generación de Reportes Automáticos (PDF)

**Objetivo:** PDFs profesionales con gráficos y datos del sistema.

**Tecnología:** Puppeteer (headless Chrome)

**Tipos de Reportes:**

1. **Historial Conductual de Estudiante**
   - Ya implementado (PDFKit)
   - Mejorar: agregar gráfico de tendencia de incidentes

2. **Reporte Mensual Institucional**
   - Stats generales del mes
   - Gráficos (charts exportados como imágenes)
   - Comparativa con mes anterior
   - Auto-generado el día 1 de cada mes (cron job)

3. **Reporte de Protocolo RICE**
   - Detalles del protocolo
   - Acciones tomadas
   - Timeline de eventos
   - Firmas digitales

**Generación:**
```javascript
async function generarReporteMensual(tenantId, mes, anio) {
  // 1. Obtener datos
  const stats = await dashboardService.getStats(tenantId, mes, anio)
  
  // 2. Renderizar HTML con template
  const html = render(reporteTemplate, { stats, mes, anio })
  
  // 3. Puppeteer: HTML → PDF
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.setContent(html)
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '1cm', bottom: '1cm', left: '1.5cm', right: '1.5cm' }
  })
  await browser.close()
  
  return pdf
}
```

**Almacenamiento:**
- PDFs en Supabase Storage (bucket `reportes/`)
- Metadata en tabla `reportes_generados`

---

## Especificaciones Técnicas Detalladas

### Estructura de Archivos

#### Backend

```
siga-backend/
├── src/
│   ├── app.js                       # Express app config
│   ├── server.js                    # Server bootstrap
│   │
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── estudiantesController.js
│   │   ├── incidentesController.js
│   │   ├── protocolosController.js
│   │   ├── usuariosController.js
│   │   ├── dashboardController.js
│   │   ├── notificationsController.js   # NUEVO
│   │   ├── searchController.js          # NUEVO
│   │   └── reportsController.js         # NUEVO
│   │
│   ├── services/
│   │   ├── authService.js
│   │   ├── estudiantesService.js
│   │   ├── incidentesService.js
│   │   ├── protocolosService.js
│   │   ├── usuariosService.js
│   │   ├── dashboardService.js
│   │   ├── pdfService.js
│   │   ├── notificacionService.js       # ACTUALIZAR
│   │   ├── emailService.js              # NUEVO
│   │   ├── searchService.js             # NUEVO
│   │   ├── riskService.js               # NUEVO
│   │   └── reportService.js             # NUEVO
│   │
│   ├── middlewares/
│   │   ├── authMiddleware.js
│   │   ├── roleMiddleware.js
│   │   ├── tenantMiddleware.js
│   │   ├── auditMiddleware.js
│   │   ├── logging.js                   # NUEVO
│   │   ├── rateLimiter.js               # NUEVO
│   │   ├── security.js                  # NUEVO
│   │   ├── cache.js                     # NUEVO
│   │   └── requestId.js                 # NUEVO
│   │
│   ├── routes/
│   │   ├── index.js                     # Root router
│   │   ├── auth.routes.js
│   │   ├── estudiantes.routes.js
│   │   ├── incidentes.routes.js
│   │   ├── protocolos.routes.js
│   │   ├── usuarios.routes.js
│   │   ├── dashboard.routes.js
│   │   ├── notifications.routes.js      # NUEVO
│   │   ├── search.routes.js             # NUEVO
│   │   └── reports.routes.js            # NUEVO
│   │
│   ├── sockets/
│   │   └── index.js                     # NUEVO - Socket.io setup
│   │
│   ├── utils/
│   │   ├── db.js                        # Supabase client
│   │   ├── seed.js
│   │   ├── logger.js                    # NUEVO - Winston config
│   │   ├── sentry.js                    # NUEVO - Sentry init
│   │   ├── redis.js                     # NUEVO - Redis client
│   │   ├── cacheInvalidator.js          # NUEVO - Cache helpers
│   │   ├── queue.js                     # NUEVO - Bull config
│   │   ├── emailTemplates.js            # NUEVO - HTML templates
│   │   └── riskScoring.js               # NUEVO - Scoring algorithm
│   │
│   └── workers/
│       ├── emailWorker.js               # NUEVO - Email queue processor
│       └── reportWorker.js              # NUEVO - Auto-report generator
│
├── tests/
│   ├── unit/                            # NUEVO
│   │   ├── services/
│   │   └── utils/
│   ├── integration/                     # NUEVO
│   │   └── *.test.js
│   └── e2e/                             # NUEVO
│       └── *.spec.js
│
├── logs/                                # NUEVO - Winston logs
│   ├── app-%DATE%.log
│   └── error-%DATE%.log
│
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-07-01-enterprise-features-integration-design.md
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── jest.config.js                       # NUEVO
├── playwright.config.js                 # NUEVO
└── README.md
```

---

#### Frontend

```
siga-frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   │
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx            # ACTUALIZAR - nuevo analytics
│   │   ├── EstudiantesPage.jsx
│   │   ├── EstudiantePerfilPage.jsx
│   │   ├── IncidentesPage.jsx
│   │   ├── IncidenteDetallePage.jsx
│   │   ├── NuevoIncidentePage.jsx
│   │   ├── ProtocolosPage.jsx
│   │   ├── ProtocoloDetallePage.jsx
│   │   ├── NuevoProtocoloPage.jsx
│   │   ├── UsuariosPage.jsx
│   │   ├── UnauthorizedPage.jsx
│   │   ├── AnalyticsPage.jsx            # NUEVO - Dashboard avanzado
│   │   └── AlertasTempranas.jsx         # NUEVO - Risk scoring UI
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── DashboardLayout.jsx
│   │   │   ├── Navbar.jsx               # ACTUALIZAR - notifications badge
│   │   │   └── Sidebar.jsx
│   │   │
│   │   ├── notifications/               # NUEVO
│   │   │   ├── NotificationCenter.jsx   # Drawer
│   │   │   ├── NotificationBadge.jsx    # Badge contador
│   │   │   └── NotificationItem.jsx     # Item individual
│   │   │
│   │   ├── analytics/                   # NUEVO
│   │   │   ├── AnalyticsDashboard.jsx
│   │   │   ├── TrendChart.jsx           # Recharts line
│   │   │   ├── DonutChart.jsx           # Recharts pie
│   │   │   ├── HeatmapCursos.jsx        # Custom heatmap
│   │   │   ├── KPICard.jsx              # Métricas cards
│   │   │   └── TopEstudiantes.jsx       # Bar chart
│   │   │
│   │   ├── search/                      # NUEVO
│   │   │   ├── GlobalSearch.jsx         # Barra búsqueda
│   │   │   ├── SearchResults.jsx
│   │   │   └── SearchFilters.jsx        # Filtros avanzados
│   │   │
│   │   ├── reports/                     # NUEVO
│   │   │   ├── ReportGenerator.jsx
│   │   │   └── ReportPreview.jsx
│   │   │
│   │   ├── theme/                       # NUEVO
│   │   │   ├── ThemeToggle.jsx          # Switch dark/light
│   │   │   └── ThemeProvider.jsx        # Context provider
│   │   │
│   │   ├── estudiantes/
│   │   │   ├── EstudianteCard.jsx
│   │   │   └── ImportarEstudiantesModal.jsx
│   │   │
│   │   ├── incidentes/
│   │   │   ├── IncidenteCard.jsx
│   │   │   └── IncidenteForm.jsx
│   │   │
│   │   ├── usuarios/
│   │   │   └── UsuarioForm.jsx
│   │   │
│   │   └── shared/
│   │       ├── Button.jsx
│   │       ├── Input.jsx
│   │       ├── Modal.jsx
│   │       ├── Toast.jsx
│   │       └── LoadingSpinner.jsx
│   │
│   ├── hooks/
│   │   ├── useDebounce.js
│   │   ├── useWebSocket.js              # NUEVO
│   │   ├── useNotifications.js          # NUEVO
│   │   ├── useCache.js                  # NUEVO - localStorage
│   │   ├── useOffline.js                # NUEVO
│   │   └── useTheme.js                  # NUEVO
│   │
│   ├── services/
│   │   ├── api.js                       # Axios instance
│   │   ├── authService.js
│   │   ├── socketService.js             # NUEVO - Socket.io client
│   │   ├── notificationService.js       # NUEVO
│   │   ├── searchService.js             # NUEVO
│   │   └── reportService.js             # NUEVO
│   │
│   ├── store/
│   │   ├── useAuthStore.js              # Zustand
│   │   ├── useNotificationStore.js      # NUEVO
│   │   ├── useThemeStore.js             # NUEVO
│   │   └── useOfflineStore.js           # NUEVO - queue mutations
│   │
│   ├── router/
│   │   ├── AppRouter.jsx
│   │   └── PrivateRoute.jsx
│   │
│   ├── utils/
│   │   └── exportUtils.js
│   │
│   ├── workers/
│   │   └── service-worker.js            # NUEVO - PWA SW
│   │
│   └── assets/
│       ├── logo.svg
│       └── icons/
│
├── public/
│   ├── manifest.json                    # NUEVO - PWA manifest
│   ├── sw.js                            # NUEVO - SW build output
│   └── icons/                           # NUEVO - PWA icons
│       ├── icon-192.png
│       └── icon-512.png
│
├── tests/
│   ├── unit/                            # NUEVO - Vitest
│   │   └── components/
│   └── e2e/                             # NUEVO - Playwright
│       └── *.spec.js
│
├── .env.local
├── .env.example
├── .gitignore
├── package.json
├── vite.config.js                       # ACTUALIZAR - PWA plugin
├── vitest.config.js                     # NUEVO
├── playwright.config.js                 # NUEVO
├── tailwind.config.js                   # ACTUALIZAR - dark mode
└── README.md
```

---

### Dependencias

#### Backend (package.json)

```json
{
  "name": "siga-backend",
  "version": "2.0.0",
  "description": "Backend API para Sistema Integral de Gestión y Atención Escolar (SIGA)",
  "main": "src/server.js",
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js",
    "seed": "node src/utils/seed.js",
    "lint": "eslint src/**/*.js",
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "playwright test",
    "worker:email": "node src/workers/emailWorker.js",
    "worker:reports": "node src/workers/reportWorker.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.108.1",
    "bcrypt": "^6.0.0",
    "cors": "^2.8.6",
    "csv-parse": "^7.0.0",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "helmet": "^8.2.0",
    "jsonwebtoken": "^9.0.3",
    "multer": "^2.2.0",
    "pdfkit": "^0.19.1",
    "pg": "^8.21.0",
    "xlsx": "^0.18.5",
    "zod": "^4.4.3",
    "winston": "^3.11.0",
    "winston-daily-rotate-file": "^4.7.1",
    "@sentry/node": "^7.91.0",
    "express-rate-limit": "^7.1.5",
    "redis": "^4.6.11",
    "bull": "^4.12.0",
    "nodemailer": "^6.9.7",
    "socket.io": "^4.6.0",
    "puppeteer": "^21.6.1",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "eslint": "^10.4.1",
    "nodemon": "^3.1.14",
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "@playwright/test": "^1.40.1"
  }
}
```

---

#### Frontend (package.json)

```json
{
  "name": "siga-frontend",
  "version": "2.0.0",
  "description": "Frontend para Sistema Integral de Gestión y Atención Escolar (SIGA)",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext js,jsx",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    "zustand": "^4.4.7",
    "axios": "^1.6.2",
    "socket.io-client": "^4.6.0",
    "recharts": "^2.10.3",
    "react-hot-toast": "^2.4.1",
    "workbox-window": "^7.0.0",
    "localforage": "^1.10.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "eslint": "^8.55.0",
    "eslint-plugin-react": "^7.33.2",
    "vitest": "^1.0.4",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5",
    "@playwright/test": "^1.40.1",
    "vite-plugin-pwa": "^0.17.4"
  }
}
```

---

### Base de Datos

#### Nuevas Tablas

```sql
-- =============================================================================
-- CENTRO DE NOTIFICACIONES
-- =============================================================================
CREATE TABLE notificaciones_centro (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
    'incidente_nuevo',
    'protocolo_asignado',
    'protocolo_vencido',
    'estudiante_riesgo',
    'reporte_generado'
  )),
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT NOT NULL,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  url VARCHAR(500),  -- Deep link: /incidentes/123
  metadata JSONB,    -- { incidenteId, estudianteNombre, etc }
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notif_centro_usuario ON notificaciones_centro(usuario_id, leida);
CREATE INDEX idx_notif_centro_tenant ON notificaciones_centro(tenant_id, fecha_creacion);

-- =============================================================================
-- BÚSQUEDAS GUARDADAS (FAVORITAS)
-- =============================================================================
CREATE TABLE busquedas_guardadas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  filtros JSONB NOT NULL,  -- { "gravedad": "Grave", "curso": "5A", "fechaDesde": "2026-01-01" }
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_busquedas_usuario ON busquedas_guardadas(usuario_id);

-- =============================================================================
-- REPORTES GENERADOS
-- =============================================================================
CREATE TABLE reportes_generados (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL,  -- 'mensual', 'conductual', 'protocolo'
  nombre VARCHAR(255) NOT NULL,
  archivo_url TEXT NOT NULL,  -- URL en Supabase Storage
  parametros JSONB,           -- { mes: 6, anio: 2026 }
  generado_por UUID REFERENCES usuarios(id),
  fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reportes_tenant ON reportes_generados(tenant_id, fecha_generacion);

-- =============================================================================
-- FULL-TEXT SEARCH - Agregar columnas tsvector
-- =============================================================================
ALTER TABLE estudiantes ADD COLUMN search_vector tsvector;
ALTER TABLE incidentes ADD COLUMN search_vector tsvector;

CREATE INDEX idx_estudiantes_search ON estudiantes USING GIN(search_vector);
CREATE INDEX idx_incidentes_search ON incidentes USING GIN(search_vector);

-- =============================================================================
-- TRIGGERS PARA ACTUALIZAR search_vector AUTOMÁTICAMENTE
-- =============================================================================
CREATE TRIGGER estudiantes_search_update
  BEFORE INSERT OR UPDATE ON estudiantes
  FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger(
    search_vector,
    'pg_catalog.spanish',
    nombre, apellido, rut
  );

CREATE TRIGGER incidentes_search_update
  BEFORE INSERT OR UPDATE ON incidentes
  FOR EACH ROW EXECUTE FUNCTION
  tsvector_update_trigger(
    search_vector,
    'pg_catalog.spanish',
    relato, medidas
  );

-- =============================================================================
-- ACTUALIZAR AUDITORÍA - Agregar user_agent
-- =============================================================================
ALTER TABLE auditoria ADD COLUMN user_agent TEXT;
```

---

### Testing

#### Jest Config (Backend)

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/workers/**',
  ],
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
}
```

#### Vitest Config (Frontend)

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.js',
      ],
    },
  },
})
```

#### Playwright Config (E2E)

```javascript
// playwright.config.js
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 2,
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
})
```

---

### CI/CD

#### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        working-directory: ./siga-backend
        run: npm ci
      
      - name: Lint
        working-directory: ./siga-backend
        run: npm run lint
      
      - name: Unit tests
        working-directory: ./siga-backend
        run: npm test
        env:
          NODE_ENV: test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./siga-backend/coverage/lcov.info

  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        working-directory: ./siga-frontend
        run: npm ci
      
      - name: Lint
        working-directory: ./siga-frontend
        run: npm run lint
      
      - name: Unit tests
        working-directory: ./siga-frontend
        run: npm test
      
      - name: Build
        working-directory: ./siga-frontend
        run: npm run build

  e2e-test:
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test]
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Playwright
        working-directory: ./siga-frontend
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        working-directory: ./siga-frontend
        run: npm run test:e2e

  deploy:
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test, e2e-test]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy Backend to Railway
        # ... deploy steps
      
      - name: Deploy Frontend to Vercel
        # ... deploy steps
```

---

### Consideraciones de Seguridad

#### 1. Autenticación y Autorización
- JWT con expiración corta (15 min) + refresh token (7 días)
- Tokens almacenados en `httpOnly` cookies (no localStorage)
- RBAC: validar roles en backend, no solo frontend
- Rate limiting agresivo en `/auth/login`

#### 2. Sanitización de Inputs
- Validación con Zod en todos los endpoints
- Escape de HTML en outputs
- Queries parametrizados (prevenir SQL injection)

#### 3. Headers de Seguridad (Helmet)
- Content Security Policy (CSP)
- X-Frame-Options: DENY
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options: nosniff

#### 4. Secrets Management
- `.env` nunca en git
- Secrets en variables de entorno del hosting
- Rotación periódica de JWT_SECRET

#### 5. Auditoría
- Log de todos los accesos a datos sensibles
- IP y user-agent en logs de auditoría
- Alertas ante comportamientos sospechosos

#### 6. Rate Limiting
- IP-based para endpoints públicos
- Usuario-based para endpoints autenticados
- Redis para compartir límites entre instancias

#### 7. CORS
- Whitelist de orígenes permitidos
- No usar `*` en producción

---

## Orden de Implementación Recomendado

### Fase 1: Infraestructura (Semana 1-2)
1. Logging (Winston + Sentry)
2. Rate limiting
3. Redis + caché básico
4. Request ID middleware

### Fase 2: Comunicación (Semana 3)
5. WebSocket notifications
6. Email queue + worker
7. Notificaciones centro (DB + API)

### Fase 3: Búsqueda y Analytics (Semana 4-5)
8. Full-text search
9. Analytics dashboard (Recharts)
10. Risk scoring

### Fase 4: Experiencia (Semana 6)
11. PWA (manifest + service worker)
12. Dark mode
13. Optimistic UI

### Fase 5: Calidad (Semana 7-8)
14. Testing suite (Jest, Vitest, Playwright)
15. CI/CD pipeline
16. API versioning
17. Auditoría avanzada
18. Reportes automáticos

---

## Métricas de Éxito

### Performance
- **API response time:** p95 < 200ms (con caché)
- **Dashboard load:** < 2s
- **Search results:** < 300ms

### Reliability
- **Uptime:** 99.5%
- **Error rate:** < 0.1%
- **Email delivery:** > 98%

### Coverage
- **Unit tests:** > 70%
- **Integration tests:** > 60%
- **E2E critical paths:** 100%

### UX
- **Lighthouse score:** > 90
- **First Contentful Paint:** < 1.5s
- **Time to Interactive:** < 3s

---

## Notas Finales

Este diseño integra 15 funcionalidades enterprise de forma cohesiva y escalable. Cada capa construye sobre las anteriores, permitiendo implementación incremental sin bloqueos.

**Puntos críticos:**
- Redis es dependencia clave (caché + queue)
- Socket.io debe manejar reconexiones
- Testing es iterativo, no todo al final
- CI/CD se configura temprano

**Riesgos:**
- Complejidad aumenta mantenibilidad
- Performance debe monitorearse desde día 1
- Documentación debe actualizarse con cambios

**Siguiente paso:** Crear plan de implementación detallado con writing-plans skill.
