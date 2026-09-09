-- =============================================================================
-- MIGRACIÓN: Condición PIE y Domicilio Familiar (HU 5.4 - Tarea 5.4.1)
-- Fecha: 2026-09-08
-- Descripción: Agrega soporte en el modelo relacional para condición PIE (Programa
--              de Integración Escolar) y domicilios de estudiante y apoderado.
-- =============================================================================

-- 1. Agregar es_pie y direccion a la tabla estudiantes
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS es_pie BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS direccion VARCHAR(255);

-- 2. Agregar direccion a la tabla apoderados
ALTER TABLE apoderados ADD COLUMN IF NOT EXISTS direccion VARCHAR(255);

-- 3. Índice para optimizar consultas y reportes de estudiantes PIE por tenant
CREATE INDEX IF NOT EXISTS idx_estudiantes_pie ON estudiantes(tenant_id, es_pie);
