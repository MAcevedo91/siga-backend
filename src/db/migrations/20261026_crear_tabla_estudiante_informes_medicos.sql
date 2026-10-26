-- =============================================================================
-- MIGRACIÓN: Tabla estudiante_informes_medicos (TASK 8.2.2.1 - SIGA Escolar)
-- Autor: Marcelo Andrés Acevedo Silva (Líder Backend & Data Architect)
-- Fecha: 26/10/2026
-- Descripción:
--   Almacena el historial formal de fichas e informes médicos/psicológicos
--   emitidos para especialistas de salud externos, garantizando trazabilidad,
--   paginación, hash SHA-256 inmutable de autenticidad y aislamiento RLS multi-tenant.
-- =============================================================================

-- 1. TABLA estudiante_informes_medicos
CREATE TABLE IF NOT EXISTS estudiante_informes_medicos (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    estudiante_id               UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    usuario_emisor_id           UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    especialista_destino        VARCHAR(255) NOT NULL,
    motivo                      VARCHAR(500),
    notas                       TEXT,
    hash_sha256                 VARCHAR(64) NOT NULL,
    total_incidentes_incluidos  INTEGER NOT NULL DEFAULT 0,
    total_mediaciones_incluidas INTEGER NOT NULL DEFAULT 0,
    fecha_emision               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ÍNDICES B-TREE DE ALTO RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_est_informes_medicos_tenant     ON estudiante_informes_medicos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_est_informes_medicos_estudiante ON estudiante_informes_medicos(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_est_informes_medicos_emisor     ON estudiante_informes_medicos(usuario_emisor_id);
CREATE INDEX IF NOT EXISTS idx_est_informes_medicos_hash       ON estudiante_informes_medicos(hash_sha256);
CREATE INDEX IF NOT EXISTS idx_est_informes_medicos_fecha      ON estudiante_informes_medicos(fecha_emision DESC);

-- 3. HABILITACIÓN DE ROW LEVEL SECURITY (RLS) MULTI-TENANT FORZADO
ALTER TABLE estudiante_informes_medicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estudiante_informes_medicos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_estudiante_informes_medicos ON estudiante_informes_medicos;
CREATE POLICY tenant_isolation_estudiante_informes_medicos ON estudiante_informes_medicos
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
