const usuariosService = require('../services/usuariosService')
const storageService = require('../services/storageService')
const logger = require('../utils/logger')

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

/**
 * POST /api/v1/usuarios/:id/avatar
 * Sube o actualiza la foto de perfil del usuario.
 * Solo permitido para el propio usuario autenticado o para un Administrador del tenant.
 */
const subirAvatarHandler = async (req, res, next) => {
  try {
    const targetUserId = req.params.id === 'me' ? req.user.user_id : req.params.id

    // Control RBAC: solo el propio usuario o un Administrador del mismo tenant pueden modificar
    if (req.user.rol !== 'Administrador' && req.user.user_id !== targetUserId) {
      const err = new Error('No tienes autorización para modificar la foto de perfil de otro usuario')
      err.statusCode = 403
      throw err
    }

    if (!req.file || !req.file.buffer) {
      const err = new Error('No se ha proporcionado ninguna imagen en la solicitud')
      err.statusCode = 400
      throw err
    }

    // Obtener datos actuales del usuario para identificar si existe un avatar previo a purgar
    const usuarioActual = await usuariosService.obtenerUsuario(targetUserId, req.user.tenant_id)

    // Subir a Supabase Storage (en memoria, sin persistencia en disco efímero)
    const { publicUrl } = await storageService.subirAvatarUsuario({
      tenantId: req.user.tenant_id,
      usuarioId: targetUserId,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      urlAvatarAnterior: usuarioActual.avatar_url,
    })

    // Actualizar registro en base de datos
    const usuarioActualizado = await usuariosService.actualizarAvatar(
      targetUserId,
      req.user.tenant_id,
      publicUrl
    )

    logger.info(`[USUARIOS] Avatar actualizado exitosamente para usuario ${targetUserId} por ${req.user.user_id}`)

    res.status(200).json({
      status: 'success',
      message: 'Foto de perfil actualizada exitosamente',
      data: {
        avatar_url: publicUrl,
        usuario: usuarioActualizado,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/usuarios/:id/avatar
 * Remueve la foto de perfil del usuario y purga el archivo en Storage.
 */
const eliminarAvatarHandler = async (req, res, next) => {
  try {
    const targetUserId = req.params.id === 'me' ? req.user.user_id : req.params.id

    // Control RBAC
    if (req.user.rol !== 'Administrador' && req.user.user_id !== targetUserId) {
      const err = new Error('No tienes autorización para eliminar la foto de perfil de otro usuario')
      err.statusCode = 403
      throw err
    }

    const { usuario, urlAnterior } = await usuariosService.eliminarAvatar(
      targetUserId,
      req.user.tenant_id
    )

    if (urlAnterior) {
      await storageService.eliminarAvatarUsuario(urlAnterior)
    }

    logger.info(`[USUARIOS] Avatar eliminado exitosamente para usuario ${targetUserId}`)

    res.status(200).json({
      status: 'success',
      message: 'Foto de perfil eliminada exitosamente',
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
  subirAvatarHandler,
  eliminarAvatarHandler,
}

