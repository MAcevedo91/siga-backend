-- migrations/2026-07-02-add-mensajeria-tables-down.sql
-- Rollback migration for Mensajería Tables

DROP TABLE IF EXISTS broadcast_lecturas CASCADE;
DROP TABLE IF EXISTS broadcasts CASCADE;
DROP TABLE IF EXISTS mensajes CASCADE;
DROP TABLE IF EXISTS conversacion_participantes CASCADE;
DROP TABLE IF EXISTS conversaciones CASCADE;

-- Drop índices explícitamente
DROP INDEX IF EXISTS idx_conversaciones_tenant;
DROP INDEX IF EXISTS idx_participantes_usuario;
DROP INDEX IF EXISTS idx_mensajes_conversacion;
DROP INDEX IF EXISTS idx_mensajes_remitente;
DROP INDEX IF EXISTS idx_broadcasts_tenant;
DROP INDEX IF EXISTS idx_broadcasts_programado;
DROP INDEX IF EXISTS idx_lecturas_broadcast;
DROP INDEX IF EXISTS idx_lecturas_usuario;
