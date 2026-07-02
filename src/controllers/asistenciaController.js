const asistenciaService = require('../services/asistenciaService')
const logger = require('../utils/logger')
const { supabase } = require('../utils/db')
const { registrarAuditoria } = require('../services/auditoriaService')

/**
 * POST /api/v1/asistencia/registrar
 * Body: { cursoId, fecha, bloque?, asistencias: [{ estudianteId, estado, observaciones? }] }
 */
const registrarHandler = async (req, res, next) => {
  try {
    const { tenant_id, user_id } = req.user
    const data = req.body

    const resultado = await asistenciaService.registrarAsistencia(tenant_id, data, user_id)

    res.status(201).json({
      status: 'success',
      message: `Asistencia registrada para ${resultado.registros} estudiantes`,
      data: resultado
    })
  } catch (error) {
    logger.error('Error en registrarHandler:', error)
    next(error)
  }
}

/**
 * GET /api/v1/asistencia/curso/:cursoId/fecha/:fecha
 * Query params: ?bloque=1 (opcional)
 */
const getCursoDiaHandler = async (req, res, next) => {
  try {
    const { tenant_id } = req.user
    const { cursoId, fecha } = req.params
    const bloque = req.query.bloque ? parseInt(req.query.bloque) : null

    const asistencia = await asistenciaService.getAsistenciaCurso(tenant_id, cursoId, fecha, bloque)

    res.status(200).json({
      status: 'success',
      message: `${asistencia.length} estudiantes encontrados`,
      data: asistencia
    })
  } catch (error) {
    logger.error('Error en getCursoDiaHandler:', error)
    next(error)
  }
}

/**
 * GET /api/v1/asistencia/estudiante/:id/resumen
 * Query params: ?fecha_desde=YYYY-MM-DD&fecha_hasta=YYYY-MM-DD
 */
const getEstudianteResumenHandler = async (req, res, next) => {
  try {
    const { tenant_id } = req.user
    const { id: estudianteId } = req.params
    const { fecha_desde, fecha_hasta } = req.query

    // Default últimos 30 días si no se especifica
    const fechaHasta = fecha_hasta || new Date().toISOString().split('T')[0]
    const fechaDesde = fecha_desde || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const resumen = await asistenciaService.calcularPorcentajeAsistencia(
      tenant_id,
      estudianteId,
      fechaDesde,
      fechaHasta
    )

    res.status(200).json({
      status: 'success',
      message: 'Resumen de asistencia calculado',
      data: resumen
    })
  } catch (error) {
    logger.error('Error en getEstudianteResumenHandler:', error)
    next(error)
  }
}

/**
 * GET /api/v1/asistencia/alertas
 * Query params: ?porcentaje_minimo=85 (default)
 */
const getAlertasHandler = async (req, res, next) => {
  try {
    const { tenant_id } = req.user
    const porcentajeMinimo = parseInt(req.query.porcentaje_minimo || '85')

    const estudiantesRiesgo = await asistenciaService.getEstudiantesEnRiesgo(tenant_id, porcentajeMinimo)

    res.status(200).json({
      status: 'success',
      message: `${estudiantesRiesgo.length} estudiantes en riesgo`,
      data: estudiantesRiesgo,
      meta: {
        total: estudiantesRiesgo.length,
        porcentaje_minimo: porcentajeMinimo
      }
    })
  } catch (error) {
    logger.error('Error en getAlertasHandler:', error)
    next(error)
  }
}

/**
 * PATCH /api/v1/asistencia/:id/justificar
 * Body: { observaciones, justificacion_adjunto? }
 */
const justificarHandler = async (req, res, next) => {
  try {
    const { tenant_id, user_id } = req.user
    const { id: asistenciaId } = req.params
    const { observaciones, justificacion_adjunto } = req.body

    if (!observaciones) {
      return res.status(400).json({
        status: 'error',
        message: 'El campo "observaciones" es requerido',
        statusCode: 400
      })
    }

    // Update asistencia record
    const { data, error } = await supabase
      .from('asistencia')
      .update({
        estado: 'Justificado',
        observaciones,
        justificacion_adjunto: justificacion_adjunto || null
      })
      .eq('id', asistenciaId)
      .eq('tenant_id', tenant_id)
      .select()
      .single()

    if (error) {
      throw new Error(`Error al justificar: ${error.message}`)
    }

    if (!data) {
      return res.status(404).json({
        status: 'error',
        message: 'Registro de asistencia no encontrado',
        statusCode: 404
      })
    }

    // Auditoría
    await registrarAuditoria({
      tenantId: tenant_id,
      usuarioId: user_id,
      accion: 'JUSTIFICAR_ASISTENCIA',
      tabla: 'asistencia',
      registroId: asistenciaId,
      descripcion: `Justificó ausencia: ${observaciones}`
    })

    res.status(200).json({
      status: 'success',
      message: 'Asistencia justificada exitosamente',
      data
    })
  } catch (error) {
    logger.error('Error en justificarHandler:', error)
    next(error)
  }
}

module.exports = {
  registrarHandler,
  getCursoDiaHandler,
  getEstudianteResumenHandler,
  getAlertasHandler,
  justificarHandler
}
