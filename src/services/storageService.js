const { supabase } = require('../utils/db')
const logger = require('../utils/logger')

const BUCKET_AVATARS = 'avatars'

/**
 * Mapea el tipo MIME a su extensión normalizada.
 */
const extensionPorMime = (mimeType) => {
  switch (mimeType) {
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/jpeg':
    default:
      return 'jpg'
  }
}

/**
 * Extrae la ruta relativa dentro del bucket a partir de una URL pública de Supabase Storage.
 * Ejemplo URL: https://...supabase.co/storage/v1/object/public/avatars/tenant-uuid/user-uuid-1234.jpg
 * Retorna: "tenant-uuid/user-uuid-1234.jpg"
 */
const extraerRutaDeUrl = (url) => {
  if (!url || typeof url !== 'string') return null
  const regex = new RegExp(`/storage/v1/object/public/${BUCKET_AVATARS}/(.+)$`)
  const match = url.match(regex)
  return match ? match[1] : null
}

/**
 * Sube una imagen de avatar a Supabase Storage en el bucket 'avatars'.
 * Si el usuario ya contaba con un avatar anterior, intenta eliminar el archivo previo.
 *
 * @param {Object} params
 * @param {string} params.tenantId - UUID del establecimiento
 * @param {string} params.usuarioId - UUID del usuario
 * @param {Buffer} params.buffer - Contenido binario de la imagen en memoria
 * @param {string} params.mimeType - Tipo MIME (image/jpeg, image/png, image/webp)
 * @param {string} [params.urlAvatarAnterior] - URL pública anterior para limpieza
 * @returns {Promise<{ publicUrl: string, filePath: string }>}
 */
const subirAvatarUsuario = async ({
  tenantId,
  usuarioId,
  buffer,
  mimeType,
  urlAvatarAnterior = null,
}) => {
  try {
    const ext = extensionPorMime(mimeType)
    // El timestamp garantiza invalidación de caché en navegadores ante actualización de imagen
    const nombreArchivo = `${usuarioId}-${Date.now()}.${ext}`
    const rutaArchivo = `${tenantId}/${nombreArchivo}`

    logger.info(`[STORAGE] Subiendo avatar a Supabase Storage: ${rutaArchivo}`)

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_AVATARS)
      .upload(rutaArchivo, buffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600', // 1 hora de caché en CDN
      })

    if (uploadError) {
      logger.error(`[STORAGE] Error al subir avatar a Supabase Storage: ${uploadError.message}`, { error: uploadError })
      throw new Error(`Error al almacenar imagen: ${uploadError.message}`)
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_AVATARS)
      .getPublicUrl(rutaArchivo)

    const publicUrl = publicUrlData?.publicUrl

    // Limpieza oportunista del avatar anterior para no acumular archivos huérfanos
    if (urlAvatarAnterior) {
      const rutaAnterior = extraerRutaDeUrl(urlAvatarAnterior)
      if (rutaAnterior && rutaAnterior !== rutaArchivo) {
        supabase.storage
          .from(BUCKET_AVATARS)
          .remove([rutaAnterior])
          .then(({ error: rmErr }) => {
            if (rmErr) logger.warn(`[STORAGE] No se pudo purgar avatar anterior (${rutaAnterior}): ${rmErr.message}`)
            else logger.info(`[STORAGE] Avatar anterior purgado exitosamente: ${rutaAnterior}`)
          })
          .catch((err) => logger.warn(`[STORAGE] Error inesperado purgando avatar anterior: ${err.message}`))
      }
    }

    return {
      publicUrl,
      filePath: rutaArchivo,
    }
  } catch (error) {
    logger.error(`[STORAGE] Fallo en servicio de almacenamiento de avatar: ${error.message}`)
    throw error
  }
}

/**
 * Elimina un archivo de avatar de Supabase Storage.
 *
 * @param {string} urlOPath - URL pública o ruta relativa en el bucket
 * @returns {Promise<boolean>}
 */
const eliminarAvatarUsuario = async (urlOPath) => {
  try {
    if (!urlOPath) return true

    const rutaRelativa = urlOPath.startsWith('http') ? extraerRutaDeUrl(urlOPath) : urlOPath
    if (!rutaRelativa) return true

    logger.info(`[STORAGE] Eliminando avatar de Supabase Storage: ${rutaRelativa}`)

    const { error } = await supabase.storage
      .from(BUCKET_AVATARS)
      .remove([rutaRelativa])

    if (error) {
      logger.warn(`[STORAGE] Error al eliminar avatar de Supabase Storage: ${error.message}`)
      return false
    }

    return true
  } catch (error) {
    logger.warn(`[STORAGE] Excepción no bloqueante al eliminar avatar: ${error.message}`)
    return false
  }
}

module.exports = {
  BUCKET_AVATARS,
  subirAvatarUsuario,
  eliminarAvatarUsuario,
  extraerRutaDeUrl,
  extensionPorMime,
}
