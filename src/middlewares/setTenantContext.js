const { supabase } = require('../utils/db')

/**
 * Middleware: establece el tenant_id en la sesión de PostgreSQL
 * para activar las políticas RLS en Supabase.
 *
 * Llama a la función set_tenant(uuid) que definimos en el schema.sql,
 * la cual ejecuta set_config('app.tenant_id', ...) internamente.
 *
 * IMPORTANTE: debe usarse siempre DESPUÉS de authenticateToken,
 * ya que depende de req.user.tenant_id.
 *
 * Este middleware es asíncrono pero no bloquea la respuesta ante
 * errores no críticos — loggea el error y continúa.
 */
const setTenantContext = async (req, res, next) => {
  if (!req.user?.tenant_id) return next()

  try {
    await supabase.rpc('set_tenant', { p_tenant_id: req.user.tenant_id })
  } catch (err) {
    // Log interno — no interrumpe el flujo
    console.error('[TENANT] Error al establecer tenant_id:', err.message)
  }

  next()
}

module.exports = setTenantContext
