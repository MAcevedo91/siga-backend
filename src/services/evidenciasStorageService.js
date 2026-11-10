const crypto = require('crypto')
const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

const BUCKET_EVIDENCIAS = process.env.SUPABASE_EVIDENCIAS_BUCKET || 'evidencias_protocolos'

/**
 * Sanitiza el nombre original del archivo para evitar caracteres inválidos o ataques de Path Traversal.
 */
const sanitizarNombreArchivo = (nombreOriginal) => {
  if (!nombreOriginal || typeof nombreOriginal !== 'string') return 'archivo_evidencia'
  return nombreOriginal
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos/diacríticos
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Sustituir caracteres raros por guión bajo
    .replace(/\.{2,}/g, '.') // Prevenir secuencias ..
    .substring(0, 150)
}

/**
 * Sube un archivo de evidencia probatoria a Supabase Storage.
 *
 * @param {Object} params
 * @param {string} params.tenantId - UUID del establecimiento
 * @param {string} params.protocoloId - UUID del protocolo RICE
 * @param {string} params.pasoId - UUID del paso normativo
 * @param {Buffer} params.buffer - Contenido binario del archivo
 * @param {string} params.nombreOriginal - Nombre original del archivo
 * @param {string} params.mimeType - Tipo MIME del archivo
 * @returns {Promise<{ publicUrl: string, storagePath: string, nombreArchivo: string }>}
 */
const subirEvidenciaStorage = async ({
  tenantId,
  protocoloId,
  pasoId,
  buffer,
  nombreOriginal,
  mimeType,
}) => {
  try {
    const nombreLimpio = sanitizarNombreArchivo(nombreOriginal)
    const uniqueId = crypto.randomUUID().substring(0, 8)
    const storagePath = `${tenantId}/protocolos/${protocoloId}/pasos/${pasoId}/${uniqueId}-${nombreLimpio}`

    logger.info(`[STORAGE EVIDENCIAS] Subiendo evidencia a Supabase Storage: ${storagePath}`)

    // Intentar subir al bucket principal
    let { error: uploadError } = await supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      })

    // Fallback defensivo al bucket avatars si el bucket evidencias_protocolos aún no fue creado
    let bucketUsado = BUCKET_EVIDENCIAS
    if (uploadError && (uploadError.statusCode === '404' || uploadError.message?.includes('Bucket not found'))) {
      logger.warn(`[STORAGE EVIDENCIAS] Bucket ${BUCKET_EVIDENCIAS} no encontrado, usando bucket 'avatars' como fallback`)
      bucketUsado = 'avatars'
      const { error: fallbackError } = await supabase.storage
        .from(bucketUsado)
        .upload(storagePath, buffer, {
          contentType: mimeType,
          upsert: true,
        })
      uploadError = fallbackError
    }

    if (uploadError) {
      logger.error(`[STORAGE EVIDENCIAS] Error al subir archivo: ${uploadError.message}`, { error: uploadError })
      throw new Error(`Error al almacenar archivo de evidencia: ${uploadError.message}`)
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketUsado)
      .getPublicUrl(storagePath)

    const publicUrl = publicUrlData?.publicUrl || ''

    return {
      publicUrl,
      storagePath,
      nombreArchivo: nombreLimpio,
    }
  } catch (error) {
    logger.error(`[STORAGE EVIDENCIAS] Fallo en servicio de almacenamiento: ${error.message}`)
    throw error
  }
}

/**
 * Elimina un archivo físico de evidencia en Supabase Storage.
 *
 * @param {string} storagePath - Ruta del archivo en el bucket
 * @returns {Promise<boolean>}
 */
const eliminarEvidenciaStorage = async (storagePath) => {
  try {
    if (!storagePath) return true

    logger.info(`[STORAGE EVIDENCIAS] Eliminando archivo de Supabase Storage: ${storagePath}`)

    const { error } = await supabase.storage
      .from(BUCKET_EVIDENCIAS)
      .remove([storagePath])

    if (error) {
      // Intentar también en fallback
      await supabase.storage.from('avatars').remove([storagePath]).catch(() => {})
      logger.warn(`[STORAGE EVIDENCIAS] Error al eliminar evidencia: ${error.message}`)
      return false
    }

    return true
  } catch (error) {
    logger.warn(`[STORAGE EVIDENCIAS] Excepción no bloqueante al eliminar evidencia: ${error.message}`)
    return false
  }
}

module.exports = {
  BUCKET_EVIDENCIAS,
  subirEvidenciaStorage,
  eliminarEvidenciaStorage,
  sanitizarNombreArchivo,
}
