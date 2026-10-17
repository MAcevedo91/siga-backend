-- =============================================================================
-- MIGRACIÓN: Módulo RAG Normativo RICE (Reglamento Interno y de Convivencia Escolar)
-- Fecha: 08/10/2026
-- Proyecto: SIGA Escolar
-- Descripción:
--   1. Habilita extensión pgvector en Supabase/PostgreSQL.
--   2. Crea tabla rice_documentos (metadatos, versión y vigencia del RICE por tenant).
--   3. Crea tabla rice_chunks (fragmentos de texto limpios con embeddings vectoriales).
--   4. Configura índices HNSW para búsqueda rápida de similitud coseno.
--   5. Implementa Row Level Security (RLS) para aislamiento estricto multi-tenant.
--   6. Crea función RPC buscar_contexto_rice para inferencia RAG.
-- =============================================================================

-- 1. HABILITAR EXTENSIÓN VECTORIAL
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABLA: rice_documentos
CREATE TABLE IF NOT EXISTS rice_documentos (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    formato        VARCHAR(10) NOT NULL DEFAULT 'pdf' CHECK (formato IN ('pdf', 'md')),
    anio_vigencia  INT NOT NULL,
    version        INT NOT NULL DEFAULT 1,
    estado         VARCHAR(20) NOT NULL DEFAULT 'procesando'
                   CHECK (estado IN ('procesando', 'activo', 'obsoleto', 'error')),
    total_chunks   INT NOT NULL DEFAULT 0,
    subido_por     UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    metadata       JSONB DEFAULT '{}'::jsonb,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de rice_documentos
CREATE INDEX IF NOT EXISTS idx_rice_documentos_tenant ON rice_documentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rice_documentos_estado ON rice_documentos(tenant_id, estado);

-- RLS para rice_documentos
ALTER TABLE rice_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_rice_documentos ON rice_documentos;
CREATE POLICY tenant_isolation_rice_documentos ON rice_documentos
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Trigger de updated_at para rice_documentos
CREATE OR REPLACE FUNCTION actualizar_timestamp_rice_documentos()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_rice_documentos ON rice_documentos;
CREATE TRIGGER trg_actualizar_rice_documentos
    BEFORE UPDATE ON rice_documentos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_timestamp_rice_documentos();


-- 3. TABLA: rice_chunks
CREATE TABLE IF NOT EXISTS rice_chunks (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    documento_id UUID NOT NULL REFERENCES rice_documentos(id) ON DELETE CASCADE,
    numero_chunk INT NOT NULL,
    seccion      TEXT,
    articulo     TEXT,
    contenido    TEXT NOT NULL,
    embedding    vector(768),
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices de rice_chunks
CREATE INDEX IF NOT EXISTS idx_rice_chunks_tenant ON rice_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rice_chunks_documento ON rice_chunks(documento_id);

-- Índice Vectorial HNSW optimizado para distancia coseno (<=>)
CREATE INDEX IF NOT EXISTS idx_rice_chunks_embedding
    ON rice_chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- RLS para rice_chunks
ALTER TABLE rice_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_rice_chunks ON rice_chunks;
CREATE POLICY tenant_isolation_rice_chunks ON rice_chunks
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);


-- 4. FUNCIÓN RPC: buscar_contexto_rice
-- Retorna los fragmentos más relevantes de acuerdo a la distancia coseno
-- garantizando aislamiento estricto por tenant_id.
DROP FUNCTION IF EXISTS buscar_contexto_rice;
CREATE OR REPLACE FUNCTION buscar_contexto_rice(
    p_tenant_id            UUID,
    p_embedding            vector(768),
    p_match_count          INT DEFAULT 4,
    p_similarity_threshold FLOAT DEFAULT 0.50
)
RETURNS TABLE (
    id           UUID,
    documento_id UUID,
    seccion      TEXT,
    articulo     TEXT,
    contenido    TEXT,
    similitud    FLOAT
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
        (1 - (rc.embedding <=> p_embedding))::FLOAT AS similitud
    FROM rice_chunks rc
    INNER JOIN rice_documentos rd ON rc.documento_id = rd.id
    WHERE rc.tenant_id = p_tenant_id
      AND rd.estado = 'activo'
      AND (1 - (rc.embedding <=> p_embedding)) >= p_similarity_threshold
    ORDER BY rc.embedding <=> p_embedding ASC
    LIMIT p_match_count;
END;
$$;
