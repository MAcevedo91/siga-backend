const redis = require('./redis')
const logger = require('./logger')

const CACHE_TTL = {
  ASISTENCIA_DIA: 3600, // 1 hora
  ALERTAS: 1800 // 30 minutos
}

/**
 * Genera cache key para asistencia de curso/día.
 */
const getCacheKeyAsistenciaDia = (tenantId, cursoId, fecha, bloque) => {
  return `asistencia:${tenantId}:${cursoId}:${fecha}:${bloque || 'dia'}`
}

/**
 * Genera cache key para alertas de ausentismo.
 */
const getCacheKeyAlertas = (tenantId, porcentajeMinimo) => {
  return `alertas-ausentismo:${tenantId}:${porcentajeMinimo}`
}

/**
 * Wrapper genérico con cache-aside pattern.
 */
const withCache = async (cacheKey, ttl, fetchFn) => {
  try {
    // 1. Intentar obtener del cache
    const cached = await redis.get(cacheKey)
    if (cached) {
      logger.debug(`Cache HIT: ${cacheKey}`)
      return JSON.parse(cached)
    }

    // 2. Cache MISS - fetch data
    logger.debug(`Cache MISS: ${cacheKey}`)
    const data = await fetchFn()

    // 3. Guardar en cache
    await redis.setEx(cacheKey, ttl, JSON.stringify(data))

    return data
  } catch (error) {
    logger.error('Error en cache:', error)
    // Fallback: ejecutar fetch sin cache
    return await fetchFn()
  }
}

/**
 * Invalida cache de asistencia de un día específico.
 */
const invalidateAsistenciaDia = async (tenantId, cursoId, fecha) => {
  try {
    const pattern = `asistencia:${tenantId}:${cursoId}:${fecha}:*`
    const keys = await redis.keys(pattern)

    if (keys.length > 0) {
      await redis.del(...keys)
      logger.info(`Invalidado cache asistencia: ${keys.length} keys`)
    }
  } catch (error) {
    logger.error('Error invalidando cache:', error)
  }
}

/**
 * Invalida cache de alertas de un tenant.
 */
const invalidateAlertas = async (tenantId) => {
  try {
    const pattern = `alertas-ausentismo:${tenantId}:*`
    const keys = await redis.keys(pattern)

    if (keys.length > 0) {
      await redis.del(...keys)
      logger.info(`Invalidado cache alertas: ${keys.length} keys`)
    }
  } catch (error) {
    logger.error('Error invalidando cache alertas:', error)
  }
}

module.exports = {
  CACHE_TTL,
  getCacheKeyAsistenciaDia,
  getCacheKeyAlertas,
  withCache,
  invalidateAsistenciaDia,
  invalidateAlertas
}
