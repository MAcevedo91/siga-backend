-- =============================================================================
-- MIGRACIÓN: Módulo de Citaciones de Colaboración Pedagógica-Formativa (Sprint 10 / Épica 10)
-- Tabla: citaciones_formativas, secuencia y trigger de Folio único CIT-YYYY-XXXX
-- Autor: Marcelo Andrés Acevedo Silva (Líder Backend & Data Architect)
-- Proyecto: SIGA Escolar
-- Fecha: 04/11/2026
-- =============================================================================

-- 1. EXTENSIÓN UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SECUENCIA ATÓMICA PARA FOLIOS (CIT-YYYY-XXXX)
CREATE SEQUENCE IF NOT EXISTS seq_citaciones_folio START WITH 1;

-- 3. TABLA PRINCIPAL: citaciones_formativas
CREATE TABLE IF NOT EXISTS public.citaciones_formativas (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio                       VARCHAR(20) UNIQUE NOT NULL,
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    estudiante_id               UUID NOT NULL REFERENCES estudiantes(id) ON DELETE RESTRICT,
    apoderado_id                UUID NOT NULL REFERENCES apoderados(id) ON DELETE RESTRICT,
    docente_id                  UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    motivo_categoria            VARCHAR(50) NOT NULL CHECK (motivo_categoria IN (
                                    'refuerzo_academico',
                                    'habitos_asistencia',
                                    'reconocimiento_felicitacion',
                                    'acuerdos_convivencia',
                                    'seguimiento_formativo'
                                )),
    motivo_detalle              TEXT NOT NULL,
    fecha_hora_programada       TIMESTAMP WITH TIME ZONE NOT NULL,
    lugar_entrevista            VARCHAR(100) DEFAULT 'Sala de Entrevistas / Convivencia Escolar',
    modalidad                   VARCHAR(20) NOT NULL DEFAULT 'presencial' CHECK (modalidad IN ('presencial', 'virtual')),
    enlace_virtual              TEXT,
    
    -- Token de Confirmación Móvil Segura (Validez de 72 horas)
    token_confirmacion          UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    token_expira_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '72 hours'),
    
    -- Estados controlados del ciclo de vida de la citación
    estado                      VARCHAR(30) NOT NULL DEFAULT 'programada' CHECK (estado IN (
                                    'programada',
                                    'confirmada',
                                    'reprogramacion_solicitada',
                                    'justificada',
                                    'realizada',
                                    'no_asiste',
                                    'cancelada'
                                )),
    
    -- Interacción Móvil del Apoderado (1-clic responsive)
    fecha_respuesta_apoderado   TIMESTAMP WITH TIME ZONE,
    comentario_apoderado        TEXT,
    nueva_fecha_solicitada      TIMESTAMP WITH TIME ZONE,
    
    -- Cierre y Acta Oficial de Entrevista
    conclusiones_entrevista     TEXT,
    realizada_at                TIMESTAMP WITH TIME ZONE,
    
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. ÍNDICES B-TREE DE ALTO RENDIMIENTO Y MULTI-TENANT
CREATE INDEX IF NOT EXISTS idx_citaciones_tenant_estado      ON public.citaciones_formativas(tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_citaciones_token_confirmacion ON public.citaciones_formativas(token_confirmacion);
CREATE INDEX IF NOT EXISTS idx_citaciones_folio              ON public.citaciones_formativas(folio);
CREATE INDEX IF NOT EXISTS idx_citaciones_estudiante         ON public.citaciones_formativas(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_citaciones_apoderado          ON public.citaciones_formativas(apoderado_id);
CREATE INDEX IF NOT EXISTS idx_citaciones_docente            ON public.citaciones_formativas(docente_id);
CREATE INDEX IF NOT EXISTS idx_citaciones_tenant_fecha       ON public.citaciones_formativas(tenant_id, fecha_hora_programada);

-- 5. HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.citaciones_formativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citaciones_formativas FORCE ROW LEVEL SECURITY;

-- 6. POLÍTICA DE AISLAMIENTO MULTI-TENANT
DROP POLICY IF EXISTS tenant_isolation_citaciones ON public.citaciones_formativas;
CREATE POLICY tenant_isolation_citaciones ON public.citaciones_formativas
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 7. TRIGGER AUTOMÁTICO: GENERACIÓN DE FOLIO ÚNICO (CIT-YYYY-XXXX)
CREATE OR REPLACE FUNCTION trg_generar_folio_citacion_fn()
RETURNS TRIGGER AS $$
DECLARE
    v_anio TEXT;
    v_seq  INT;
BEGIN
    IF NEW.folio IS NULL OR TRIM(NEW.folio) = '' THEN
        v_anio := to_char(CURRENT_DATE, 'YYYY');
        v_seq  := nextval('seq_citaciones_folio');
        NEW.folio := 'CIT-' || v_anio || '-' || LPAD(v_seq::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generar_folio_citacion ON public.citaciones_formativas;
CREATE TRIGGER trg_generar_folio_citacion
    BEFORE INSERT ON public.citaciones_formativas
    FOR EACH ROW
    EXECUTE FUNCTION trg_generar_folio_citacion_fn();

-- 8. TRIGGER AUTOMÁTICO: ACTUALIZACIÓN DE updated_at
CREATE OR REPLACE FUNCTION actualizar_timestamp_citaciones()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_timestamp_citaciones ON public.citaciones_formativas;
CREATE TRIGGER trg_actualizar_timestamp_citaciones
    BEFORE UPDATE ON public.citaciones_formativas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp_citaciones();
