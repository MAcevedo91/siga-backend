-- migrations/2026-07-02-add-mensajeria-tables.sql
-- TIER 3 Task 1: Mensajería Tables Migration

-- Conversaciones (hilos de chat)
CREATE TABLE conversaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('individual', 'grupo')),
    nombre VARCHAR(100), -- Solo para grupos
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversaciones_tenant_isolation ON conversaciones
    USING (tenant_id::text = current_setting('app.tenant_id', TRUE));

CREATE INDEX idx_conversaciones_tenant ON conversaciones(tenant_id, created_at DESC);

-- Participantes de conversaciones
CREATE TABLE conversacion_participantes (
    conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    ultimo_leido_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (conversacion_id, usuario_id)
);

CREATE INDEX idx_participantes_usuario ON conversacion_participantes(usuario_id);

-- Mensajes
CREATE TABLE mensajes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversacion_id UUID NOT NULL REFERENCES conversaciones(id) ON DELETE CASCADE,
    remitente_id UUID NOT NULL REFERENCES usuarios(id),
    contenido TEXT NOT NULL,
    adjunto_url VARCHAR(500),
    adjunto_nombre VARCHAR(200),
    adjunto_tipo VARCHAR(50),
    enviado_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    editado_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_mensajes_conversacion ON mensajes(conversacion_id, enviado_at DESC);
CREATE INDEX idx_mensajes_remitente ON mensajes(remitente_id, enviado_at DESC);

-- Broadcasts (comunicados masivos)
CREATE TABLE broadcasts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT NOT NULL,
    enviado_por UUID NOT NULL REFERENCES usuarios(id),
    destinatarios_tipo VARCHAR(50) NOT NULL CHECK (destinatarios_tipo IN ('curso', 'nivel', 'rol', 'todos')),
    destinatarios_ids UUID[], -- Array de IDs según tipo
    programado_para TIMESTAMP WITH TIME ZONE,
    enviado_at TIMESTAMP WITH TIME ZONE,
    confirmacion_lectura BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY broadcasts_tenant_isolation ON broadcasts
    USING (tenant_id::text = current_setting('app.tenant_id', TRUE));

CREATE INDEX idx_broadcasts_tenant ON broadcasts(tenant_id, enviado_at DESC);
CREATE INDEX idx_broadcasts_programado ON broadcasts(tenant_id, programado_para) WHERE programado_para IS NOT NULL AND enviado_at IS NULL;

-- Lecturas de broadcasts
CREATE TABLE broadcast_lecturas (
    broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    leido_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (broadcast_id, usuario_id)
);

CREATE INDEX idx_lecturas_broadcast ON broadcast_lecturas(broadcast_id);
CREATE INDEX idx_lecturas_usuario ON broadcast_lecturas(usuario_id, leido_at DESC);

-- Comentarios
COMMENT ON TABLE conversaciones IS 'Hilos de chat 1-1 o grupales';
COMMENT ON TABLE mensajes IS 'Mensajes individuales dentro de conversaciones';
COMMENT ON TABLE broadcasts IS 'Comunicados masivos con destinatarios configurables';
COMMENT ON COLUMN conversaciones.tipo IS 'individual: 1-1, grupo: múltiples participantes';
COMMENT ON COLUMN broadcasts.destinatarios_tipo IS 'curso/nivel/rol/todos - determina cómo interpretar destinatarios_ids';
