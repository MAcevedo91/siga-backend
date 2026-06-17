const usuariosService = require('../services/usuariosService')

/**
 * GET /api/v1/usuarios
 * Lista todos los usuarios del tenant del administrador autenticado.
 */
const listarHandler = async (req, res, next) => {
  try {
    const usuarios = await usuariosService.listarUsuarios(req.user.tenant_id)
    res.status(200).json({
      status: 'success',
      message: `${usuarios.length} usuario(s) encontrado(s)`,
      data: usuarios,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/usuarios/:id
 */
const obtenerHandler = async (req, res, next) => {
  try {
    const usuario = await usuariosService.obtenerUsuario(req.params.id, req.user.tenant_id)
    res.status(200).json({
      status: 'success',
      message: 'Usuario encontrado',
      data: usuario,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/usuarios
 */
const crearHandler = async (req, res, next) => {
  try {
    const usuario = await usuariosService.crearUsuario(req.user.tenant_id, req.body)
    res.status(201).json({
      status: 'success',
      message: 'Usuario creado exitosamente',
      data: usuario,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/v1/usuarios/:id
 */
const actualizarHandler = async (req, res, next) => {
  try {
    const usuario = await usuariosService.actualizarUsuario(
      req.params.id,
      req.user.tenant_id,
      req.body
    )
    res.status(200).json({
      status: 'success',
      message: 'Usuario actualizado exitosamente',
      data: usuario,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/usuarios/:id/desactivar
 */
const desactivarHandler = async (req, res, next) => {
  try {
    const usuario = await usuariosService.desactivarUsuario(req.params.id, req.user.tenant_id)
    res.status(200).json({
      status: 'success',
      message: `Usuario ${usuario.nombre} ${usuario.apellido} desactivado exitosamente`,
      data: usuario,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  listarHandler,
  obtenerHandler,
  crearHandler,
  actualizarHandler,
  desactivarHandler,
}
