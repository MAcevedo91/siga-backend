const crypto = require('crypto')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')
const { registrarAuditoria } = require('./auditoriaService')

/**
 * Calcula la versión documental determinista de un expediente de mediación.
 * Esta versión se recalcula si cambian los compromisos o los datos del expediente.
 *
 * @param {Object} mediacion - Objeto mediación
 * @returns {string} Código hexadecimal de 16 caracteres
 */
const calcularVersionDocumental = (mediacion) => {
  if (!mediacion || !mediacion.id) return 'v1'
  const seed = `${mediacion.id}:${mediacion.updated_at || mediacion.created_at || 'v1'}`
  return crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16)
}

/**
 * Lista los documentos y firmas anexas a un expediente de mediación.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} mediacionId - UUID de la mediación
 * @returns {Promise<Array<Object>>} Lista de documentos anexos
 */
const listarDocumentosMediacionService = async (tenantId, mediacionId) => {
  if (!tenantId || !mediacionId) {
    const err = new Error('Parámetros de consulta incompletos')
    err.statusCode = 400
    throw err
  }

  // 1. Verificar existencia y pertenencia de la mediación al tenant
  const { data: med, error: medError } = await supabase
    .from('mediaciones')
    .select('id, tenant_id')
    .eq('id', mediacionId)
    .eq('tenant_id', tenantId)
    .single()

  if (medError || !med) {
    const err = new Error('Mediación no encontrada o no pertenece al establecimiento')
    err.statusCode = 404
    throw err
  }

  // 2. Consultar documentos en la base de datos
  const { data, error } = await supabase
    .from('mediacion_documentos')
    .select('id, tipo, mime_type, firmante, conformidad, version_documental, nombre_archivo, tamano_bytes, vigente, created_at')
    .eq('tenant_id', tenantId)
    .eq('mediacion_id', mediacionId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Error al listar documentos de mediación en Supabase:', error)
    // Si la tabla aún no existe en Supabase (antes del DDL), retornar array vacío para no quebrar la UI
    if (error.code === '42P01') {
      logger.warn('Tabla mediacion_documentos no existe en Supabase aún. Retornando lista vacía.')
      return []
    }
    const err = new Error(error.message || 'Error al consultar documentos de la mediación')
    err.statusCode = 500
    throw err
  }

  return (data || []).map((doc) => ({
    id: doc.id,
    tipo: doc.tipo,
    mime_type: doc.mime_type,
    firmante: doc.firmante,
    conformidad: doc.conformidad,
    version: doc.version_documental,
    nombre_archivo: doc.nombre_archivo,
    tamano_bytes: doc.tamano_bytes,
    vigente: doc.vigente,
    created_at: doc.created_at,
  }))
}

/**
 * Guarda una firma manuscrita digitalizada o un acta física firmada en el expediente.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} mediacionId - UUID de la mediación
 * @param {string} usuarioId - UUID del usuario que sube el archivo
 * @param {Object} file - Archivo procesado por Multer (buffer, mimetype, size, etc.)
 * @param {Object} body - Parámetros del documento (tipo, firmante, conformidad, version)
 * @returns {Promise<Object>} Metadata del documento guardado
 */
const subirDocumentoMediacionService = async (tenantId, mediacionId, usuarioId, file, body = {}) => {
  if (!tenantId || !mediacionId) {
    const err = new Error('Parámetros de mediación inválidos')
    err.statusCode = 400
    throw err
  }

  if (!file || !file.buffer) {
    const err = new Error('No se ha proporcionado ningún archivo para guardar')
    err.statusCode = 400
    throw err
  }

  const { tipo, firmante, conformidad, version } = body

  if (!tipo || !['firma', 'acta_fisica'].includes(tipo)) {
    const err = new Error("El tipo de documento debe ser 'firma' o 'acta_fisica'")
    err.statusCode = 400
    throw err
  }

  // 1. Verificar existencia y estado de la mediación
  const { data: med, error: medError } = await supabase
    .from('mediaciones')
    .select('id, estado, cerrada_at, updated_at, created_at')
    .eq('id', mediacionId)
    .eq('tenant_id', tenantId)
    .single()

  if (medError || !med) {
    const err = new Error('Mediación no encontrada o no pertenece al establecimiento')
    err.statusCode = 404
    throw err
  }

  if (med.cerrada_at) {
    const err = new Error('No se pueden adjuntar firmas o documentos a un expediente de mediación cerrado')
    err.statusCode = 400
    throw err
  }

  // 2. Validaciones específicas según el tipo de documento
  if (tipo === 'firma') {
    if (file.mimetype !== 'image/png') {
      const err = new Error('La firma digital debe ser una imagen en formato PNG')
      err.statusCode = 400
      throw err
    }
    const esConforme = conformidad === 'true' || conformidad === true
    if (!esConforme) {
      const err = new Error('Debe confirmarse la conformidad del firmante con los acuerdos')
      err.statusCode = 400
      throw err
    }
  }

  if (tipo === 'acta_fisica') {
    if (file.mimetype !== 'application/pdf') {
      const err = new Error('El acta física debe ser un documento en formato PDF')
      err.statusCode = 400
      throw err
    }
  }

  const versionDocumental = version || calcularVersionDocumental(med)
  const uniqueId = crypto.randomUUID().substring(0, 8)
  const nombreLimpio = (file.originalname || (tipo === 'firma' ? 'firma.png' : 'acta.pdf'))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${tenantId}/mediaciones/${mediacionId}/${uniqueId}-${nombreLimpio}`

  // 3. Marcar documentos anteriores del mismo tipo y firmante como no vigentes si aplica
  if (tipo === 'firma' && firmante) {
    await supabase
      .from('mediacion_documentos')
      .update({ vigente: false })
      .eq('tenant_id', tenantId)
      .eq('mediacion_id', mediacionId)
      .eq('tipo', 'firma')
      .eq('firmante', firmante)
  }

  // 4. Intentar guardar en Supabase Storage como persistencia en la nube
  try {
    await supabase.storage
      .from('mediaciones_documentos')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      })
  } catch (storageErr) {
    logger.warn('Storage bucket mediaciones_documentos no disponible, utilizando persistencia binaria en base de datos:', storageErr.message)
  }

  // 5. Insertar registro en tabla mediacion_documentos
  const nuevoDocumentoPayload = {
    tenant_id: tenantId,
    mediacion_id: mediacionId,
    tipo,
    firmante: firmante || 'mediador',
    conformidad: tipo === 'firma' ? true : false,
    version_documental: versionDocumental,
    nombre_archivo: nombreLimpio,
    mime_type: file.mimetype,
    tamano_bytes: file.size || file.buffer.length,
    storage_path: storagePath,
    contenido_binario: file.buffer,
    vigente: true,
    created_by: usuarioId,
  }

  const { data: docInsertado, error: insertError } = await supabase
    .from('mediacion_documentos')
    .insert(nuevoDocumentoPayload)
    .select('id, tipo, mime_type, firmante, conformidad, version_documental, nombre_archivo, vigente, created_at')
    .single()

  if (insertError) {
    logger.error('Error al insertar documento de mediación en Supabase:', insertError)
    const err = new Error(insertError.message || 'Error al registrar el documento en la mediación')
    err.statusCode = 500
    throw err
  }

  // 6. Registro de auditoría
  try {
    await registrarAuditoria({
      tenantId,
      userId: usuarioId,
      accion: 'CREATE',
      tabla: 'mediacion_documentos',
      registroId: docInsertado.id,
      datosBefore: null,
      datosAfter: {
        id: docInsertado.id,
        mediacion_id: mediacionId,
        tipo: docInsertado.tipo,
        firmante: docInsertado.firmante,
        version: docInsertado.version_documental,
      },
    })
  } catch (auditErr) {
    logger.warn('Advertencia: No se pudo registrar auditoría de documento de mediación:', auditErr.message)
  }

  return {
    id: docInsertado.id,
    tipo: docInsertado.tipo,
    mime_type: docInsertado.mime_type,
    firmante: docInsertado.firmante,
    vigente: docInsertado.vigente,
    version: docInsertado.version_documental,
    created_at: docInsertado.created_at,
  }
}

/**
 * Recupera el archivo binario de una firma o acta física autorizada para descarga.
 *
 * @param {string} tenantId - UUID del establecimiento
 * @param {string} mediacionId - UUID de la mediación
 * @param {string} documentoId - UUID del documento
 * @returns {Promise<{ buffer: Buffer, mime_type: string, nombre_archivo: string }>}
 */
const descargarDocumentoMediacionService = async (tenantId, mediacionId, documentoId) => {
  if (!tenantId || !mediacionId || !documentoId) {
    const err = new Error('Parámetros de descarga incompletos')
    err.statusCode = 400
    throw err
  }

  // 1. Obtener documento y validar aislamiento multi-tenant
  const { data: doc, error } = await supabase
    .from('mediacion_documentos')
    .select('id, tipo, nombre_archivo, mime_type, storage_path, contenido_binario')
    .eq('id', documentoId)
    .eq('mediacion_id', mediacionId)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !doc) {
    const err = new Error('Documento o firma no encontrado en este expediente')
    err.statusCode = 404
    throw err
  }

  // 2. Si el registro tiene el binario en base de datos, servirlo directamente
  if (doc.contenido_binario) {
    const buffer = Buffer.isBuffer(doc.contenido_binario)
      ? doc.contenido_binario
      : Buffer.from(doc.contenido_binario)
    return {
      buffer,
      mime_type: doc.mime_type,
      nombre_archivo: doc.nombre_archivo,
    }
  }

  // 3. Si no tiene binario directo, intentar descargar desde Storage
  if (doc.storage_path) {
    const { data: storageData, error: storageErr } = await supabase.storage
      .from('mediaciones_documentos')
      .download(doc.storage_path)

    if (!storageErr && storageData) {
      const buffer = Buffer.from(await storageData.arrayBuffer())
      return {
        buffer,
        mime_type: doc.mime_type,
        nombre_archivo: doc.nombre_archivo,
      }
    }
  }

  const err = new Error('El archivo binario solicitado no se encuentra disponible')
  err.statusCode = 404
  throw err
}

module.exports = {
  calcularVersionDocumental,
  listarDocumentosMediacionService,
  subirDocumentoMediacionService,
  descargarDocumentoMediacionService,
}
