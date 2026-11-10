-- =============================================================================
-- MIGRACIÓN DDL: TABLA citacion_acuerdos_mutuos (TASK 10.2.1 / SPRINT 10)
-- Escuela Coeducacional N° 1 El Salvador (RBD 9876-5)
-- Modelo de compromisos pedagógico-formativos y alianza familia-escuela
-- =============================================================================

CREATE TABLE IF NOT EXISTS citacion_acuerdos_mutuos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    citacion_id UUID NOT NULL UNIQUE REFERENCES citaciones_formativas(id) ON DELETE CASCADE,
    compromisos_colegio JSONB NOT NULL DEFAULT '[]'::jsonb,
    compromisos_apoderado JSONB NOT NULL DEFAULT '[]'::jsonb,
    observaciones_pedagogicas TEXT,
    fecha_proximo_seguimiento DATE NOT NULL,
    firma_docente_data TEXT,
    firma_apoderado_data TEXT,
    hash_sha256 VARCHAR(64) NOT NULL,
    creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Validación estructural de formato de hash SHA-256 (64 caracteres hexadecimales)
    CONSTRAINT chk_acuerdos_hash_sha256 CHECK (hash_sha256 ~* '^[a-f0-9]{64}$')
);

-- =============================================================================
-- ÍNDICES B-TREE DE RENDIMIENTO Y BÚSQUEDA FORENSE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_citacion_acuerdos_tenant_citacion
    ON citacion_acuerdos_mutuos(tenant_id, citacion_id);

CREATE INDEX IF NOT EXISTS idx_citacion_acuerdos_hash
    ON citacion_acuerdos_mutuos(hash_sha256);

CREATE INDEX IF NOT EXISTS idx_citacion_acuerdos_seguimiento
    ON citacion_acuerdos_mutuos(tenant_id, fecha_proximo_seguimiento);

-- =============================================================================
-- POLÍTICAS ROW LEVEL SECURITY (RLS) MULTI-TENANT
-- =============================================================================

ALTER TABLE citacion_acuerdos_mutuos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_citacion_acuerdos_tenant_isolation ON citacion_acuerdos_mutuos;
CREATE POLICY p_citacion_acuerdos_tenant_isolation ON citacion_acuerdos_mutuos
    FOR ALL
    USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
    WITH CHECK (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
