-- =============================================================================
-- MIGRATION: Add calendario tables for events and reminders
-- Date: 2026-07-02
-- Description: Creates eventos, evento_participantes, evento_recordatorios
-- =============================================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLA: eventos
-- =============================================================================
CREATE TABLE eventos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('Reunión', 'Ceremonia', 'Actividad Curricular', 'Taller', 'Otro')),
    fecha_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE NOT NULL,
    ubicacion VARCHAR(255),
    creado_por UUID NOT NULL REFERENCES usuarios(id),
    curso_id UUID REFERENCES cursos(id) ON DELETE SET NULL, -- NULL = evento general
    es_publico BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = visible para todos del tenant
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_fecha_rango CHECK (fecha_fin >= fecha_inicio)
);

-- RLS Policy: multi-tenant isolation
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY eventos_tenant_isolation ON eventos
    USING (tenant_id::text = current_setting('app.tenant_id', TRUE));

-- Índices para queries frecuentes
CREATE INDEX idx_eventos_fecha ON eventos(tenant_id, fecha_inicio DESC);
CREATE INDEX idx_eventos_curso ON eventos(tenant_id, curso_id, fecha_inicio DESC) WHERE curso_id IS NOT NULL;
CREATE INDEX idx_eventos_tipo ON eventos(tenant_id, tipo, fecha_inicio DESC);

-- =============================================================================
-- TABLA: evento_participantes
-- =============================================================================
CREATE TABLE evento_participantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    estudiante_id UUID REFERENCES estudiantes(id) ON DELETE CASCADE,
    estado_confirmacion VARCHAR(20) CHECK (estado_confirmacion IN ('Pendiente', 'Confirmado', 'Rechazado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT participante_xor CHECK (
        (usuario_id IS NOT NULL AND estudiante_id IS NULL) OR
        (usuario_id IS NULL AND estudiante_id IS NOT NULL)
    ),
    CONSTRAINT unique_participante UNIQUE(evento_id, usuario_id, estudiante_id)
);

-- Índices
CREATE INDEX idx_participantes_evento ON evento_participantes(evento_id);
CREATE INDEX idx_participantes_usuario ON evento_participantes(usuario_id) WHERE usuario_id IS NOT NULL;
CREATE INDEX idx_participantes_estudiante ON evento_participantes(estudiante_id) WHERE estudiante_id IS NOT NULL;

-- =============================================================================
-- TABLA: evento_recordatorios
-- =============================================================================
CREATE TABLE evento_recordatorios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    minutos_antes INT NOT NULL CHECK (minutos_antes > 0), -- 15, 30, 60, 1440 (1 día)
    enviado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_envio TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para procesamiento de recordatorios
CREATE INDEX idx_recordatorios_pendientes ON evento_recordatorios(evento_id, enviado) WHERE NOT enviado;

-- Comentarios para documentación
COMMENT ON TABLE eventos IS 'Calendario de eventos escolares con soporte multi-tipo';
COMMENT ON COLUMN eventos.curso_id IS 'NULL = evento general del colegio, UUID = evento específico de curso';
COMMENT ON COLUMN eventos.es_publico IS 'TRUE = visible para todos del tenant, FALSE = solo participantes';
COMMENT ON TABLE evento_participantes IS 'Participantes de eventos (usuarios o estudiantes, XOR constraint)';
COMMENT ON TABLE evento_recordatorios IS 'Recordatorios programados para eventos';
