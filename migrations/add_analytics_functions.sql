-- Función: Contar estudiantes con muchos incidentes
CREATE OR REPLACE FUNCTION contar_estudiantes_con_muchos_incidentes(
  p_tenant_id UUID,
  p_fecha_desde TIMESTAMP,
  p_minimo_incidentes INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT estudiante_id) INTO v_count
  FROM incidentes
  WHERE tenant_id = p_tenant_id
    AND fecha >= p_fecha_desde
  GROUP BY estudiante_id
  HAVING COUNT(*) >= p_minimo_incidentes;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Función: Top estudiantes con más incidentes
CREATE OR REPLACE FUNCTION obtener_top_estudiantes_incidentes(
  p_tenant_id UUID,
  p_limite INTEGER DEFAULT 5
)
RETURNS TABLE(
  estudiante_id INTEGER,
  nombre VARCHAR,
  apellido VARCHAR,
  curso_nombre VARCHAR,
  cantidad_incidentes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.nombre,
    e.apellido,
    c.nombre as curso_nombre,
    COUNT(i.id) as cantidad_incidentes
  FROM estudiantes e
  LEFT JOIN incidentes i ON e.id = i.estudiante_id AND i.tenant_id = p_tenant_id
  LEFT JOIN cursos c ON e.curso_id = c.id
  WHERE e.tenant_id = p_tenant_id
  GROUP BY e.id, e.nombre, e.apellido, c.nombre
  HAVING COUNT(i.id) > 0
  ORDER BY cantidad_incidentes DESC
  LIMIT p_limite;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION contar_estudiantes_con_muchos_incidentes IS 'Cuenta estudiantes con N o más incidentes desde fecha';
COMMENT ON FUNCTION obtener_top_estudiantes_incidentes IS 'Retorna top N estudiantes con más incidentes';
