# API de Asistencia Escolar

## Endpoints

### POST /api/v1/asistencia/registrar

Registra asistencia en bulk para un curso (día completo o bloque específico).

**Autenticación:** JWT requerido  
**Permisos:** Administrador, Directivo, Inspector, Docente

**Request Body:**
```json
{
  "cursoId": "uuid",
  "fecha": "2026-07-02",
  "bloque": null,
  "asistencias": [
    {
      "estudianteId": "uuid",
      "estado": "Presente",
      "observaciones": "Opcional"
    }
  ]
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Asistencia registrada para 25 estudiantes",
  "data": {
    "registros": 25
  }
}
```

---

### GET /api/v1/asistencia/curso/:cursoId/fecha/:fecha

Obtiene asistencia de un curso en una fecha específica.

**Query Params:**
- `bloque` (opcional): 1-8 para bloque específico, omitir para día completo

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "estudianteId": "uuid",
      "nombre": "Juan",
      "apellido": "Pérez",
      "estado": "Presente",
      "bloque": null,
      "observaciones": null
    }
  ]
}
```

---

### GET /api/v1/asistencia/estudiante/:id/resumen

Obtiene resumen de asistencia de un estudiante.

**Query Params:**
- `fecha_desde` (opcional): Default últimos 30 días
- `fecha_hasta` (opcional): Default hoy

**Response 200:**
```json
{
  "success": true,
  "data": {
    "porcentaje": 85,
    "totalDias": 20,
    "presente": 17,
    "ausente": 2,
    "atrasado": 1,
    "justificado": 0
  }
}
```

---

### GET /api/v1/asistencia/alertas

Obtiene estudiantes con ausentismo crítico (< 85%).

**Permisos:** Administrador, Directivo, Inspector

**Query Params:**
- `porcentaje_minimo` (opcional): Default 85

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "estudianteId": "uuid",
      "nombre": "María",
      "apellido": "González",
      "curso": "8° Básico A",
      "porcentajeAsistencia": 75,
      "diasAusente": 5
    }
  ],
  "meta": {
    "total": 1,
    "porcentaje_minimo": 85
  }
}
```

---

### PATCH /api/v1/asistencia/:id/justificar

Justifica una ausencia.

**Permisos:** Administrador, Directivo, Inspector

**Request Body:**
```json
{
  "observaciones": "Licencia médica presentada",
  "justificacion_adjunto": "https://storage.url/documento.pdf"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Asistencia justificada",
  "data": { ... }
}
```

---

## Modelo de Datos

### Tabla `asistencia`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | Foreign key a tenants |
| estudiante_id | UUID | Foreign key a estudiantes |
| fecha | DATE | Fecha del registro |
| estado | VARCHAR(20) | Presente, Ausente, Atrasado, Justificado |
| bloque | INT | NULL = día completo, 1-8 = bloque específico |
| registrado_por | UUID | Usuario que registró |
| observaciones | TEXT | Notas adicionales |
| justificacion_adjunto | VARCHAR(500) | URL documento adjunto |
| created_at | TIMESTAMP | Timestamp creación |

**Constraint:** UNIQUE(tenant_id, estudiante_id, fecha, bloque)

---

## Bull Jobs

### alerta-ausentismo

**Schedule:** Diario a las 9 AM  
**Descripción:** Detecta estudiantes con >15% ausentismo y envía email a Directivos

**Payload:**
```json
{
  "tenantId": "uuid"
}
```

---

## Cache Strategy

- **getAsistenciaCurso:** TTL 1 hora (key: `asistencia:{tenantId}:{cursoId}:{fecha}:{bloque}`)
- **getAlertasHandler:** TTL 30 minutos (key: `alertas-ausentismo:{tenantId}:{porcentaje}`)
- **Invalidación:** Al registrar nueva asistencia, invalida cache del curso/fecha correspondiente
