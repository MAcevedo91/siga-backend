const citacionesService = require('../services/citacionesService')
const logger = require('../utils/logger')

/**
 * POST /api/v1/citaciones y POST /api/citaciones
 * Programa una nueva citación formativa. Valida disponibilidad del docente y pertenencia.
 */
const crearCitacionHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const docenteId = req.user.user_id || req.user.id

    const data = await citacionesService.crearCitacion(tenantId, docenteId, req.body)

    res.status(201).json({
      status: 'success',
      message: 'Citación pedagógica-formativa programada exitosamente',
      data,
    })
  } catch (err) {
    logger.error('Error en crearCitacionHandler:', err)
    next(err)
  }
}

/**
 * GET /api/v1/citaciones y GET /api/citaciones
 * Lista el historial de citaciones del establecimiento con paginación y filtros.
 */
const listarCitacionesHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const data = await citacionesService.listarCitaciones(tenantId, req.query)

    res.status(200).json({
      status: 'success',
      ...data,
    })
  } catch (err) {
    logger.error('Error en listarCitacionesHandler:', err)
    next(err)
  }
}

/**
 * GET /api/v1/citaciones/public/token/:token y GET /api/citaciones/public/token/:token
 * Endpoint público para abrir la colilla de citación en el móvil del apoderado sin autenticación.
 */
const obtenerCitacionPublicaHandler = async (req, res, next) => {
  try {
    const { token } = req.params
    const data = await citacionesService.obtenerCitacionPublicaPorToken(token)

    res.status(200).json({
      status: 'success',
      data,
    })
  } catch (err) {
    logger.error('Error en obtenerCitacionPublicaHandler:', err)
    next(err)
  }
}

/**
 * POST /api/v1/citaciones/public/responder y POST /api/citaciones/public/responder
 * Endpoint público para procesar la respuesta en 1-clic del apoderado (confirmar, reprogramar, justificar).
 */
const responderCitacionPublicaHandler = async (req, res, next) => {
  try {
    const resultado = await citacionesService.responderCitacionPublica(req.body)

    res.status(200).json({
      status: 'success',
      message: resultado.mensaje,
      data: resultado.citacion,
    })
  } catch (err) {
    logger.error('Error en responderCitacionPublicaHandler:', err)
    next(err)
  }
}

/**
 * POST /api/v1/citaciones/:id/acuerdos y POST /api/citaciones/:id/acuerdos
 * Registra los acuerdos mutuos y cierra formalmente la entrevista formativa (TASK 10.2.3).
 */
const registrarAcuerdosHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const userId = req.user.user_id || req.user.id
    const { id } = req.params

    const data = await citacionesService.registrarAcuerdosMutuos(tenantId, id, userId, req.body)

    res.status(201).json({
      status: 'success',
      message: 'Acuerdos mutuos registrados y acta oficial emitida exitosamente',
      data,
    })
  } catch (err) {
    logger.error('Error en registrarAcuerdosHandler:', err)
    next(err)
  }
}

/**
 * GET /api/v1/citaciones/:id/acta-pdf y GET /api/citaciones/:id/acta-pdf
 * Descarga el Buffer binario del Acta Oficial de Citación con membrete y código SHA-256 (TASK 10.2.3).
 */
const descargarActaPdfHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const { id } = req.params

    const { pdfBuffer, folio } = await citacionesService.obtenerActaCitacionPDF(tenantId, id)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="Acta_Citacion_${folio}.pdf"`)
    res.status(200).send(pdfBuffer)
  } catch (err) {
    logger.error('Error en descargarActaPdfHandler:', err)
    next(err)
  }
}

/**
 * GET /api/v1/citaciones/metricas y GET /api/citaciones/metricas
 * Retorna analítica agregada de participación familiar, asistencia y motivos formativos (TASK 10.3.1).
 */
const obtenerMetricasHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const data = await citacionesService.obtenerMetricasCitaciones(tenantId, req.query)

    res.status(200).json({
      status: 'success',
      data,
    })
  } catch (err) {
    logger.error('Error en obtenerMetricasHandler:', err)
    next(err)
  }
}

/**
 * GET /api/v1/citaciones/estudiante/:estudianteId y GET /api/citaciones/estudiante/:estudianteId
 * Retorna el historial cronológico y resumen de citaciones de un estudiante (TASK 10.3.1).
 */
const obtenerHistorialEstudianteHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const { estudianteId } = req.params

    const data = await citacionesService.obtenerHistorialCitacionesEstudiante(tenantId, estudianteId)

    res.status(200).json({
      status: 'success',
      data,
    })
  } catch (err) {
    logger.error('Error en obtenerHistorialEstudianteHandler:', err)
    next(err)
  }
}

module.exports = {
  crearCitacionHandler,
  listarCitacionesHandler,
  obtenerCitacionPublicaHandler,
  responderCitacionPublicaHandler,
  registrarAcuerdosHandler,
  descargarActaPdfHandler,
  obtenerMetricasHandler,
  obtenerHistorialEstudianteHandler,
}
