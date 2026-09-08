const { Router } = require('express')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

const router = Router()

/**
 * GET /api/v1/cursos
 * Lista todos los cursos del tenant actual
 */
router.get('/', async (req, res, next) => {
  try {
    const { tenant_id } = req.user
    const { data, error } = await supabase
      .from('cursos')
      .select('id, nombre, nivel, anio_academico')
      .eq('tenant_id', tenant_id)
      .order('nombre', { ascending: true })

    if (error) {
      logger.error('Error al listar cursos:', error)
      throw error
    }

    res.status(200).json({
      status: 'success',
      message: `${(data || []).length} cursos encontrados`,
      data: data || []
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
