-- =============================================================================
-- MIGRACIÓN: Tabla protocolo_pasos y Script de Retrocompatibilidad
-- Fecha: 08/09/2026
-- Autor: Marcelo Andrés Acevedo Silva (Líder Backend & PM)
-- Proyecto: SIGA Escolar - Sprint 5 (Checklist RICE Normativo)
-- =============================================================================

-- 1. CREACIÓN DE LA TABLA protocolo_pasos
CREATE TABLE IF NOT EXISTS protocolo_pasos (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    protocolo_id      UUID NOT NULL REFERENCES protocolos_rice(id) ON DELETE CASCADE,
    regla_id          UUID REFERENCES reglas_protocolo(id) ON DELETE SET NULL,
    orden             SMALLINT NOT NULL,
    accion            TEXT NOT NULL,
    plazo_dias        SMALLINT NOT NULL,
    completado        BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_completado  TIMESTAMP WITH TIME ZONE,
    responsable_id    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    observacion       TEXT,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_protocolo_paso_orden UNIQUE (protocolo_id, orden)
);

-- 2. ÍNDICES DE RENDIMIENTO Y BÚSQUEDA
CREATE INDEX IF NOT EXISTS idx_protocolo_pasos_protocolo  ON protocolo_pasos(protocolo_id);
CREATE INDEX IF NOT EXISTS idx_protocolo_pasos_tenant     ON protocolo_pasos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_protocolo_pasos_completado ON protocolo_pasos(protocolo_id, completado);

-- 3. HABILITACIÓN DE ROW LEVEL SECURITY (RLS)
ALTER TABLE protocolo_pasos ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICA DE AISLAMIENTO MULTI-TENANT
DROP POLICY IF EXISTS tenant_isolation_protocolo_pasos ON protocolo_pasos;
CREATE POLICY tenant_isolation_protocolo_pasos ON protocolo_pasos
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- 5. TRIGGER PARA ACTUALIZAR updated_at AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION actualizar_timestamp_protocolo_pasos()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_protocolo_pasos ON protocolo_pasos;
CREATE TRIGGER trg_actualizar_protocolo_pasos
    BEFORE UPDATE ON protocolo_pasos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp_protocolo_pasos();

-- =============================================================================
-- 6. SCRIPT DE RETROCOMPATIBILIDAD (Backfill para protocolos históricos)
-- =============================================================================
-- Vincula los pasos normativos definidos en reglas_protocolo a todos los protocolos
-- que actualmente no posean registros en protocolo_pasos.
DO $$
DECLARE
    prot RECORD;
    regla RECORD;
    pasos_insertados INT := 0;
BEGIN
    FOR prot IN
        SELECT p.id, p.tenant_id, p.tipo_protocolo_id, p.estado, p.fecha_apertura, p.fecha_cierre, p.registrado_por
        FROM protocolos_rice p
        WHERE NOT EXISTS (
            SELECT 1 FROM protocolo_pasos pp WHERE pp.protocolo_id = p.id
        )
    LOOP
        FOR regla IN
            SELECT r.id, r.orden, r.accion, r.plazo_dias
            FROM reglas_protocolo r
            WHERE r.tenant_id = prot.tenant_id
              AND r.tipo_protocolo_id = prot.tipo_protocolo_id
              AND r.activo = TRUE
            ORDER BY r.orden ASC
        LOOP
            INSERT INTO protocolo_pasos (
                tenant_id,
                protocolo_id,
                regla_id,
                orden,
                accion,
                plazo_dias,
                completado,
                fecha_completado,
                responsable_id,
                observacion
            ) VALUES (
                prot.tenant_id,
                prot.id,
                regla.id,
                regla.orden,
                regla.accion,
                regla.plazo_dias,
                CASE WHEN prot.estado = 'Cerrado' THEN TRUE ELSE FALSE END,
                CASE WHEN prot.estado = 'Cerrado' THEN COALESCE(prot.fecha_cierre, prot.fecha_apertura)::timestamp with time zone ELSE NULL END,
                CASE WHEN prot.estado = 'Cerrado' THEN prot.registrado_por ELSE NULL END,
                CASE WHEN prot.estado = 'Cerrado' THEN 'Paso completado automáticamente por migración de retrocompatibilidad.' ELSE NULL END
            )
            ON CONFLICT (protocolo_id, orden) DO NOTHING;

            pasos_insertados := pasos_insertados + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Migración de retrocompatibilidad finalizada. Total pasos procesados: %', pasos_insertados;
END $$;
