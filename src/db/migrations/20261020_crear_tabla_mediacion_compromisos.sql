-- =============================================================================
-- MIGRACIÓN: Tabla mediacion_compromisos (TASK 7.2.2.1 - SIGA Escolar)
-- Autor: Marcelo Andrés Acevedo Silva (Líder Backend & Data Architect)
-- Fecha: 20/10/2026
-- Descripción:
--   Permite registrar y gestionar los acuerdos y compromisos formativos
--   acordados durante las sesiones de mediación escolar restaurativa.
-- =============================================================================

-- 1. TABLA mediacion_compromisos
CREATE TABLE IF NOT EXISTS mediacion_compromisos (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mediacion_id                UUID NOT NULL REFERENCES mediaciones(id) ON DELETE CASCADE,
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    estudiante_id               UUID REFERENCES estudiantes(id) ON DELETE SET NULL,
    tipo_compromiso             VARCHAR(40) NOT NULL CHECK (tipo_compromiso IN (
                                    'reparacion_relacional',
                                    'disculpa_comunitaria',
                                    'cuidado_espacios',
                                    'actitud_aula',
                                    'apoyo_academico',
                                    'otro'
                                )),
    descripcion                 TEXT NOT NULL,
    fecha_limite                DATE NOT NULL,
    cumplido                    BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_cumplimiento          TIMESTAMP WITH TIME ZONE,
    observaciones_seguimiento   TEXT,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. ÍNDICES B-TREE DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_mediacion_compromisos_mediacion   ON mediacion_compromisos(mediacion_id);
CREATE INDEX IF NOT EXISTS idx_mediacion_compromisos_tenant      ON mediacion_compromisos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mediacion_compromisos_estudiante  ON mediacion_compromisos(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_mediacion_compromisos_estado      ON mediacion_compromisos(cumplido);

-- 3. HABILITACIÓN DE ROW LEVEL SECURITY (RLS) MULTI-TENANT
ALTER TABLE mediacion_compromisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mediacion_compromisos FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_mediacion_compromisos ON mediacion_compromisos;
CREATE POLICY tenant_isolation_mediacion_compromisos ON mediacion_compromisos
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
