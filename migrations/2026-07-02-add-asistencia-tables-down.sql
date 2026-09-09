-- =============================================================================
-- ROLLBACK MIGRATION: Remove asistencia table
-- Date: 2026-07-02
-- Description: Drops asistencia table and all related objects
-- =============================================================================

-- Drop table cascade (elimina dependencias automáticamente)
DROP TABLE IF EXISTS asistencia CASCADE;

-- Drop índices explícitamente si la tabla ya fue eliminada manualmente
DROP INDEX IF EXISTS idx_asistencia_fecha;
DROP INDEX IF EXISTS idx_asistencia_estudiante;
DROP INDEX IF EXISTS idx_asistencia_estado;
