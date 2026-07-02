# Database Migrations

This directory contains SQL migration files for the SIGA backend.

## How to Apply Migrations

All migrations should be executed in the Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy the content of the migration file
5. Execute the query

## Migration Files

### `add_notificaciones_table.sql` (Fase 2)
Creates the `notificaciones` table for the notification system.

**Status:** Applied in Fase 2

### `add_analytics_functions.sql` (Fase 3 - Task 1)
Creates PostgreSQL functions for analytics endpoints:
- `contar_estudiantes_con_muchos_incidentes`: Counts students with N or more incidents
- `obtener_top_estudiantes_incidentes`: Returns top N students with most incidents

**Status:** Pending - needs to be applied

**To apply:**
```sql
-- Copy and run the entire content of add_analytics_functions.sql in Supabase SQL Editor
```

## Rollback

To rollback these functions if needed:
```sql
DROP FUNCTION IF EXISTS contar_estudiantes_con_muchos_incidentes(UUID, TIMESTAMP, INTEGER);
DROP FUNCTION IF EXISTS obtener_top_estudiantes_incidentes(UUID, INTEGER);
```

## Notes

- All functions are tenant-aware and use RLS via `tenant_id` parameter
- Functions are idempotent (use `CREATE OR REPLACE`)
- Comments are added to each function for documentation
