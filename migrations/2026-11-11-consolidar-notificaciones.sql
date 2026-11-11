-- =============================================================================
-- MIGRACIÓN: Consolidación y Blindaje de Tabla de Notificaciones en Tiempo Real
-- Fecha: 2026-11-11
-- Descripción: Unifica el esquema de notificaciones para soportar WebSocket rooms,
--              alertas dirigidas por rol/usuario, deep links y trazabilidad multi-tenant.
-- =============================================================================

-- 1. Crear tabla si no existe
CREATE TABLE IF NOT EXISTS notificaciones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_id     UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo           VARCHAR(50) NOT NULL DEFAULT 'sistema',
    titulo         VARCHAR(255) NOT NULL DEFAULT 'Notificación',
    mensaje        TEXT NOT NULL,
    url            VARCHAR(500),
    leida          BOOLEAN NOT NULL DEFAULT FALSE,
    metadata       JSONB DEFAULT '{}'::jsonb,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    leida_at       TIMESTAMP WITH TIME ZONE
);

-- 2. Asegurar columnas necesarias en instalaciones previas de la tabla
DO $$
BEGIN
    -- usuario_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='usuario_id') THEN
        ALTER TABLE notificaciones ADD COLUMN usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE;
    END IF;

    -- tipo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='tipo') THEN
        ALTER TABLE notificaciones ADD COLUMN tipo VARCHAR(50) NOT NULL DEFAULT 'sistema';
    END IF;

    -- titulo
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='titulo') THEN
        ALTER TABLE notificaciones ADD COLUMN titulo VARCHAR(255) NOT NULL DEFAULT 'Notificación';
    END IF;

    -- url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='url') THEN
        ALTER TABLE notificaciones ADD COLUMN url VARCHAR(500);
    END IF;

    -- leida
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='leida') THEN
        ALTER TABLE notificaciones ADD COLUMN leida BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    -- metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='metadata') THEN
        ALTER TABLE notificaciones ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- created_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='created_at') THEN
        ALTER TABLE notificaciones ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- leida_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='leida_at') THEN
        ALTER TABLE notificaciones ADD COLUMN leida_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Relajar columnas heredadas para no romper inserciones basadas en usuario_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='incidente_id') THEN
        ALTER TABLE notificaciones ALTER COLUMN incidente_id DROP NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='destinatario') THEN
        ALTER TABLE notificaciones ALTER COLUMN destinatario DROP NOT NULL;
    END IF;
END $$;

-- 3. Índices optimizados para alto rendimiento
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida ON notificaciones(usuario_id, leida, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tenant_created ON notificaciones(tenant_id, created_at DESC);

-- 4. Aislamiento Multi-Tenant y Seguridad RLS
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificaciones_tenant_isolation ON notificaciones;
CREATE POLICY notificaciones_tenant_isolation ON notificaciones
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
