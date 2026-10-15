const mediacionesService = require('../services/mediacionesService')
const logger = require('../utils/logger')

/**
 * POST /api/v1/mediaciones
 * Crea una nueva mediación escolar con sus estudiantes participantes.
 */
const crearHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const mediadorId = req.user.user_id || req.user.id

    const data = await mediacionesService.crearMediacion(tenantId, mediadorId, req.body)

    res.status(201).json({
      status: 'success',
      message: 'Mediación escolar creada exitosamente',
      data,
    })
  } catch (err) {
    logger.error('Error en crearHandler (mediaciones):', err)
    next(err)
  }
}

/**
 * GET /api/v1/mediaciones
 * Retorna el listado paginado y filtrable de mediaciones escolares del tenant.
 */
const listarHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const resultado = await mediacionesService.listarMediaciones(tenantId, req.query)

    res.status(200).json({
      status: 'success',
      message: `${resultado.total} mediación(es) encontrada(s)`,
      ...resultado,
    })
  } catch (err) {
    logger.error('Error en listarHandler (mediaciones):', err)
    next(err)
  }
}

/**
 * GET /api/v1/mediaciones/:id
 * Retorna el expediente y participantes de una mediación específica.
 */
const obtenerHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const { id } = req.params

    const data = await mediacionesService.obtenerMediacionPorId(tenantId, id)

    res.status(200).json({
      status: 'success',
      data,
    })
  } catch (err) {
    logger.error('Error en obtenerHandler (mediaciones):', err)
    next(err)
  }
}

/**
 * POST /api/v1/mediaciones/:id/notificar-apoderados
 * Registra la marca temporal del aviso y envía notificación formal a apoderados.
 */
const notificarApoderadosHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const usuarioId = req.user.user_id || req.user.id
    const { id } = req.params

    const data = await mediacionesService.notificarApoderados(
      tenantId,
      id,
      usuarioId,
      req.body
    )

    res.status(200).json({
      status: 'success',
      message: 'Aviso a apoderados registrado y procesado exitosamente',
      data,
    })
  } catch (err) {
    logger.error('Error en notificarApoderadosHandler (mediaciones):', err)
    next(err)
  }
}

module.exports = {
  crearHandler,
  listarHandler,
  obtenerHandler,
  notificarApoderadosHandler,
}
