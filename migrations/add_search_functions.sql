-- Función: Buscar estudiantes
CREATE OR REPLACE FUNCTION search_estudiantes(
  p_tenant_id UUID,
  p_query TEXT,
  p_limite INTEGER DEFAULT 20
)
RETURNS TABLE(
  id INTEGER,
  nombre VARCHAR,
  apellido VARCHAR,
  rut VARCHAR,
  curso_nombre VARCHAR,
  relevancia REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.nombre,
    e.apellido,
    e.rut,
    c.nombre as curso_nombre,
    ts_rank(e.search_vector, to_tsquery('spanish', p_query || ':*')) as relevancia
  FROM estudiantes e
  LEFT JOIN cursos c ON e.curso_id = c.id
  WHERE e.tenant_id = p_tenant_id
    AND e.search_vector @@ to_tsquery('spanish', p_query || ':*')
  ORDER BY relevancia DESC, e.nombre ASC
  LIMIT p_limite;
END;
$$ LANGUAGE plpgsql;

-- Función: Buscar incidentes
CREATE OR REPLACE FUNCTION search_incidentes(
  p_tenant_id UUID,
  p_query TEXT,
  p_limite INTEGER DEFAULT 20
)
RETURNS TABLE(
  id INTEGER,
  descripcion TEXT,
  gravedad VARCHAR,
  fecha DATE,
  estudiante_nombre VARCHAR,
  relevancia REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.descripcion,
    i.gravedad,
    i.fecha,
    e.nombre || ' ' || e.apellido as estudiante_nombre,
    ts_rank(i.search_vector, to_tsquery('spanish', p_query || ':*')) as relevancia
  FROM incidentes i
  LEFT JOIN estudiantes e ON i.estudiante_id = e.id
  WHERE i.tenant_id = p_tenant_id
    AND i.search_vector @@ to_tsquery('spanish', p_query || ':*')
  ORDER BY relevancia DESC, i.fecha DESC
  LIMIT p_limite;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION search_estudiantes IS 'Búsqueda full-text de estudiantes con ranking';
COMMENT ON FUNCTION search_incidentes IS 'Búsqueda full-text de incidentes con ranking';
