-- =============================================================================
-- ROLLBACK MIGRATION: Remove integraciones tables
-- Date: 2026-07-02
-- =============================================================================

DROP TABLE IF EXISTS webhook_deliveries CASCADE;
DROP TABLE IF EXISTS webhooks CASCADE;
DROP TABLE IF EXISTS sige_exportaciones CASCADE;
DROP TABLE IF EXISTS integraciones_config CASCADE;
