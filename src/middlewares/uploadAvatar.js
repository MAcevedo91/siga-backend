const multer = require('multer')

// Formatos MIME autorizados
const TIPOS_MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
const TAMANIO_MAXIMO_BYTES = 2 * 1024 * 1024 // 2 MB

// Almacenamiento en memoria para no tocar el sistema de archivos efímero de Render
const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  if (TIPOS_MIME_PERMITIDOS.includes(file.mimetype)) {
    cb(null, true)
  } else {
    const error = new Error('Formato de archivo no válido. Solo se permiten imágenes JPEG, PNG o WebP.')
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
 * Middleware para procesar la subida del avatar en el campo 'avatar'.
 * Captura errores de Multer (tamaño, tipo) y los responde con formato JSON estándar.
 */
const uploadAvatarMiddleware = (req, res, next) => {
  const singleUpload = upload.single('avatar')

  singleUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'error',
            message: 'El archivo excede el tamaño máximo permitido de 2 MB.',
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
        message: err.message || 'Error en la subida del archivo',
      })
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No se ha proporcionado ninguna imagen en el campo "avatar".',
      })
    }

    next()
  })
}

module.exports = {
  uploadAvatarMiddleware,
  TIPOS_MIME_PERMITIDOS,
  TAMANIO_MAXIMO_BYTES,
}
