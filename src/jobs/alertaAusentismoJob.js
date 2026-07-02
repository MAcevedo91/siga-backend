const asistenciaService = require('../services/asistenciaService')
const emailService = require('../services/emailService')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

/**
 * Job diario: detecta estudiantes con ausentismo >15% y envía email a Dirección.
 * Corre a las 9 AM todos los días.
 */
const procesarAlertaAusentismo = async (job) => {
  const { tenantId } = job.data

  try {
    logger.info(`[AlertaAusentismo] Procesando para tenant: ${tenantId}`)

    // 1. Obtener estudiantes en riesgo (< 85% asistencia)
    const estudiantesRiesgo = await asistenciaService.getEstudiantesEnRiesgo(tenantId, 85)

    if (estudiantesRiesgo.length === 0) {
      logger.info(`[AlertaAusentismo] No hay estudiantes en riesgo para tenant ${tenantId}`)
      return { mensaje: 'Sin estudiantes en riesgo' }
    }

    // 2. Obtener emails de usuarios Directivos del tenant
    const { data: directivos, error } = await supabase
      .from('usuarios')
      .select('email, nombre, apellido')
      .eq('tenant_id', tenantId)
      .eq('rol', 'Directivo')

    if (error || !directivos || directivos.length === 0) {
      logger.warn(`[AlertaAusentismo] No se encontraron directivos para tenant ${tenantId}`)
      return { mensaje: 'Sin directivos para notificar' }
    }

    // 3. Construir email con lista de estudiantes
    const listaEstudiantes = estudiantesRiesgo
      .map((e, idx) =>
        `${idx + 1}. ${e.apellido}, ${e.nombre} (${e.curso}) - ${e.porcentajeAsistencia}% asistencia (${e.diasAusente} días ausente)`
      )
      .join('\n')

    const htmlContent = `
      <h2>🚨 Alerta de Ausentismo Escolar</h2>
      <p>Se han detectado <strong>${estudiantesRiesgo.length} estudiantes</strong> con ausentismo superior al 15% en los últimos 30 días.</p>

      <h3>Estudiantes en Riesgo:</h3>
      <pre>${listaEstudiantes}</pre>

      <p>Por favor, revisar cada caso y tomar las medidas correspondientes.</p>

      <p><small>Este es un mensaje automático generado por SIGA Escolar.</small></p>
    `

    // 4. Enviar email a cada directivo
    for (const directivo of directivos) {
      await emailService.enviarEmail({
        to: directivo.email,
        subject: `Alerta: ${estudiantesRiesgo.length} estudiantes con ausentismo crítico`,
        html: htmlContent
      })

      logger.info(`[AlertaAusentismo] Email enviado a ${directivo.email}`)
    }

    return {
      mensaje: `Alerta enviada a ${directivos.length} directivos`,
      estudiantesRiesgo: estudiantesRiesgo.length
    }
  } catch (error) {
    logger.error('[AlertaAusentismo] Error procesando job:', error)
    throw error // Bull reintentará el job
  }
}

module.exports = {
  procesarAlertaAusentismo
}
