-- =============================================================================
-- MIGRACIÓN: Tabla protocolo_paso_evidencias (Hallazgo 7 - Escuela El Salvador)
-- Fecha: 19/10/2026
-- Descripción:
--   Permite cargar y adjuntar archivos probatorios (PDFs, imágenes, citaciones,
--   actas de entrevista o derivaciones) en cada paso del checklist RICE normativo.
-- =============================================================================

-- 1. CREACIÓN DE LA TABLA protocolo_paso_evidencias
CREATE TABLE IF NOT EXISTS protocolo_paso_evidencias (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    protocolo_id      UUID NOT NULL REFERENCES protocolos_rice(id) ON DELETE CASCADE,
    paso_id           UUID NOT NULL REFERENCES protocolo_pasos(id) ON DELETE CASCADE,
    nombre_archivo    VARCHAR(255) NOT NULL,
    url_archivo       TEXT NOT NULL,
    storage_path      TEXT NOT NULL,
    mime_type         VARCHAR(100) NOT NULL,
    tamano_bytes      BIGINT NOT NULL,
    subido_por        UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ÍNDICES DE RENDIMIENTO Y CONSULTA
CREATE INDEX IF NOT EXISTS idx_prot_evidencias_paso       ON protocolo_paso_evidencias(paso_id);
CREATE INDEX IF NOT EXISTS idx_prot_evidencias_protocolo  ON protocolo_paso_evidencias(protocolo_id);
CREATE INDEX IF NOT EXISTS idx_prot_evidencias_tenant     ON protocolo_paso_evidencias(tenant_id);

-- 3. HABILITACIÓN DE ROW LEVEL SECURITY (RLS) MULTI-TENANT
ALTER TABLE protocolo_paso_evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocolo_paso_evidencias FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_protocolo_paso_evidencias ON protocolo_paso_evidencias;
CREATE POLICY tenant_isolation_protocolo_paso_evidencias ON protocolo_paso_evidencias
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
