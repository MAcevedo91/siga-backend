-- =============================================================================
-- MIGRATION: Add asistencia table for attendance tracking
-- Date: 2026-07-02
-- Description: Creates asistencia table with hybrid day/block model
-- =============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla asistencia (registro híbrido día + bloques opcionales)
CREATE TABLE asistencia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    estudiante_id UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    estado VARCHAR(20) NOT NULL CHECK (estado IN ('Presente', 'Ausente', 'Atrasado', 'Justificado')),
    bloque INT CHECK (bloque >= 1 AND bloque <= 8), -- NULL = día completo, 1-8 = bloque específico
    registrado_por UUID NOT NULL REFERENCES usuarios(id),
    observaciones TEXT,
    justificacion_adjunto VARCHAR(500), -- URL Supabase Storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_asistencia UNIQUE(tenant_id, estudiante_id, fecha, bloque)
);

-- RLS Policy: multi-tenant isolation
ALTER TABLE asistencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY asistencia_tenant_isolation ON asistencia
    USING (tenant_id::text = current_setting('app.tenant_id', TRUE));

-- Índices para queries frecuentes
CREATE INDEX idx_asistencia_fecha ON asistencia(tenant_id, fecha DESC);
CREATE INDEX idx_asistencia_estudiante ON asistencia(tenant_id, estudiante_id, fecha DESC);
CREATE INDEX idx_asistencia_estado ON asistencia(tenant_id, estado, fecha DESC) WHERE estado IN ('Ausente', 'Atrasado');

-- Comentarios para documentación
COMMENT ON TABLE asistencia IS 'Registro híbrido de asistencia: bloque=NULL para día completo, 1-8 para bloque específico';
COMMENT ON COLUMN asistencia.bloque IS 'NULL = asistencia general día, 1-8 = bloque específico (opcional)';
COMMENT ON CONSTRAINT unique_asistencia ON asistencia IS 'Previene registros duplicados para mismo estudiante/fecha/bloque';
