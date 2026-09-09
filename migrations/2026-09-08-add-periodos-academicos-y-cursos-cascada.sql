-- =============================================================================
-- MIGRACIÓN: Períodos Académicos y Estructura Jerárquica de Cursos (HU 5.5 - Tarea 5.5.1)
-- Fecha: 2026-09-08
-- Descripción: Crea la tabla periodos_academicos con RLS, agrega periodo_id y letra
--              a cursos, crea índices y realiza backfill para el período 2026.
-- =============================================================================

-- 1. Crear tabla periodos_academicos
CREATE TABLE IF NOT EXISTS periodos_academicos (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    anio        INT NOT NULL,
    fecha_inicio DATE,
    fecha_fin    DATE,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_periodo_tenant UNIQUE (tenant_id, anio)
);

-- 2. Habilitar RLS y definir política de aislamiento multi-tenant
ALTER TABLE periodos_academicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_periodos ON periodos_academicos;
CREATE POLICY tenant_isolation_periodos ON periodos_academicos
    FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 3. Alterar tabla cursos para incorporar periodo_id y letra
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS periodo_id UUID REFERENCES periodos_academicos(id) ON DELETE RESTRICT;
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS letra VARCHAR(5);

-- 4. Índices para búsqueda rápida en cascada (< 100ms)
CREATE INDEX IF NOT EXISTS idx_periodos_tenant_activo ON periodos_academicos(tenant_id, activo);
CREATE INDEX IF NOT EXISTS idx_cursos_periodo_nivel   ON cursos(tenant_id, periodo_id, nivel);
CREATE INDEX IF NOT EXISTS idx_cursos_nivel_letra     ON cursos(tenant_id, nivel, letra);

-- 5. Backfill: Crear período 2026 para todos los tenants existentes
INSERT INTO periodos_academicos (tenant_id, anio, fecha_inicio, fecha_fin, activo)
SELECT id, 2026, '2026-03-01'::date, '2026-12-31'::date, true
FROM tenants
ON CONFLICT (tenant_id, anio) DO NOTHING;

-- 6. Backfill: Asociar cursos actuales al período 2026 y separar letra y nivel
UPDATE cursos c
SET 
  periodo_id = p.id,
  letra = COALESCE(NULLIF(SUBSTRING(c.nombre FROM '\s+([A-Za-z0-9]{1,2})$'), ''), 'A'),
  nivel = CASE 
    WHEN c.nombre ~ '\s+[A-Za-z0-9]{1,2}$' 
    THEN TRIM(REGEXP_REPLACE(c.nombre, '\s+[A-Za-z0-9]{1,2}$', ''))
    ELSE c.nombre 
  END
FROM periodos_academicos p
WHERE c.tenant_id = p.tenant_id
  AND p.anio = 2026
  AND c.periodo_id IS NULL;
