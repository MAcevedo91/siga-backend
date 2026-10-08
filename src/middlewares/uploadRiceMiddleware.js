const multer = require('multer')
const path = require('path')

// Configuración de almacenamiento en memoria volátil (Zero disk footprint)
const storage = multer.memoryStorage()

// Filtro de validación de archivos: PDF o Markdown (.md)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()
  const allowedExts = ['.pdf', '.md', '.txt']
  const allowedMimes = [
    'application/pdf',
    'text/markdown',
    'text/plain',
    'application/octet-stream',
  ]

  if (!allowedExts.includes(ext)) {
    const error = new Error('Formato no permitido. Solo se aceptan archivos PDF (.pdf) o Markdown (.md)')
    error.status = 400
    return cb(error, false)
  }

  if (!allowedMimes.includes(file.mimetype)) {
    const error = new Error(`Tipo MIME no válido: ${file.mimetype}`)
    error.status = 400
    return cb(error, false)
  }

  cb(null, true)
}

// Límite de tamaño: 25 MB
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB
    files: 1,
  },
})

// Middleware exportable con captura de errores de Multer
const uploadRiceMiddleware = (req, res, next) => {
  const singleUpload = upload.single('archivo')

  singleUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          status: 'error',
          message: 'El archivo excede el tamaño máximo permitido de 25 MB',
          statusCode: 400,
        })
      }
      return res.status(400).json({
        status: 'error',
        message: `Error al procesar archivo: ${err.message}`,
        statusCode: 400,
      })
    } else if (err) {
      return res.status(err.status || 400).json({
        status: 'error',
        message: err.message,
        statusCode: err.status || 400,
      })
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No se ha adjuntado ningún archivo. Envíe el archivo en el campo "archivo"',
        statusCode: 400,
      })
    }

    // Validación de Magic Bytes para PDFs
    const ext = path.extname(req.file.originalname).toLowerCase()
    if (ext === '.pdf') {
      const header = req.file.buffer.subarray(0, 5).toString('ascii')
      if (!header.startsWith('%PDF-')) {
        return res.status(400).json({
          status: 'error',
          message: 'El archivo no tiene una cabecera PDF válida o está corrupto',
          statusCode: 400,
        })
      }
    }

    next()
  })
}

module.exports = uploadRiceMiddleware
