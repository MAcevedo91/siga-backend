const mensajeriaService = require('../services/mensajeriaService')
const { z } = require('zod')

// POST /api/v1/mensajes/conversacion - Crear conversación
exports.crearConversacion = async (req, res) => {
  try {
    const schema = z.object({
      tipo: z.enum(['individual', 'grupo']),
      nombre: z.string().optional(),
      participantesIds: z.array(z.string().uuid())
    })
    const data = schema.parse(req.body)
    const conversacion = await mensajeriaService.crearConversacion(
      req.tenantId,
      data.tipo,
      [req.user.id, ...data.participantesIds],
      data.nombre
    )
    res.status(201).json({ status: 'success', data: conversacion })
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message })
  }
}

// GET /api/v1/mensajes/conversaciones - Listar conversaciones del usuario
exports.getConversaciones = async (req, res) => {
  try {
    const conversaciones = await mensajeriaService.getConversacionesUsuario(
      req.tenantId,
      req.user.id
    )
    res.json({ status: 'success', data: conversaciones })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

// GET /api/v1/mensajes/:conversacionId - Obtener mensajes
exports.getMensajes = async (req, res) => {
  try {
    const { conversacionId } = req.params
    const { limit = 50, offset = 0 } = req.query
    const mensajes = await mensajeriaService.getMensajes(
      req.tenantId,
      conversacionId,
      parseInt(limit),
      parseInt(offset)
    )
    res.json({ status: 'success', data: mensajes })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

// POST /api/v1/mensajes/:conversacionId - Enviar mensaje
exports.enviarMensaje = async (req, res) => {
  try {
    const { conversacionId } = req.params
    const schema = z.object({
      contenido: z.string().min(1).max(5000),
      adjunto: z.object({
        url: z.string().url(),
        nombre: z.string(),
        tipo: z.string()
      }).optional()
    })
    const data = schema.parse(req.body)
    const mensaje = await mensajeriaService.enviarMensaje(
      req.tenantId,
      conversacionId,
      req.user.id,
      data.contenido,
      data.adjunto
    )
    res.status(201).json({ status: 'success', data: mensaje })
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message })
  }
}

// POST /api/v1/mensajes/:conversacionId/leer - Marcar como leído
exports.marcarLeido = async (req, res) => {
  try {
    const { conversacionId } = req.params
    await mensajeriaService.marcarLeido(
      req.tenantId,
      conversacionId,
      req.user.id
    )
    res.json({ status: 'success', message: 'Mensajes marcados como leídos' })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}
