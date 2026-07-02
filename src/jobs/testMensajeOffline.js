/**
 * Script de prueba manual para mensaje offline job
 *
 * Uso:
 *   node src/jobs/testMensajeOffline.js <userId> <remitenteId> <conversacionId>
 *
 * Ejemplo:
 *   node src/jobs/testMensajeOffline.js 550e8400-e29b-41d4-a716-446655440000 550e8400-e29b-41d4-a716-446655440001 550e8400-e29b-41d4-a716-446655440002
 */

require('dotenv').config()
const mensajeOfflineQueue = require('../queues/mensajeOfflineQueue')
const { procesarMensajeOffline } = require('./mensajeOfflineJob')

// Setup queue processor
mensajeOfflineQueue.process(async (job) => {
  return await procesarMensajeOffline(job)
})

// Parse arguments
const [userId, remitenteId, conversacionId] = process.argv.slice(2)

if (!userId || !remitenteId || !conversacionId) {
  console.error('Error: Faltan argumentos')
  console.error('Uso: node src/jobs/testMensajeOffline.js <userId> <remitenteId> <conversacionId>')
  process.exit(1)
}

// Create test message
const testMensaje = {
  remitente_id: remitenteId,
  contenido: 'Este es un mensaje de prueba para verificar el email offline. ¿Lo recibiste correctamente?',
  adjunto_url: null,
  adjunto_nombre: null,
  adjunto_tipo: null
}

console.log('🚀 Encolando mensaje offline de prueba...')
console.log('Usuario destinatario:', userId)
console.log('Remitente:', remitenteId)
console.log('Conversación:', conversacionId)

// Add job to queue
mensajeOfflineQueue.add(
  {
    userId,
    mensaje: testMensaje,
    conversacionId
  },
  { priority: 3 }
).then((job) => {
  console.log(`✅ Job encolado con ID: ${job.id}`)
  console.log('Esperando procesamiento...')
}).catch((error) => {
  console.error('❌ Error encolando job:', error)
  process.exit(1)
})

// Monitor queue events
mensajeOfflineQueue.on('completed', (job, result) => {
  console.log(`✅ Job ${job.id} completado:`, result)
  process.exit(0)
})

mensajeOfflineQueue.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} falló:`, err.message)
  process.exit(1)
})

// Keep process alive
console.log('Esperando resultados (Ctrl+C para cancelar)...')
