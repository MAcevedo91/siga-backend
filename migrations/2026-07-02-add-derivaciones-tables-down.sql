-- =============================================================================
-- ROLLBACK MIGRATION: Remove derivaciones tables
-- Date: 2026-07-02
-- =============================================================================

DROP TABLE IF EXISTS derivacion_seguimientos CASCADE;
DROP TABLE IF EXISTS derivaciones CASCADE;
