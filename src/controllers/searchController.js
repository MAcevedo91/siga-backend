const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

async function searchEstudiantes(req, res) {
  try {
    const { q } = req.query
    const tenantId = req.user.tenant_id
    const limite = parseInt(req.query.limit) || 20

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Parámetro q (query) es requerido'
      })
    }

    const { data, error } = await supabase.rpc('search_estudiantes', {
      p_tenant_id: tenantId,
      p_query: q.trim(),
      p_limite: limite
    })

    if (error) throw new Error(error.message)

    res.json({
      success: true,
      data: data || []
    })
  } catch (error) {
    logger.error('Error en búsqueda de estudiantes', {
      error: error.message,
      query: req.query.q
    })
    res.status(500).json({
      success: false,
      error: 'Error al buscar estudiantes'
    })
  }
}

async function searchIncidentes(req, res) {
  try {
    const { q } = req.query
    const tenantId = req.user.tenant_id
    const limite = parseInt(req.query.limit) || 20

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Parámetro q (query) es requerido'
      })
    }

    const { data, error } = await supabase.rpc('search_incidentes', {
      p_tenant_id: tenantId,
      p_query: q.trim(),
      p_limite: limite
    })

    if (error) throw new Error(error.message)

    res.json({
      success: true,
      data: data || []
    })
  } catch (error) {
    logger.error('Error en búsqueda de incidentes', {
      error: error.message,
      query: req.query.q
    })
    res.status(500).json({
      success: false,
      error: 'Error al buscar incidentes'
    })
  }
}

module.exports = {
  searchEstudiantes,
  searchIncidentes
}
