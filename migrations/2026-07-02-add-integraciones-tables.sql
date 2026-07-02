-- =============================================================================
-- MIGRATION: Add integraciones tables (SIGE export, webhooks)
-- Date: 2026-07-02
-- Description: Creates integraciones_config, sige_exportaciones, webhooks, webhook_deliveries
-- =============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLA: integraciones_config
-- =============================================================================
CREATE TABLE integraciones_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('SIGE', 'Webhook', 'API')),
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    configuracion JSONB NOT NULL, -- Configuración específica por tipo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_integracion UNIQUE(tenant_id, tipo, nombre)
);

-- RLS Policy: multi-tenant isolation
ALTER TABLE integraciones_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY integraciones_config_tenant_isolation ON integraciones_config
    USING (tenant_id::text = current_setting('app.tenant_id', TRUE));

-- Índices
CREATE INDEX idx_integraciones_tenant ON integraciones_config(tenant_id, activo);

-- =============================================================================
-- TABLA: sige_exportaciones
-- =============================================================================
CREATE TABLE sige_exportaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo_exportacion VARCHAR(50) NOT NULL CHECK (tipo_exportacion IN ('Matrícula', 'Asistencia', 'Notas', 'Incidentes')),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    archivo_url VARCHAR(500), -- URL Supabase Storage del CSV/Excel generado
    estado VARCHAR(30) NOT NULL DEFAULT 'En Proceso' CHECK (estado IN ('En Proceso', 'Completada', 'Fallida')),
    error_mensaje TEXT,
    registros_exportados INT,
    generado_por UUID NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_fecha_exportacion CHECK (fecha_fin >= fecha_inicio)
);

-- RLS Policy
ALTER TABLE sige_exportaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY sige_exportaciones_tenant_isolation ON sige_exportaciones
    USING (tenant_id::text = current_setting('app.tenant_id', TRUE));

-- Índices
CREATE INDEX idx_sige_exportaciones_tenant ON sige_exportaciones(tenant_id, created_at DESC);
CREATE INDEX idx_sige_exportaciones_tipo ON sige_exportaciones(tenant_id, tipo_exportacion, created_at DESC);

-- =============================================================================
-- TABLA: webhooks
-- =============================================================================
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    eventos JSONB NOT NULL, -- ["estudiante.created", "incidente.created", etc.]
    secreto VARCHAR(255) NOT NULL, -- Para firmar HMAC
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    headers JSONB, -- Headers personalizados opcionales
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policy
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY webhooks_tenant_isolation ON webhooks
    USING (tenant_id::text = current_setting('app.tenant_id', TRUE));

-- Índices
CREATE INDEX idx_webhooks_tenant ON webhooks(tenant_id, activo) WHERE activo = TRUE;

-- =============================================================================
-- TABLA: webhook_deliveries
-- =============================================================================
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    evento VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    http_status INT,
    response_body TEXT,
    intento INT NOT NULL DEFAULT 1,
    exitoso BOOLEAN NOT NULL DEFAULT FALSE,
    error_mensaje TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para monitoring
CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_fallidas ON webhook_deliveries(webhook_id, exitoso) WHERE NOT exitoso;

-- Comentarios para documentación
COMMENT ON TABLE integraciones_config IS 'Configuración de integraciones externas (SIGE, APIs, webhooks)';
COMMENT ON COLUMN integraciones_config.configuracion IS 'JSONB flexible para configuración específica por tipo';
COMMENT ON TABLE sige_exportaciones IS 'Log de exportaciones SIGE (CSV/Excel) para MINEDUC';
COMMENT ON TABLE webhooks IS 'Webhooks salientes para notificar eventos a sistemas externos';
COMMENT ON COLUMN webhooks.secreto IS 'Secreto para firmar payload con HMAC-SHA256';
COMMENT ON TABLE webhook_deliveries IS 'Log de entregas de webhooks (auditoría y reintentos)';
