-- =============================================================================
-- MIGRACIÓN: Actualización del Catálogo de Protocolos RICE (Hallazgo 6)
-- Fecha: 19/10/2026
-- Establecimiento: Escuela Coeducacional N°1 El Salvador
-- Descripción:
--   1. Agrega soporte para 'activo' y 'descripcion' en tipos_protocolo.
--   2. Agrega protocolos: 'Acoso escolar', 'Ciberacoso', 'Maltrato entre adultos'.
--   3. Subsume 'Violencia intrafamiliar' y 'Abuso sexual' dentro de 'Vulneración de derechos'.
--   4. Desactiva tipos subsumidos para nuevos casos sin romper integridad de protocolos históricos.
-- =============================================================================

-- 1. Asegurar columnas de estado y descripción pedagógica
ALTER TABLE tipos_protocolo ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true;
ALTER TABLE tipos_protocolo ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- 2. Asegurar denominación de 'Vulneración de derechos' con glosa de inclusión
UPDATE tipos_protocolo
SET nombre = 'Vulneración de derechos',
    descripcion = 'Canaliza denuncias de vulneración grave, negligencia, violencia intrafamiliar (VIF) y agresiones sexuales conforme a normativa',
    activo = true
WHERE nombre IN ('Denuncia por vulneración de derechos', 'Vulneración de derechos');

-- 3. Incorporar nuevos protocolos requeridos por Escuela El Salvador
INSERT INTO tipos_protocolo (nombre, activo, descripcion)
VALUES
    ('Acoso escolar', true, 'Hostigamiento sistemático, asimétrico y reiterado entre estudiantes en el entorno escolar'),
    ('Ciberacoso', true, 'Acoso, amenazas u hostigamiento mediante redes sociales, mensajería o plataformas digitales'),
    ('Maltrato entre adultos', true, 'Conflictos o maltrato laboral entre funcionarios, docentes, directivos o apoderados')
ON CONFLICT (nombre) DO UPDATE
SET activo = true,
    descripcion = EXCLUDED.descripcion;

-- 4. Asignar descripciones institucionales a los protocolos normativos preexistentes
UPDATE tipos_protocolo
SET descripcion = 'Situaciones de agresión física, verbal o psicológica entre estudiantes'
WHERE nombre = 'Maltrato entre estudiantes' AND (descripcion IS NULL OR TRIM(descripcion) = '');

UPDATE tipos_protocolo
SET descripcion = 'Vulneración de deberes de cuidado o trato inapropiado de un adulto hacia un estudiante'
WHERE nombre = 'Maltrato de adulto a estudiante' AND (descripcion IS NULL OR TRIM(descripcion) = '');

UPDATE tipos_protocolo
SET descripcion = 'Detección, porte o sospecha de consumo de sustancias prohibidas en el establecimiento'
WHERE nombre = 'Consumo de drogas o alcohol' AND (descripcion IS NULL OR TRIM(descripcion) = '');

UPDATE tipos_protocolo
SET descripcion = 'Señales de alerta de riesgo vital o afectación a la integridad personal del estudiante'
WHERE nombre = 'Conducta suicida o autolesión' AND (descripcion IS NULL OR TRIM(descripcion) = '');

UPDATE tipos_protocolo
SET descripcion = 'Lesiones o emergencias médicas ocurridas durante la jornada escolar o trayecto directo'
WHERE nombre = 'Accidente escolar' AND (descripcion IS NULL OR TRIM(descripcion) = '');

UPDATE tipos_protocolo
SET descripcion = 'Situaciones emergentes del reglamento interno que requieran activación del debido proceso'
WHERE nombre = 'Otro protocolo normativo' AND (descripcion IS NULL OR TRIM(descripcion) = '');

-- 5. Subsumir protocolos específicos que deben tramitarse bajo Vulneración de Derechos
UPDATE tipos_protocolo
SET activo = false,
    descripcion = 'Subsumido dentro del protocolo de Vulneración de Derechos'
WHERE nombre IN (
    'Violencia intrafamiliar',
    'Abuso sexual entre estudiantes',
    'Abuso sexual por adulto'
);

-- 6. Sembrar reglas por defecto de 4 pasos para los nuevos protocolos en cada tenant existente
INSERT INTO reglas_protocolo (tenant_id, tipo_protocolo_id, orden, accion, plazo_dias, prorrogable, activo)
SELECT 
    t.id AS tenant_id,
    tp.id AS tipo_protocolo_id,
    p.orden,
    p.accion,
    p.plazo_dias,
    p.prorrogable,
    true AS activo
FROM tenants t
CROSS JOIN tipos_protocolo tp
CROSS JOIN (
    VALUES
        (1, 'Entrevista inicial y medidas cautelares de protección', 2, false),
        (2, 'Citación formal a apoderados y recopilación de antecedentes', 5, true),
        (3, 'Evaluación psicosocial y reporte a Dirección', 7, true),
        (4, 'Resolución formativa, medidas pedagógicas y derivación externa', 10, true)
) AS p(orden, accion, plazo_dias, prorrogable)
WHERE tp.nombre IN ('Acoso escolar', 'Ciberacoso', 'Maltrato entre adultos')
ON CONFLICT (tenant_id, tipo_protocolo_id, orden) DO NOTHING;
