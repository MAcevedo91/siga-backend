const incidentesService = require('../services/incidentesService')

/**
 * GET /api/v1/incidentes
 * Filtros: estado, gravedad, fecha_desde, fecha_hasta, estudiante_id
 */
const listarHandler = async (req, res, next) => {
  try {
    const incidentes = await incidentesService.listarIncidentes(
      req.user.tenant_id,
      req.query
    )
    res.status(200).json({
      status: 'success',
      message: `${incidentes.length} incidente(s) encontrado(s)`,
      data: incidentes,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/incidentes/:id
 */
const obtenerHandler = async (req, res, next) => {
  try {
    const incidente = await incidentesService.obtenerIncidente(
      req.params.id,
      req.user.tenant_id
    )
    res.status(200).json({
      status: 'success',
      message: 'Incidente encontrado',
      data: incidente,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/incidentes
 */
const crearHandler = async (req, res, next) => {
  try {
    const incidente = await incidentesService.crearIncidente(
      req.user.tenant_id,
      req.user.user_id,
      req.body
    )
    res.status(201).json({
      status: 'success',
      message: 'Incidente registrado exitosamente',
      data: incidente,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/incidentes/:id/estado
 */
const cambiarEstadoHandler = async (req, res, next) => {
  try {
    const { estado } = req.body

    if (!estado) {
      return res.status(400).json({
        status: 'error',
        message: 'El campo "estado" es requerido',
        statusCode: 400,
      })
    }

    const incidente = await incidentesService.cambiarEstado(
      req.params.id,
      req.user.tenant_id,
      estado
    )

    res.status(200).json({
      status: 'success',
      message: `Estado actualizado a "${estado}"`,
      data: incidente,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/tipos-abordaje
 */
const tiposAbordajeHandler = async (req, res, next) => {
  try {
    const tipos = await incidentesService.listarTiposAbordaje()
    res.status(200).json({
      status: 'success',
      message: `${tipos.length} tipos de abordaje`,
      data: tipos,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listarHandler,
  obtenerHandler,
  crearHandler,
  cambiarEstadoHandler,
  tiposAbordajeHandler,
}
