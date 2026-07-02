-- =============================================================================
-- Migration: Add Full-Text Search with tsvector and GIN indexes
-- Adds full-text search capabilities to estudiantes and incidentes tables
-- =============================================================================

-- Add search_vector column to estudiantes table
ALTER TABLE estudiantes
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Add search_vector column to incidentes table
ALTER TABLE incidentes
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- =============================================================================
-- CREATE FUNCTION: Update estudiantes search_vector
-- Combines nombre, apellido, rut, email with relevance weights
-- Weight A (highest) = nombre, apellido
-- Weight B (medium) = rut
-- Weight C (lower) = email
-- =============================================================================
CREATE OR REPLACE FUNCTION estudiantes_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', COALESCE(NEW.nombre, '')), 'A') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.apellido, '')), 'A') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.rut, '')), 'B') ||
    setweight(to_tsvector('spanish', COALESCE(CAST(NEW.email AS text), '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CREATE FUNCTION: Update incidentes search_vector
-- Combines descripcion/relato, gravedad, lugar with relevance weights
-- Weight A (highest) = relato (description of incident)
-- Weight B (medium) = gravedad (severity level)
-- Weight C (lower) = lugar (place/location if available)
-- =============================================================================
CREATE OR REPLACE FUNCTION incidentes_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('spanish', COALESCE(NEW.relato, '')), 'A') ||
    setweight(to_tsvector('spanish', COALESCE(NEW.gravedad, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CREATE TRIGGERS: Drop existing triggers if present, then create new ones
-- These triggers automatically update search_vector on INSERT or UPDATE
-- =============================================================================
DROP TRIGGER IF EXISTS estudiantes_search_update ON estudiantes;
CREATE TRIGGER estudiantes_search_update
  BEFORE INSERT OR UPDATE ON estudiantes
  FOR EACH ROW EXECUTE FUNCTION estudiantes_search_vector_trigger();

DROP TRIGGER IF EXISTS incidentes_search_update ON incidentes;
CREATE TRIGGER incidentes_search_update
  BEFORE INSERT OR UPDATE ON incidentes
  FOR EACH ROW EXECUTE FUNCTION incidentes_search_vector_trigger();

-- =============================================================================
-- UPDATE EXISTING ROWS: Populate search_vector for existing records
-- This ensures all historical data is searchable
-- =============================================================================
UPDATE estudiantes SET search_vector =
  setweight(to_tsvector('spanish', COALESCE(nombre, '')), 'A') ||
  setweight(to_tsvector('spanish', COALESCE(apellido, '')), 'A') ||
  setweight(to_tsvector('spanish', COALESCE(rut, '')), 'B') ||
  setweight(to_tsvector('spanish', COALESCE(CAST(email AS text), '')), 'C')
WHERE search_vector IS NULL;

UPDATE incidentes SET search_vector =
  setweight(to_tsvector('spanish', COALESCE(relato, '')), 'A') ||
  setweight(to_tsvector('spanish', COALESCE(gravedad, '')), 'B')
WHERE search_vector IS NULL;

-- =============================================================================
-- CREATE GIN INDEXES: Fast full-text search indexes
-- GIN (Generalized Inverted Index) is optimized for full-text search
-- These indexes significantly speed up @@ operator queries
-- =============================================================================
CREATE INDEX IF NOT EXISTS estudiantes_search_idx ON estudiantes USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS incidentes_search_idx ON incidentes USING GIN (search_vector);

-- =============================================================================
-- COMMENTS: Documentation for future reference
-- =============================================================================
COMMENT ON COLUMN estudiantes.search_vector IS 'Full-text search vector (nombre, apellido, rut, email) - updated via trigger on INSERT/UPDATE';
COMMENT ON COLUMN incidentes.search_vector IS 'Full-text search vector (relato, gravedad) - updated via trigger on INSERT/UPDATE';
COMMENT ON FUNCTION estudiantes_search_vector_trigger IS 'Automatically updates search_vector for estudiantes table on INSERT/UPDATE with Spanish language weights';
COMMENT ON FUNCTION incidentes_search_vector_trigger IS 'Automatically updates search_vector for incidentes table on INSERT/UPDATE with Spanish language weights';
