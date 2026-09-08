-- =============================================================================
-- MIGRACIÓN: Tabla configuracion_tenant con RLS y Backfill (HU 5.3)
-- Fecha: 2026-09-08
-- Descripción: Permite configurar dinámicamente por tenant los umbrales de riesgo
--              y ventanas temporales de convivencia escolar sin alterar código.
-- =============================================================================

CREATE TABLE IF NOT EXISTS configuracion_tenant (
    id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id                  UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
    umbral_riesgo              INT NOT NULL DEFAULT 6 CHECK (umbral_riesgo > 0),
    ventana_dias_riesgo        INT NOT NULL DEFAULT 30 CHECK (ventana_dias_riesgo > 0),
    ventana_dias_reincidencia  INT NOT NULL DEFAULT 45 CHECK (ventana_dias_reincidencia > 0),
    ventana_dias_escalada      INT NOT NULL DEFAULT 15 CHECK (ventana_dias_escalada > 0),
    created_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                 TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE configuracion_tenant ENABLE ROW LEVEL SECURITY;

-- Política de aislamiento multi-tenant para lectura y escritura
DROP POLICY IF EXISTS tenant_isolation_configuracion_tenant ON configuracion_tenant;
CREATE POLICY tenant_isolation_configuracion_tenant ON configuracion_tenant
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Backfill inicial: insertar parámetros por defecto para tenants existentes
INSERT INTO configuracion_tenant (tenant_id, umbral_riesgo, ventana_dias_riesgo, ventana_dias_reincidencia, ventana_dias_escalada)
SELECT id, 6, 30, 45, 15 FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
