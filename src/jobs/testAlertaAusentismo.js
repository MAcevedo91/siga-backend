/**
 * Script de prueba manual para alertaAusentismoJob
 *
 * Uso:
 *   node src/jobs/testAlertaAusentismo.js <tenantId>
 *
 * Ejemplo:
 *   node src/jobs/testAlertaAusentismo.js "00000000-0000-0000-0000-000000000001"
 */

require('dotenv').config()

const { procesarAlertaAusentismo } = require('./alertaAusentismoJob')
const logger = require('../utils/logger')

const tenantId = process.argv[2]

if (!tenantId) {
  console.error('Error: Debe proporcionar un tenantId')
  console.error('Uso: node src/jobs/testAlertaAusentismo.js <tenantId>')
  process.exit(1)
}

// Simular job de Bull
const mockJob = {
  data: {
    tenantId
  },
  id: `test-${Date.now()}`
}

async function test() {
  try {
    logger.info(`[Test] Ejecutando job de alerta de ausentismo para tenant: ${tenantId}`)
    const resultado = await procesarAlertaAusentismo(mockJob)
    logger.info('[Test] Job completado exitosamente:', resultado)
    console.log('\n✅ Test exitoso!')
    console.log('Resultado:', JSON.stringify(resultado, null, 2))
    process.exit(0)
  } catch (error) {
    logger.error('[Test] Error ejecutando job:', error)
    console.error('\n❌ Test fallido!')
    console.error('Error:', error.message)
    process.exit(1)
  }
}

test()
