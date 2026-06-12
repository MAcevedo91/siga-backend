const { createClient } = require('@supabase/supabase-js')

// Cliente de Supabase con service_role key (acceso total, solo en backend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

/**
 * Verifica la conexión a Supabase al iniciar el servidor.
 * Lanza un error y detiene el proceso si la conexión falla.
 */
const testConnection = async () => {
  try {
    const { error } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)

    if (error) throw error

    console.log('[DB] ✓ Conexión a Supabase verificada')
  } catch (err) {
    console.error('[DB] ✗ Error al conectar con Supabase:', err.message)
    process.exit(1) // Detiene el servidor si no hay BD
  }
}

module.exports = { supabase, testConnection }
