-- =============================================================================
-- MIGRACIÓN: AGREGAR COLUMNAS PARA EL SOCIOGRAMA Y FICHA DE ESTUDIANTES
-- Fecha: 2026-11-09
-- =============================================================================

ALTER TABLE estudiantes 
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS genero VARCHAR(20) DEFAULT 'No especificado',
ADD COLUMN IF NOT EXISTS estado_matricula VARCHAR(30) DEFAULT 'activa';

COMMENT ON COLUMN estudiantes.avatar_url IS 'URL pública del avatar o fotografía del estudiante';
COMMENT ON COLUMN estudiantes.genero IS 'Género del estudiante para análisis relacional no estigmatizante';
COMMENT ON COLUMN estudiantes.estado_matricula IS 'Estado de matrícula vigente (activa, retirada, egresada)';
