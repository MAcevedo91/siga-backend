const { crearBroadcast, getBroadcastsRecibidos, marcarBroadcastLeido } = require('../services/broadcastsService')
const { supabase } = require('../utils/db')
const { z } = require('zod')

// POST /api/v1/broadcasts - Crear broadcast (Directivo/Admin)
exports.crearBroadcast = async (req, res) => {
  try {
    const schema = z.object({
      titulo: z.string().min(1).max(200),
      contenido: z.string().min(1),
      destinatarios_tipo: z.enum(['curso', 'nivel', 'rol', 'todos']),
      destinatarios_ids: z.array(z.string().uuid()).optional(),
      programado_para: z.string().datetime().optional(),
      confirmacion_lectura: z.boolean().default(false)
    })
    const data = schema.parse(req.body)
    const broadcast = await crearBroadcast(req.tenantId, data, req.user.id)
    res.status(201).json({ status: 'success', data: broadcast })
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message })
  }
}

// GET /api/v1/broadcasts - Listar broadcasts
exports.getBroadcasts = async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query
    const broadcasts = await getBroadcastsRecibidos(req.tenantId, req.user.id, parseInt(limit), parseInt(offset))
    res.json({ status: 'success', data: broadcasts })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

// GET /api/v1/broadcasts/:id - Detalle broadcast
exports.getBroadcast = async (req, res) => {
  try {
    const { data: broadcast, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('tenant_id', req.tenantId)
      .eq('id', req.params.id)
      .single()

    if (error || !broadcast) {
      return res.status(404).json({ status: 'error', message: 'Broadcast no encontrado' })
    }

    res.json({ status: 'success', data: broadcast })
  } catch (error) {
    res.status(404).json({ status: 'error', message: 'Broadcast no encontrado' })
  }
}

// POST /api/v1/broadcasts/:id/leer - Marcar como leído
exports.marcarLeido = async (req, res) => {
  try {
    await marcarBroadcastLeido(req.params.id, req.user.id)
    res.json({ status: 'success', message: 'Broadcast marcado como leído' })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}

// GET /api/v1/broadcasts/:id/lecturas - Estadísticas lectura (Directivo/Admin)
exports.getEstadisticas = async (req, res) => {
  try {
    // Obtener broadcast y contar lecturas
    const { data: broadcast, error: broadcastError } = await supabase
      .from('broadcasts')
      .select('id, titulo, destinatarios_tipo, destinatarios_ids')
      .eq('tenant_id', req.tenantId)
      .eq('id', req.params.id)
      .single()

    if (broadcastError || !broadcast) {
      return res.status(404).json({ status: 'error', message: 'Broadcast no encontrado' })
    }

    // Contar lecturas
    const { data: lecturas, error: lecturasError } = await supabase
      .from('broadcast_lecturas')
      .select('usuario_id, leido_at')
      .eq('broadcast_id', req.params.id)

    if (lecturasError) {
      throw new Error(lecturasError.message)
    }

    // Calcular destinatarios totales (simplificado)
    const { calcularDestinatarios } = require('../services/broadcastsService')
    const destinatarios = await calcularDestinatarios(
      req.tenantId,
      broadcast.destinatarios_tipo,
      broadcast.destinatarios_ids || []
    )

    const stats = {
      broadcastId: broadcast.id,
      titulo: broadcast.titulo,
      totalDestinatarios: destinatarios.length,
      totalLeidos: lecturas ? lecturas.length : 0,
      porcentajeLeido: destinatarios.length > 0
        ? Math.round((lecturas?.length || 0) / destinatarios.length * 100)
        : 0,
      lecturas: lecturas || []
    }

    res.json({ status: 'success', data: stats })
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message })
  }
}
