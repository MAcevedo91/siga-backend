const path = require('path')
const riceIngestaService = require('../services/riceIngestaService')
const riceRagService = require('../services/riceRagService')

/**
 * POST /api/v1/rice/upload
 * Subida y procesamiento de un nuevo RICE (exclusivo Administrador)
 */
const uploadRiceHandler = async (req, res, next) => {
  try {
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '')
    const formato = ext === 'pdf' ? 'pdf' : 'md'
    const anioVigencia = req.body.anio_vigencia || new Date().getFullYear()

    const resultado = await riceIngestaService.procesarYGuardarRice({
      tenantId: req.user.tenant_id,
      usuarioId: req.user.id || req.user.user_id,
      archivoBuffer: req.file.buffer,
      nombreArchivo: req.file.originalname,
      formato,
      anioVigencia,
    })

    res.status(201).json({
      status: 'success',
      message: 'Reglamento RICE cargado y vectorizado exitosamente',
      data: resultado,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/rice/documento-activo
 * Obtiene los metadatos del RICE vigente del establecimiento
 */
const obtenerRiceActivoHandler = async (req, res, next) => {
  try {
    const documento = await riceIngestaService.obtenerRiceActivo(req.user.tenant_id)

    res.status(200).json({
      status: 'success',
      data: documento,
      message: documento
        ? 'RICE activo recuperado correctamente'
        : 'El establecimiento no cuenta con un RICE cargado actualmente',
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/rice/consultar
 * Consulta en lenguaje natural asistida por RAG
 */
const consultarRiceHandler = async (req, res, next) => {
  try {
    const { consulta, contexto_incidente } = req.body

    if (!consulta || typeof consulta !== 'string' || consulta.trim() === '') {
      return res.status(400).json({
        status: 'error',
        message: 'El campo "consulta" es obligatorio',
        statusCode: 400,
      })
    }

    const resultado = await riceRagService.consultarRice({
      tenantId: req.user.tenant_id,
      usuarioId: req.user.id || req.user.user_id,
      consulta,
      contextoIncidente: contexto_incidente,
    })

    res.status(200).json({
      status: 'success',
      data: resultado,
    })
  } catch (err) {
    next(err)
  }
}

module.exports = {
  uploadRiceHandler,
  obtenerRiceActivoHandler,
  consultarRiceHandler,
}
