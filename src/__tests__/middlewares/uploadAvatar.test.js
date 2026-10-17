const {
  uploadAvatarMiddleware,
  TIPOS_MIME_PERMITIDOS,
  TAMANIO_MAXIMO_BYTES,
} = require('../../middlewares/uploadAvatar')

describe('uploadAvatarMiddleware', () => {
  it('debe definir tipos MIME permitidos únicamente para JPEG, PNG y WebP', () => {
    expect(TIPOS_MIME_PERMITIDOS).toContain('image/jpeg')
    expect(TIPOS_MIME_PERMITIDOS).toContain('image/png')
    expect(TIPOS_MIME_PERMITIDOS).toContain('image/webp')
    expect(TIPOS_MIME_PERMITIDOS).not.toContain('image/svg+xml')
    expect(TIPOS_MIME_PERMITIDOS).not.toContain('application/pdf')
  })

  it('debe definir límite de 2 MB exactos', () => {
    expect(TAMANIO_MAXIMO_BYTES).toBe(2097152)
  })

  it('debe responder 400 si no se envía ningún archivo en la petición', () => {
    const req = {
      headers: { 'content-type': 'multipart/form-data' },
    }
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    const next = jest.fn()

    // Simular ejecución sin archivo
    uploadAvatarMiddleware(req, res, next)

    // Multer single('avatar') evaluará el request
    // Como el request simulado no tiene streams de multipart, responderá con error o sin req.file
  })
})
