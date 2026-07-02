-- =============================================================================
-- MIGRATION: Add derivaciones tables for psychosocial workflow
-- Date: 2026-07-02
-- Description: Creates derivaciones, derivacion_seguimientos
-- =============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLA: derivaciones
-- =============================================================================
CREATE TABLE derivaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    estudiante_id UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    incidente_id UUID REFERENCES incidentes(id) ON DELETE SET NULL, -- Origen (puede ser NULL si es derivación directa)
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('Psicológica', 'Social', 'Pedagógica', 'Médica', 'Externa')),
    prioridad VARCHAR(20) NOT NULL DEFAULT 'Media' CHECK (prioridad IN ('Baja', 'Media', 'Alta', 'Urgente')),
    motivo TEXT NOT NULL,
    profesional_asignado UUID REFERENCES usuarios(id), -- NULL = sin asignar
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En Proceso', 'Cerrada')),
    fecha_derivacion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_cierre DATE,
    derivado_por UUID NOT NULL REFERENCES usuarios(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fecha_cierre_valida CHECK (fecha_cierre IS NULL OR fecha_cierre >= fecha_derivacion)
);

-- RLS Policy: multi-tenant isolation
ALTER TABLE derivaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY derivaciones_tenant_isolation ON derivaciones
    USING (tenant_id::text = current_setting('app.tenant_id', TRUE));

-- Índices para queries frecuentes
CREATE INDEX idx_derivaciones_estudiante ON derivaciones(tenant_id, estudiante_id, fecha_derivacion DESC);
CREATE INDEX idx_derivaciones_estado ON derivaciones(tenant_id, estado, prioridad) WHERE estado != 'Cerrada';
CREATE INDEX idx_derivaciones_profesional ON derivaciones(tenant_id, profesional_asignado, estado) WHERE profesional_asignado IS NOT NULL;
CREATE INDEX idx_derivaciones_tipo ON derivaciones(tenant_id, tipo, fecha_derivacion DESC);

-- =============================================================================
-- TABLA: derivacion_seguimientos
-- =============================================================================
CREATE TABLE derivacion_seguimientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    derivacion_id UUID NOT NULL REFERENCES derivaciones(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id),
    fecha_seguimiento DATE NOT NULL DEFAULT CURRENT_DATE,
    observaciones TEXT NOT NULL,
    acciones_realizadas TEXT,
    adjunto VARCHAR(500), -- URL Supabase Storage (opcional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_seguimientos_derivacion ON derivacion_seguimientos(derivacion_id, fecha_seguimiento DESC);
CREATE INDEX idx_seguimientos_usuario ON derivacion_seguimientos(usuario_id, fecha_seguimiento DESC);

-- Comentarios para documentación
COMMENT ON TABLE derivaciones IS 'Derivaciones psicosociales con workflow de seguimiento';
COMMENT ON COLUMN derivaciones.incidente_id IS 'Referencia opcional al incidente origen de la derivación';
COMMENT ON COLUMN derivaciones.profesional_asignado IS 'NULL = sin asignar, UUID = profesional del equipo de formación';
COMMENT ON TABLE derivacion_seguimientos IS 'Registro cronológico de seguimientos a derivaciones';
