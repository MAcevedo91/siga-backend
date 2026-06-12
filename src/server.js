require('dotenv').config()

const app        = require('./app')
const { testConnection } = require('./utils/db')

const PORT = process.env.PORT || 3000

const start = async () => {
  // Verificar conexión a Supabase antes de levantar el servidor
  await testConnection()

  app.listen(PORT, () => {
    console.log(`[SERVER] ✓ Corriendo en http://localhost:${PORT}`)
    console.log(`[SERVER] ✓ Entorno: ${process.env.NODE_ENV}`)
    console.log(`[SERVER] ✓ Health check: http://localhost:${PORT}/api/v1/health`)
  })
}

start()
