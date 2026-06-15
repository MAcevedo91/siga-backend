const { supabase } = require('../utils/db')

// Mapeo de método HTTP a acción de auditoría
const METHOD_TO_ACTION = {
  POST:   'CREATE',
  PUT:    'UPDATE',
  PATCH:  'UPDATE',
  DELETE: 'DELETE',
}

/**
 * Extrae el nombre de la tabla desde la URL.
 * Ej: /api/v1/incidentes/123 → 'incidentes'
 */
const extractTabla = (url) => {
  // Remueve el prefijo /api/v1/ y toma el primer segmento
  const path = url.replace(/^\/api\/v\d+\//, '')
  return path.split('/')[0] || 'unknown'
}

/**
 * Extrae el ID del recurso desde la URL.
 * Ej: /api/v1/incidentes/abc-123 → 'abc-123'
 * Retorna null si no hay ID en la URL.
 */
const extractRegistroId = (url) => {
  const path = url.replace(/^\/api\/v\d+\//, '')
  const segments = path.split('/')
  // El ID suele ser el segundo segmento (índice 1)
  return segments[1] || null
}

/**
 * Obtiene la IP real del cliente, considerando proxies.
 */
const getClientIp = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

/**
 * Middleware: registra eventos CRUD en la tabla auditoria.
 *
 * IMPORTANTE: El registro es completamente asíncrono (fire-and-forget).
 * No bloquea la respuesta al cliente bajo ninguna circunstancia.
 * Los errores de auditoría se loggean internamente pero nunca afectan
 * el flujo normal de la aplicación.
 */
const auditLogger = (req, res, next) => {
  const accion = METHOD_TO_ACTION[req.method]

  // Solo auditar métodos que modifican datos
  if (!accion) return next()

  // Interceptar el método json() para capturar el registro_id de la respuesta
  const originalJson = res.json.bind(res)

  res.json = (body) => {
    // Extraer el ID del recurso creado/modificado desde la respuesta
    // Convención: la respuesta exitosa tiene data.id o data[0].id
    let registroId = extractRegistroId(req.originalUrl)

    if (!registroId && body?.data?.id) {
      registroId = body.data.id
    }

    // Fire-and-forget: no await, no bloqueo
    setImmediate(async () => {
      try {
        // Solo auditar si hay usuario autenticado (req.user lo agrega authenticateToken)
        if (!req.user) return

        await supabase.from('auditoria').insert({
          tenant_id:      req.user.tenant_id,
          usuario_id:     req.user.user_id,
          accion,
          tabla_afectada: extractTabla(req.originalUrl),
          registro_id:    registroId,
          detalle: {
            method: req.method,
            url:    req.originalUrl,
            body:   req.body,
            status: res.statusCode,
          },
          ip: getClientIp(req),
        })
      } catch (err) {
        // Nunca interrumpir el flujo por un error de auditoría
        console.error('[AUDIT] Error al registrar evento:', err.message)
      }
    })

    // Llamar al json() original sin esperar la auditoría
    return originalJson(body)
  }

  next()
}

module.exports = auditLogger
