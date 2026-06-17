# SIGA Escolar — Backend

## Instalación Local

1. Clonar el repo: `git clone https://github.com/MAcevedo91/siga-backend.git`
2. Instalar dependencias: `npm install`
3. Copiar `.env.example` a `.env` y completar con las credenciales de Supabase
4. Levantar servidor: `npm run dev`
5. Crear usuario admin inicial: `npm run seed`

## Variables de entorno requeridas

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
JWT_SECRET=string_largo_aleatorio
PORT=3000
NODE_ENV=development
```

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Levanta el servidor con nodemon (desarrollo) |
| `npm start` | Levanta el servidor en producción |
| `npm run seed` | Crea el usuario administrador inicial |
| `npm run lint` | Ejecuta ESLint sobre el código fuente |

## Estructura de carpetas

```
src/
├── controllers/    ← handlers de request/response
├── middlewares/    ← autenticación, autorización, auditoría
├── routes/         ← definición de rutas y aplicación de middlewares
├── services/       ← lógica de negocio
├── models/         ← (reservado para modelos futuros)
├── utils/          ← helpers: db, seed
├── app.js          ← configuración Express y middlewares globales
└── server.js       ← arranque del servidor
```

## Arquitectura de autenticación y autorización

Todas las rutas privadas pasan por la siguiente cadena de middlewares en orden:

```
Request → authenticateToken → setTenantContext → requireRole (por ruta) → handler
```

1. **`authenticateToken`** — verifica el JWT en el header `Authorization: Bearer <token>`
2. **`setTenantContext`** — establece el `tenant_id` en PostgreSQL para activar RLS
3. **`requireRole(...roles)`** — verifica que el rol del usuario esté permitido en la ruta

## Matriz de permisos por rol

| Recurso | Administrador | Coordinador | Directivo | Inspector | Docente |
|---------|:---:|:---:|:---:|:---:|:---:|
| Usuarios (CRUD) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Estudiantes (lectura) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Estudiantes (escritura) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Importación CSV | ✅ | ✅ | ❌ | ❌ | ❌ |
| Incidentes (crear) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Incidentes (leer) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Incidentes (editar/cerrar) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Protocolos RICE | ✅ | ✅ | ❌ | ❌ | ❌ |
| Dashboard / Reportería | ✅ | ✅ | ✅ | ❌ | ❌ |
| Exportación PDF | ✅ | ✅ | ❌ | ❌ | ❌ |

## Rutas públicas (sin autenticación)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/health` | Health check del servidor |
| POST | `/api/v1/auth/login` | Login con email y contraseña |
| GET | `/api/v1/auth/me` | Datos del usuario autenticado |
