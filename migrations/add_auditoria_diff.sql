-- =============================================================================
-- MIGRACIÓN: Agregar soporte para diff visual en auditoría
-- Fecha: 2026-07-01
-- Descripción: Agrega columnas para almacenar estados antes/después y diff
-- =============================================================================

-- Add columns for before/after state
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS datos_antes JSONB;
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS datos_despues JSONB;
ALTER TABLE auditoria ADD COLUMN IF NOT EXISTS cambios JSONB;

-- Index for efficient queries on cambios
CREATE INDEX IF NOT EXISTS idx_auditoria_cambios ON auditoria USING GIN (cambios);

-- Add comments for documentation
COMMENT ON COLUMN auditoria.datos_antes IS 'Estado completo del registro antes del cambio';
COMMENT ON COLUMN auditoria.datos_despues IS 'Estado completo del registro después del cambio';
COMMENT ON COLUMN auditoria.cambios IS 'Diff de campos modificados con valores before/after';
