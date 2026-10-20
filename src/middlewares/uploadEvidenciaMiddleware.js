const multer = require('multer')

// Formatos MIME autorizados para evidencias probatorias escolares
const TIPOS_MIME_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const TAMANIO_MAXIMO_BYTES = 10 * 1024 * 1024 // 10 MB

// Almacenamiento en memoria para procesamiento directo hacia Supabase Storage
const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  if (TIPOS_MIME_PERMITIDOS.includes(file.mimetype)) {
    cb(null, true)
  } else {
    const error = new Error(
      'Formato de archivo no válido. Se permiten documentos PDF, Word (.doc, .docx) e imágenes (JPEG, PNG, WebP).'
    )
    error.statusCode = 400
    error.code = 'INVALID_FILE_TYPE'
    cb(error, false)
  }
}

const upload = multer({
  storage,
  limits: {
    fileSize: TAMANIO_MAXIMO_BYTES,
    files: 1,
  },
  fileFilter,
})

/**
 * Middleware para procesar la subida de evidencia en el campo 'archivo'.
 * Captura y normaliza errores de Multer (límite de tamaño, tipo MIME inválido).
 */
const uploadEvidenciaMiddleware = (req, res, next) => {
  const singleUpload = upload.single('archivo')

  singleUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'error',
            message: 'El archivo excede el tamaño máximo permitido de 10 MB.',
          })
        }
        return res.status(400).json({
          status: 'error',
          message: `Error al procesar el archivo: ${err.message}`,
        })
      }

      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          status: 'error',
          message: err.message,
        })
      }

      return res.status(err.statusCode || 400).json({
        status: 'error',
        message: err.message || 'Error al procesar la subida del archivo',
      })
    }

    next()
  })
}

module.exports = {
  uploadEvidenciaMiddleware,
  TIPOS_MIME_PERMITIDOS,
  TAMANIO_MAXIMO_BYTES,
}
