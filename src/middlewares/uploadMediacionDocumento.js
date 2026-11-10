const multer = require('multer')

// Formatos autorizados para anexos de mediación: firmas manuscritas (PNG) y actas físicas (PDF)
const TIPOS_MIME_PERMITIDOS = ['image/png', 'application/pdf']
const TAMANIO_MAXIMO_BYTES = 5 * 1024 * 1024 // 5 MB

const storage = multer.memoryStorage()

const fileFilter = (req, file, cb) => {
  if (TIPOS_MIME_PERMITIDOS.includes(file.mimetype)) {
    cb(null, true)
  } else {
    const error = new Error('Formato de archivo no válido. Se permiten únicamente imágenes PNG para firmas o documentos PDF para actas físicas.')
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

const uploadMediacionDocumento = (req, res, next) => {
  const singleUpload = upload.single('archivo')

  singleUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'error',
            message: 'El archivo excede el tamaño máximo permitido de 5 MB.',
          })
        }
        return res.status(400).json({
          status: 'error',
          message: `Error de subida: ${err.message}`,
        })
      }

      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          status: 'error',
          message: err.message,
        })
      }

      return res.status(400).json({
        status: 'error',
        message: err.message || 'Error al procesar el archivo adjunto.',
      })
    }

    next()
  })
}

module.exports = {
  uploadMediacionDocumento,
  TIPOS_MIME_PERMITIDOS,
  TAMANIO_MAXIMO_BYTES,
}
