-- =============================================================================
-- MIGRACIÓN: Evaluación de Compromisos, Cierre Inmutable y Enlace RICE (TASK 7.2.4.1)
-- Autor: Marcelo Andrés Acevedo Silva (Líder Backend & Data Architect)
-- Proyecto: SIGA Escolar
-- Fecha: 21/10/2026
-- =============================================================================

-- 1. Agregar columna de estado granular a mediacion_compromisos
ALTER TABLE mediacion_compromisos
ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'pendiente'
CHECK (estado IN ('pendiente', 'cumplido', 'parcial', 'incumplido'));

-- Sincronizar registros preexistentes en mediacion_compromisos
UPDATE mediacion_compromisos
SET estado = CASE 
    WHEN cumplido = TRUE THEN 'cumplido'
    ELSE 'pendiente'
END
WHERE estado IS NULL OR estado = 'pendiente';

-- Índice para consultas de seguimiento y cumplimiento
CREATE INDEX IF NOT EXISTS idx_mediacion_compromisos_estado_eval 
ON mediacion_compromisos(estado);

-- 2. Agregar columnas de sellado inmutable y enlace RICE a mediaciones
ALTER TABLE mediaciones
ADD COLUMN IF NOT EXISTS cerrada_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE mediaciones
ADD COLUMN IF NOT EXISTS cerrada_por_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE mediaciones
ADD COLUMN IF NOT EXISTS protocolo_id UUID REFERENCES protocolos_rice(id) ON DELETE SET NULL;

-- Índice para consultas de expedientes sellados
CREATE INDEX IF NOT EXISTS idx_mediaciones_cerrada_at 
ON mediaciones(cerrada_at);

CREATE INDEX IF NOT EXISTS idx_mediaciones_protocolo_enlazado 
ON mediaciones(protocolo_id);
