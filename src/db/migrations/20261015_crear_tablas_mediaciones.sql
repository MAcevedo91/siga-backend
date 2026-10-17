-- =============================================================================
-- MIGRACIÓN: Módulo de Mediación Escolar y Acuerdos Formativos (Sprint 7 / Épica 7.2)
-- Tablas: mediaciones, mediacion_participantes, secuencia y trigger de Folio único
-- Autor: Marcelo Andrés Acevedo Silva (Líder Backend & Data Architect)
-- Proyecto: SIGA Escolar
-- Fecha: 15/10/2026
-- =============================================================================

-- 1. EXTENSIÓN UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SECUENCIA ATÓMICA PARA FOLIOS (MED-YYYY-XXXX)
CREATE SEQUENCE IF NOT EXISTS seq_mediaciones_folio START WITH 1;

-- 3. TABLA PRINCIPAL: mediaciones
CREATE TABLE IF NOT EXISTS mediaciones (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folio                   VARCHAR(20) UNIQUE NOT NULL,
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    incidente_id            UUID REFERENCES incidentes(id) ON DELETE SET NULL,
    mediador_id             UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo_origen             VARCHAR(30) NOT NULL DEFAULT 'preventiva_convivencia'
                            CHECK (tipo_origen IN (
                                'derivada_incidente', 
                                'preventiva_convivencia', 
                                'solicitud_estudiante', 
                                'solicitud_apoderado'
                            )),
    estado                  VARCHAR(30) NOT NULL DEFAULT 'borrador'
                            CHECK (estado IN (
                                'borrador', 
                                'programada', 
                                'en_sesion', 
                                'acordada', 
                                'sin_acuerdo', 
                                'derivada_inspectoria'
                            )),
    motivo                  TEXT NOT NULL,
    fecha_programada        TIMESTAMP WITH TIME ZONE NOT NULL,
    lugar_sesion            VARCHAR(100) DEFAULT 'Oficina de Convivencia Escolar',
    observaciones_previas   TEXT,
    fecha_seguimiento       TIMESTAMP WITH TIME ZONE,
    conclusiones_cierre     TEXT,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABLA DETALLE: mediacion_participantes
CREATE TABLE IF NOT EXISTS mediacion_participantes (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mediacion_id                UUID NOT NULL REFERENCES mediaciones(id) ON DELETE CASCADE,
    tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    estudiante_id               UUID NOT NULL REFERENCES estudiantes(id) ON DELETE RESTRICT,
    rol_participante            VARCHAR(30) NOT NULL DEFAULT 'parte_1'
                                CHECK (rol_participante IN (
                                    'parte_1', 
                                    'parte_2', 
                                    'afectado', 
                                    'mediador_par', 
                                    'observador'
                                )),
    aviso_apoderado_enviado     BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_aviso_apoderado       TIMESTAMP WITH TIME ZONE,
    medio_aviso                 VARCHAR(30) 
                                CHECK (medio_aviso IN (
                                    'correo', 
                                    'comunicacion_escrita', 
                                    'llamada_telefonica'
                                )),
    apoderado_notificado_email  VARCHAR(255),
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_estudiante_en_mediacion UNIQUE (mediacion_id, estudiante_id)
);

-- 5. ÍNDICES B-TREE DE RENDIMIENTO Y BÚSQUEDA MULTI-TENANT
CREATE INDEX IF NOT EXISTS idx_mediaciones_tenant_estado        ON mediaciones(tenant_id, estado);
CREATE INDEX IF NOT EXISTS idx_mediaciones_folio                ON mediaciones(folio);
CREATE INDEX IF NOT EXISTS idx_mediaciones_incidente            ON mediaciones(incidente_id);
CREATE INDEX IF NOT EXISTS idx_mediaciones_mediador             ON mediaciones(mediador_id);
CREATE INDEX IF NOT EXISTS idx_mediacion_part_estudiante        ON mediacion_participantes(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_mediacion_part_mediacion         ON mediacion_participantes(mediacion_id);
CREATE INDEX IF NOT EXISTS idx_mediacion_part_tenant            ON mediacion_participantes(tenant_id);

-- 6. HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
ALTER TABLE mediaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mediaciones FORCE ROW LEVEL SECURITY;
ALTER TABLE mediacion_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mediacion_participantes FORCE ROW LEVEL SECURITY;

-- 7. POLÍTICAS DE AISLAMIENTO MULTI-TENANT (Resistente a strings vacíos con NULLIF)
DROP POLICY IF EXISTS tenant_isolation_mediaciones ON mediaciones;
CREATE POLICY tenant_isolation_mediaciones ON mediaciones
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_mediacion_participantes ON mediacion_participantes;
CREATE POLICY tenant_isolation_mediacion_participantes ON mediacion_participantes
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- 8. TRIGGER AUTOMÁTICO: GENERACIÓN DE FOLIO ÚNICO (MED-YYYY-XXXX)
CREATE OR REPLACE FUNCTION trg_generar_folio_mediacion_fn()
RETURNS TRIGGER AS $$
DECLARE
    v_anio TEXT;
    v_seq  INT;
BEGIN
    IF NEW.folio IS NULL OR TRIM(NEW.folio) = '' THEN
        v_anio := to_char(CURRENT_DATE, 'YYYY');
        v_seq  := nextval('seq_mediaciones_folio');
        NEW.folio := 'MED-' || v_anio || '-' || LPAD(v_seq::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generar_folio_mediacion ON mediaciones;
CREATE TRIGGER trg_generar_folio_mediacion
    BEFORE INSERT ON mediaciones
    FOR EACH ROW
    EXECUTE FUNCTION trg_generar_folio_mediacion_fn();

-- 9. TRIGGER AUTOMÁTICO: ACTUALIZACIÓN DE updated_at
CREATE OR REPLACE FUNCTION actualizar_timestamp_mediaciones()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_timestamp_mediaciones ON mediaciones;
CREATE TRIGGER trg_actualizar_timestamp_mediaciones
    BEFORE UPDATE ON mediaciones
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp_mediaciones();
