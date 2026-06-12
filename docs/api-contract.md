# SIGA Escolar — Contrato de API v1

> **Propósito:** Este documento define la estructura estándar de respuestas JSON y los endpoints del Sprint 1. Su objetivo es permitir que el frontend desarrolle en paralelo sin depender del servidor real, usando mocks basados en este contrato.
>
> **Base URL:** `http://localhost:3000/api/v1` (desarrollo) | `https://<dominio>/api/v1` (producción)

---

## Estructura Estándar de Respuestas

### Respuesta Exitosa

Toda respuesta exitosa del servidor sigue esta estructura:

```json
{
  "status": "success",
  "message": "Descripción legible de la operación",
  "data": {}
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status` | `string` | Siempre `"success"` en respuestas exitosas |
| `message` | `string` | Mensaje legible para logging o debugging |
| `data` | `object \| array \| null` | Payload de la respuesta. `null` si no hay datos que retornar |

---

### Respuesta de Error

Toda respuesta de error sigue esta estructura:

```json
{
  "status": "error",
  "message": "Descripción legible del error para el usuario",
  "statusCode": 400
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `status` | `string` | Siempre `"error"` en respuestas de error |
| `message` | `string` | Mensaje de error **genérico y seguro** para mostrar al usuario |
| `statusCode` | `number` | Código HTTP del error |

> ⚠️ **Regla de seguridad:** El campo `message` nunca debe exponer detalles internos del sistema (stack traces, nombres de tablas, queries SQL). Los detalles técnicos van solo al log del servidor.

---

## Códigos HTTP utilizados

| Código | Significado | Cuándo usarlo |
|--------|------------|---------------|
| `200` | OK | Operación exitosa (GET, PUT, PATCH) |
| `201` | Created | Recurso creado exitosamente (POST) |
| `400` | Bad Request | Datos inválidos o faltantes en el request |
| `401` | Unauthorized | Token ausente, inválido o expirado |
| `403` | Forbidden | Token válido pero sin permisos para la acción |
| `404` | Not Found | Recurso no encontrado |
| `500` | Internal Server Error | Error inesperado del servidor |

---

## Endpoints del Sprint 1

---

### POST `/api/v1/auth/login`

Autentica al usuario con email y contraseña. Retorna un JWT si las credenciales son válidas.

**Request**

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "admin@escuela.cl",
  "password": "contraseña123"
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `email` | `string` | ✅ | Email institucional del usuario |
| `password` | `string` | ✅ | Contraseña en texto plano (se compara con hash bcrypt) |

---

**Respuesta exitosa — 200 OK**

```json
{
  "status": "success",
  "message": "Autenticación exitosa",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "nombre": "Marcelo",
      "apellido": "Acevedo",
      "email": "admin@escuela.cl",
      "rol": "Administrador"
    }
  }
}
```

---

**Error — 401 Credenciales inválidas**

```json
{
  "status": "error",
  "message": "Credenciales incorrectas",
  "statusCode": 401
}
```

---

**Error — 403 Cuenta bloqueada**

Ocurre tras 5 intentos fallidos consecutivos. La cuenta se bloquea por 15 minutos.

```json
{
  "status": "error",
  "message": "Cuenta bloqueada temporalmente. Intenta nuevamente en 15 minutos.",
  "statusCode": 403
}
```

---

**Error — 400 Campos faltantes**

```json
{
  "status": "error",
  "message": "Email y contraseña son requeridos",
  "statusCode": 400
}
```

---

### GET `/api/v1/auth/me`

Retorna los datos del usuario autenticado. Requiere token JWT válido en el header.

**Request**

```http
GET /api/v1/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

**Respuesta exitosa — 200 OK**

```json
{
  "status": "success",
  "message": "Usuario autenticado",
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "nombre": "Marcelo",
    "apellido": "Acevedo",
    "email": "admin@escuela.cl",
    "rol": "Administrador",
    "tenant_id": "f9e8d7c6-b5a4-3210-fedc-ba9876543210"
  }
}
```

---

**Error — 401 Token ausente o inválido**

```json
{
  "status": "error",
  "message": "No autorizado. Token inválido o ausente.",
  "statusCode": 401
}
```

---

**Error — 401 Token expirado**

```json
{
  "status": "error",
  "message": "Sesión expirada. Por favor inicia sesión nuevamente.",
  "statusCode": 401
}
```

---

### GET `/api/v1/health`

Endpoint de salud del servidor. No requiere autenticación.

**Request**

```http
GET /api/v1/health
```

**Respuesta — 200 OK**

```json
{
  "status": "success",
  "message": "Servidor operativo",
  "data": {
    "timestamp": "2026-06-12T10:00:00.000Z"
  }
}
```

---

## Payload del JWT

El token JWT contiene el siguiente payload. El frontend puede decodificarlo (sin verificarlo) para leer los datos del usuario sin llamar a `/auth/me`.

```json
{
  "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "f9e8d7c6-b5a4-3210-fedc-ba9876543210",
  "rol": "Administrador",
  "email": "admin@escuela.cl",
  "iat": 1718186400,
  "exp": 1718215200
}
```

> **Expiración:** 8 horas desde la emisión (`exp = iat + 28800`).

---

## Guía de Mock para Frontend

Daniel puede usar esta estructura para mockear respuestas en el frontend mientras el backend está en desarrollo. Ejemplo con axios:

```javascript
// src/services/auth.service.js
// Mock temporal — reemplazar con llamada real cuando el backend esté listo

const LOGIN_MOCK = {
  status: "success",
  message: "Autenticación exitosa",
  data: {
    token: "mock.jwt.token",
    user: {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      nombre: "Daniel",
      apellido: "Flores",
      email: "daniel@escuela.cl",
      rol: "Inspector"
    }
  }
}

export const login = async (email, password) => {
  // TODO: reemplazar por llamada real
  // return await axios.post('/api/v1/auth/login', { email, password })
  return LOGIN_MOCK
}
```

---

## Historial de versiones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| v1.0 | 2026-06-12 | Versión inicial Sprint 1: `/auth/login`, `/auth/me`, `/health` |
