const reporteEspecialistaService = require('../services/reporteEspecialistaService')
const pdfFichaEspecialistaService = require('../services/pdfFichaEspecialistaService')
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

/**
 * GET /api/v1/estudiantes/:id/ficha-medica-pdf
 * GET /api/estudiantes/:id/ficha-medica-pdf
 *
 * Genera y descarga la Ficha Médica/Psicológica Oficial de 2 páginas en PDF con membrete y hash SHA-256.
 * Exclusivo para roles Directivos y Psicosociales (Administrador, Directivo, Equipo de Formación).
 */
const descargarFichaSaludPdfHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const estudianteId = req.params.id || req.params.estudianteId

    const opciones = {
      motivo: req.query?.motivo || 'Evaluación médica o psicológica externa',
      especialistaDestino: req.query?.especialista || 'Especialista Externo de Salud',
      ip: req.ip || req.headers?.['x-forwarded-for'] || null,
    }

    const expediente = await reporteEspecialistaService.extraerExpedienteEspecialistaSalud(
      tenantId,
      estudianteId,
      req.user,
      opciones
    )

    const pdfBuffer = await pdfFichaEspecialistaService.generarFichaSaludPDF(expediente)
    const hashInmutable = pdfFichaEspecialistaService.calcularHashFichaSalud(expediente)
    const rutLimpio = (expediente.estudiante_evaluado?.rut || 'estudiante').replace(/\./g, '')

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="ficha-salud-${rutLimpio}.pdf"`)
    res.setHeader('Content-Length', pdfBuffer.length)
    res.setHeader('X-Hash-Autenticidad-SHA256', hashInmutable)

    res.status(200).send(pdfBuffer)
  } catch (err) {
    logger.error('Error en descargarFichaSaludPdfHandler:', err)
    next(err)
  }
}

module.exports = {
  obtenerExpedienteSaludHandler,
  descargarFichaSaludPdfHandler,
}
