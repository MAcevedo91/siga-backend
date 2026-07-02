-- =============================================================================
-- ROLLBACK MIGRATION: Remove calendario tables
-- Date: 2026-07-02
-- =============================================================================

DROP TABLE IF EXISTS evento_recordatorios CASCADE;
DROP TABLE IF EXISTS evento_participantes CASCADE;
DROP TABLE IF EXISTS eventos CASCADE;
