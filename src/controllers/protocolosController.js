const protocolosService = require('../services/protocolosService')

/**
 * GET /api/v1/protocolos
 * Filtros: estado, tipo_protocolo_id, estudiante_id
 */
const listarHandler = async (req, res, next) => {
  try {
    const protocolos = await protocolosService.listarProtocolos(
      req.user.tenant_id,
      req.query
    )
    res.status(200).json({
      status: 'success',
      message: `${protocolos.length} protocolo(s) encontrado(s)`,
      data: protocolos,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/protocolos/:id
 */
const obtenerHandler = async (req, res, next) => {
  try {
    const protocolo = await protocolosService.obtenerProtocolo(
      req.params.id,
      req.user.tenant_id
    )
    res.status(200).json({
      status: 'success',
      message: 'Protocolo encontrado',
      data: protocolo,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/protocolos
 */
const crearHandler = async (req, res, next) => {
  try {
    const protocolo = await protocolosService.crearProtocolo(
      req.user.tenant_id,
      req.user.user_id,
      req.body
    )
    res.status(201).json({
      status: 'success',
      message: 'Protocolo RICE abierto exitosamente',
      data: protocolo,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/protocolos/:id/estado
 */
const cambiarEstadoHandler = async (req, res, next) => {
  try {
    const { estado, observaciones } = req.body

    if (!estado) {
      return res.status(400).json({
        status: 'error',
        message: 'El campo "estado" es requerido',
        statusCode: 400,
      })
    }

    const protocolo = await protocolosService.cambiarEstado(
      req.params.id,
      req.user.tenant_id,
      estado,
      observaciones
    )

    res.status(200).json({
      status: 'success',
      message: `Estado del protocolo actualizado a "${estado}"`,
      data: protocolo,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/tipos-protocolo
 */
const tiposProtocoloHandler = async (req, res, next) => {
  try {
    const tipos = await protocolosService.listarTiposProtocolo()
    res.status(200).json({
      status: 'success',
      message: `${tipos.length} tipos de protocolo`,
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
  tiposProtocoloHandler,
}
