const redisClient = require('./redis')
const logger = require('./logger')

/**
 * Invalida cache por patrones
 * @param {string[]} patterns - Array de patterns (ej: ['cache:/api/v1/estudiantes*'])
 * @returns {Promise<number>} - Número de keys eliminadas
 */
async function invalidateCache(patterns) {
  try {
    let allKeys = []

    for (const pattern of patterns) {
      const keys = await redisClient.keys(pattern)
      allKeys = allKeys.concat(keys)
    }

    if (allKeys.length === 0) {
      return 0
    }

    const deletedCount = await redisClient.del(allKeys)

    logger.info('Cache invalidated', {
      patterns,
      deletedCount
    })

    return deletedCount
  } catch (err) {
    logger.error('Cache invalidation failed', {
      error: err.message,
      patterns
    })
    return 0
  }
}

/**
 * Invalida cache de estudiantes y dashboard
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<void>}
 */
async function invalidateEstudiantes(tenantId) {
  await invalidateCache([
    'cache:/api/v1/estudiantes*',
    'cache:/api/v1/dashboard*'
  ])
}

/**
 * Invalida cache de incidentes y dashboard
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<void>}
 */
async function invalidateIncidentes(tenantId) {
  await invalidateCache([
    'cache:/api/v1/incidentes*',
    'cache:/api/v1/dashboard*'
  ])
}

/**
 * Invalida solo cache de dashboard
 * @param {string} tenantId - ID del tenant
 * @returns {Promise<void>}
 */
async function invalidateDashboard(tenantId) {
  await invalidateCache([
    'cache:/api/v1/dashboard*'
  ])
}

module.exports = {
  invalidateCache,
  invalidateEstudiantes,
  invalidateIncidentes,
  invalidateDashboard
}
