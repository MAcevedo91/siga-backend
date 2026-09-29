-- =============================================================================
-- MIGRACIÓN: Tabla reportes_incidentes y Triggers de Integridad Normativa
-- Fecha: 29/09/2026
-- Autor: Marcelo Andrés Acevedo Silva (Líder Backend & PM)
-- Proyecto: SIGA Escolar - Sprint 6 (Tarea 6.1.1: Asistente IA y Reportería)
-- =============================================================================

-- 1. CREACIÓN DE LA TABLA reportes_incidentes
CREATE TABLE IF NOT EXISTS reportes_incidentes (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    incidente_id            UUID NOT NULL REFERENCES incidentes(id) ON DELETE CASCADE,
    estudiante_id           UUID NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    version                 INT NOT NULL DEFAULT 1,
    estado                  VARCHAR(20) NOT NULL DEFAULT 'Borrador' 
                            CHECK (estado IN ('Borrador', 'Aprobado')),
    contenido_borrador      JSONB NOT NULL,
    contenido_editado       JSONB,
    contenido_aprobado      JSONB,
    creado_por              UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    aprobado_por            UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_aprobacion        TIMESTAMP WITH TIME ZONE,
    email_apoderado_enviado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_envio_email       TIMESTAMP WITH TIME ZONE,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_reporte_incidente_estudiante_version UNIQUE (incidente_id, estudiante_id, version)
);

-- 2. ÍNDICES DE RENDIMIENTO Y BÚSQUEDA MULTI-TENANT
CREATE INDEX IF NOT EXISTS idx_reportes_incidentes_tenant     ON reportes_incidentes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reportes_incidentes_incidente  ON reportes_incidentes(incidente_id);
CREATE INDEX IF NOT EXISTS idx_reportes_incidentes_estudiante ON reportes_incidentes(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_reportes_incidentes_estado     ON reportes_incidentes(tenant_id, estado);

-- 3. HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
ALTER TABLE reportes_incidentes ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICA DE AISLAMIENTO MULTI-TENANT
DROP POLICY IF EXISTS tenant_isolation_reportes_incidentes ON reportes_incidentes;
CREATE POLICY tenant_isolation_reportes_incidentes ON reportes_incidentes
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 5. TRIGGER PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION actualizar_timestamp_reportes_incidentes()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_reportes_incidentes ON reportes_incidentes;
CREATE TRIGGER trg_actualizar_reportes_incidentes
    BEFORE UPDATE ON reportes_incidentes
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp_reportes_incidentes();

-- 6. TRIGGER DE INTEGRIDAD: VALIDAR QUE EL ESTUDIANTE PERTENEZCA AL INCIDENTE
-- Evita generar o vincular reportes a estudiantes que no figuran en incidente_estudiantes.
CREATE OR REPLACE FUNCTION validar_estudiante_en_reporte()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM incidente_estudiantes
        WHERE incidente_id  = NEW.incidente_id
          AND estudiante_id = NEW.estudiante_id
    ) THEN
        RAISE EXCEPTION
            'Integridad violada: el estudiante % no figura como involucrado en el incidente %',
            NEW.estudiante_id, NEW.incidente_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_estudiante_en_reporte ON reportes_incidentes;
CREATE TRIGGER trg_validar_estudiante_en_reporte
    BEFORE INSERT OR UPDATE ON reportes_incidentes
    FOR EACH ROW
    EXECUTE FUNCTION validar_estudiante_en_reporte();
