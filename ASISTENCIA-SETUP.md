# Asistencia Module Setup Instructions

## Migration Required

Before testing the asistencia endpoints, you need to run the database migration to create the `asistencia` table.

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project SQL Editor:
   https://supabase.com/dashboard/project/pqlunpvhtnmoysgitqmd/sql/new

2. Copy and paste the contents of:
   `migrations/2026-07-02-add-asistencia-tables.sql`

3. Click "Run" to execute the migration

### Option 2: Command Line (if you have direct database access)

```bash
psql <your-connection-string> -f migrations/2026-07-02-add-asistencia-tables.sql
```

## Test Data

Test data (curso and estudiantes) can be created by running:

```bash
node test-data-setup.js
```

This will output:
- CURSO_ID
- STUDENT_1
- STUDENT_2

## Testing Endpoints

After running the migration, you can test the endpoints using the curl commands in this document.

### 1. Get JWT Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@sigaescolar.cl", "password": "Admin1234!"}'
```

Save the token from the response.

### 2. Register Asistencia

```bash
curl -X POST http://localhost:3000/api/v1/asistencia/registrar \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "cursoId": "YOUR_CURSO_ID",
    "fecha": "2026-07-02",
    "asistencias": [
      { "estudianteId": "STUDENT_1_ID", "estado": "Presente" },
      { "estudianteId": "STUDENT_2_ID", "estado": "Ausente", "observaciones": "Enfermo" }
    ]
  }'
```

Expected: 201 status with success message

### 3. Get Asistencia for Curso/Date

```bash
curl -X GET "http://localhost:3000/api/v1/asistencia/curso/YOUR_CURSO_ID/fecha/2026-07-02" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Expected: 200 status with student attendance list

### 4. Get Student Attendance Summary

```bash
curl -X GET "http://localhost:3000/api/v1/asistencia/estudiante/STUDENT_1_ID/resumen" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Expected: 200 status with percentage and stats

### 5. Get Attendance Alerts

```bash
curl -X GET "http://localhost:3000/api/v1/asistencia/alertas?porcentaje_minimo=85" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

Expected: 200 status with list of at-risk students

### 6. Justify Absence

First, get the asistencia ID from the registro response or query, then:

```bash
curl -X PATCH http://localhost:3000/api/v1/asistencia/ASISTENCIA_ID/justificar \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "observaciones": "Certificado médico presentado",
    "justificacion_adjunto": "https://storage.supabase.co/..."
  }'
```

Expected: 200 status with updated record

## Endpoints Summary

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/asistencia/registrar` | Admin, Directivo, Inspector, Docente | Register bulk attendance |
| GET | `/api/v1/asistencia/curso/:cursoId/fecha/:fecha` | All authenticated | Get attendance for curso/date |
| GET | `/api/v1/asistencia/estudiante/:id/resumen` | All authenticated | Get student attendance summary |
| GET | `/api/v1/asistencia/alertas` | Admin, Directivo, Inspector | Get at-risk students |
| PATCH | `/api/v1/asistencia/:id/justificar` | Admin, Directivo, Inspector | Justify an absence |
