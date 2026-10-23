const sociogramaService = require('../services/sociogramaService')
const logger = require('../utils/logger')

/**
 * GET /api/sociograma/curso/:cursoId
 * GET /api/v1/sociograma/curso/:cursoId
 *
 * Retorna el sociograma de aula calculado mediante algoritmo de co-ocurrencias
 * y matriz de adyacencia ponderada para un curso específico.
 */
const obtenerSociogramaCursoHandler = async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id
    const { cursoId } = req.params

    const sociograma = await sociogramaService.obtenerSociogramaPorCurso(tenantId, cursoId)

    res.status(200).json({
      status: 'success',
      nodes: sociograma.nodes,
      links: sociograma.links,
      metricas: sociograma.metricas,
      matriz_adyacencia: sociograma.matriz_adyacencia,
      curso: sociograma.curso,
      data: sociograma,
    })
  } catch (err) {
    logger.error('Error en obtenerSociogramaCursoHandler:', err)
    next(err)
  }
}

module.exports = {
  obtenerSociogramaCursoHandler,
}
