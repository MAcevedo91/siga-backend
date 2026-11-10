-- =============================================================================
-- MIGRACIÓN: Soporte de Normativa Nacional Subsidiaria (Circular N° 482) en RICE RAG
-- Fecha: 10/11/2026
-- Proyecto: SIGA Escolar
-- Descripción:
--   1. Permite tenant_id y subido_por NULL en rice_documentos y rice_chunks para documentos oficiales del Estado.
--   2. Actualiza políticas RLS para lectura compartida de normativas globales (tenant_id IS NULL).
--   3. Actualiza función RPC buscar_contexto_rice para devolver es_normativa_nacional y priorizar en cascada.
-- =============================================================================

-- 1. Permitir nulos para documentos y chunks de alcance nacional (Circular N° 482)
ALTER TABLE rice_documentos ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE rice_documentos ALTER COLUMN subido_por DROP NOT NULL;
ALTER TABLE rice_chunks ALTER COLUMN tenant_id DROP NOT NULL;

-- 2. Actualizar políticas RLS de lectura
DROP POLICY IF EXISTS tenant_isolation_rice_documentos ON rice_documentos;
CREATE POLICY tenant_isolation_rice_documentos ON rice_documentos
    FOR SELECT
    USING (
        tenant_id IS NULL 
        OR tenant_id = current_setting('app.tenant_id', true)::uuid
    );

DROP POLICY IF EXISTS tenant_isolation_rice_chunks ON rice_chunks;
CREATE POLICY tenant_isolation_rice_chunks ON rice_chunks
    FOR SELECT
    USING (
        tenant_id IS NULL 
        OR tenant_id = current_setting('app.tenant_id', true)::uuid
    );

-- 3. Actualizar función RPC buscar_contexto_rice
DROP FUNCTION IF EXISTS buscar_contexto_rice(UUID, vector, INT, FLOAT);
DROP FUNCTION IF EXISTS buscar_contexto_rice;

CREATE OR REPLACE FUNCTION buscar_contexto_rice(
    p_tenant_id            UUID,
    p_embedding            vector(768),
    p_match_count          INT DEFAULT 4,
    p_similarity_threshold FLOAT DEFAULT 0.35
)
RETURNS TABLE (
    id                    UUID,
    documento_id          UUID,
    seccion               TEXT,
    articulo              TEXT,
    contenido             TEXT,
    similitud             FLOAT,
    es_normativa_nacional BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        rc.id,
        rc.documento_id,
        rc.seccion,
        rc.articulo,
        rc.contenido,
        (1 - (rc.embedding <=> p_embedding))::FLOAT AS similitud,
        (rc.tenant_id IS NULL) AS es_normativa_nacional
    FROM rice_chunks rc
    INNER JOIN rice_documentos rd ON rc.documento_id = rd.id
    WHERE (rc.tenant_id = p_tenant_id OR rc.tenant_id IS NULL)
      AND rd.estado = 'activo'
      AND (1 - (rc.embedding <=> p_embedding)) >= p_similarity_threshold
    ORDER BY
        (rc.tenant_id = p_tenant_id) DESC, -- Prioriza fragmentos específicos del establecimiento
        rc.embedding <=> p_embedding ASC     -- Y luego mayor similitud semántica coseno
    LIMIT p_match_count;
END;
$$;
