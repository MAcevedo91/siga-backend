const { supabase } = require('../utils/db')
const { broadcastQueue } = require('../services/broadcastsService')
const logger = require('../utils/logger')

/**
 * Cron job: chequea broadcasts programados listos para enviar.
 * Corre cada minuto.
 */
const procesarBroadcastsProgramados = async () => {
  try {
    logger.info('[BroadcastProgramado] Chequeando broadcasts pendientes')

    // Query broadcasts con programado_para <= NOW() AND enviado_at IS NULL
    const { data: broadcasts, error } = await supabase
      .from('broadcasts')
      .select('id, tenant_id')
      .lte('programado_para', new Date().toISOString())
      .is('enviado_at', null)

    if (error) {
      logger.error('[BroadcastProgramado] Error querying broadcasts:', error)
      return
    }

    if (broadcasts.length === 0) {
      logger.info('[BroadcastProgramado] No hay broadcasts pendientes')
      return
    }

    logger.info(`[BroadcastProgramado] ${broadcasts.length} broadcasts listos para enviar`)

    // Encolar cada broadcast
    for (const broadcast of broadcasts) {
      await broadcastQueue.add(
        { broadcastId: broadcast.id, tenantId: broadcast.tenant_id },
        { priority: 2 } // Alta prioridad
      )
    }

    logger.info(`[BroadcastProgramado] ${broadcasts.length} broadcasts encolados`)
  } catch (error) {
    logger.error('[BroadcastProgramado] Error:', error)
  }
}

module.exports = {
  procesarBroadcastsProgramados
}
