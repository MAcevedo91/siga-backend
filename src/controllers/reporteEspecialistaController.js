const reporteEspecialistaService = require('../services/reporteEspecialistaService')
const logger = require('../utils/logger')

/**
 * GET /api/v1/estudiantes/:id/expediente-salud
 * GET /api/estudiantes/:id/expediente-salud
 *
 * Extrae el expediente escolar y conductual sanitizado para derivación externa a salud.
 * Exclusivo para roles Directivos y Psicosociales (Administrador, Directivo, Equipo de Formación).
 */
const obtenerExpedienteSaludHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const estudianteId = req.params.id || req.params.estudianteId

    const opciones = {
      motivo: req.query?.motivo || req.body?.motivo || 'Evaluación médica o psicológica externa',
      especialistaDestino: req.query?.especialista || req.body?.especialista || 'Especialista Externo de Salud',
      ip: req.ip || req.headers?.['x-forwarded-for'] || null,
    }

    const expediente = await reporteEspecialistaService.extraerExpedienteEspecialistaSalud(
      tenantId,
      estudianteId,
      req.user,
      opciones
    )

    res.status(200).json({
      status: 'success',
      message: 'Expediente clínico-escolar sanitizado exitosamente',
      data: expediente,
      ...expediente,
    })
  } catch (err) {
    logger.error('Error en obtenerExpedienteSaludHandler:', err)
    next(err)
  }
}

module.exports = {
  obtenerExpedienteSaludHandler,
}
