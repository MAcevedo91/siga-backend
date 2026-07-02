require('dotenv').config()

// Must be first import - Initialize Sentry before anything else
const { initSentry } = require('./utils/sentry')
initSentry()

const app        = require('./app')
const logger     = require('./utils/logger')
const { testConnection } = require('./utils/db')

const PORT = process.env.PORT || 3000

const start = async () => {
  // Verificar conexión a Supabase antes de levantar el servidor
  await testConnection()

  app.listen(PORT, () => {
    logger.info('Server started', {
      port: PORT,
      environment: process.env.NODE_ENV,
      healthCheck: `http://localhost:${PORT}/api/v1/health`
    })
  })
}

start()
