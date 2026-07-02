-- Tabla de notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
  id SERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL, -- 'incidente', 'protocolo', 'sistema', 'email'
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT NOT NULL,
  url VARCHAR(500), -- Deep link a la entidad relacionada
  leida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  leida_at TIMESTAMP,
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Índices para consultas frecuentes
CREATE INDEX idx_notificaciones_usuario ON notificaciones(usuario_id, leida, created_at DESC);
CREATE INDEX idx_notificaciones_tenant ON notificaciones(tenant_id);

-- RLS Policy
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY notificaciones_tenant_isolation ON notificaciones
  USING (tenant_id::text = current_setting('app.tenant_id', TRUE));

-- Política adicional: usuarios solo ven sus notificaciones
CREATE POLICY notificaciones_usuario_own ON notificaciones
  FOR SELECT
  USING (usuario_id::text = current_setting('app.user_id', TRUE));

COMMENT ON TABLE notificaciones IS 'Notificaciones push para usuarios del sistema';
