const mediacionesService = require('../services/mediacionesService')
const pdfMediacionService = require('../services/pdfMediacionService')
const emailServiceMediacion = require('../services/emailServiceMediacion')
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

/**
 * PUT /api/v1/mediaciones/:id/compromisos
 * Guarda de forma atómica los compromisos y acuerdos formativos de la mediación.
 */
const guardarCompromisosHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const usuarioId = req.user.user_id || req.user.id
    const { id } = req.params

    const data = await mediacionesService.guardarCompromisos(
      tenantId,
      id,
      usuarioId,
      req.body
    )

    res.status(200).json({
      status: 'success',
      message: 'Compromisos de mediación registrados y actualizados exitosamente',
      data,
    })
  } catch (err) {
    logger.error('Error en guardarCompromisosHandler (mediaciones):', err)
    next(err)
  }
}

/**
 * GET /api/v1/mediaciones/:id/compromisos
 * Retorna todos los compromisos formativos vigentes de la mediación.
 */
const listarCompromisosHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const { id } = req.params

    const data = await mediacionesService.listarCompromisos(tenantId, id)

    res.status(200).json({
      status: 'success',
      total: data.length,
      data,
    })
  } catch (err) {
    logger.error('Error en listarCompromisosHandler (mediaciones):', err)
    next(err)
  }
}

/**
 * GET /api/v1/mediaciones/:id/acta-pdf
 * Genera y descarga el Acta Oficial de Mediación Escolar en formato PDF con hash SHA-256.
 */
const descargarActaPdfHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const { id } = req.params

    const mediacion = await mediacionesService.obtenerMediacionPorId(tenantId, id)
    const pdfBuffer = await pdfMediacionService.generarActaMediacionPDF(mediacion)

    const folioSeguro = (mediacion.folio || 'S-F').replace(/[^a-zA-Z0-9_-]/g, '_')

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="Acta_Mediacion_${folioSeguro}.pdf"`)
    res.setHeader('Content-Length', pdfBuffer.length)

    res.status(200).send(pdfBuffer)
  } catch (err) {
    logger.error('Error en descargarActaPdfHandler (mediaciones):', err)
    next(err)
  }
}

/**
 * POST /api/v1/mediaciones/:id/despachar-acta
 * Despacha transaccionalmente el Acta Oficial en PDF a apoderados titulares y profesores jefes desduplicados.
 */
const despacharActaHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const usuarioId = req.user.user_id || req.user.id
    const { id } = req.params

    const resultado = await emailServiceMediacion.despacharActaOficial({
      tenantId,
      mediacionId: id,
      usuarioId,
    })

    res.status(200).json({
      status: 'success',
      message: 'Acta oficial de mediación despachada exitosamente',
      data: resultado,
    })
  } catch (err) {
    logger.error('Error en despacharActaHandler (mediaciones):', err)
    next(err)
  }
}

module.exports = {
  crearHandler,
  listarHandler,
  obtenerHandler,
  notificarApoderadosHandler,
  guardarCompromisosHandler,
  listarCompromisosHandler,
  descargarActaPdfHandler,
  despacharActaHandler,
}
