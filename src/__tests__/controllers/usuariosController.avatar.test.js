const usuariosController = require('../../controllers/usuariosController')
const usuariosService = require('../../services/usuariosService')
const storageService = require('../../services/storageService')

jest.mock('../../services/usuariosService')
jest.mock('../../services/storageService')
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}))

describe('usuariosController - Handlers de Avatar', () => {
  let req, res, next

  beforeEach(() => {
    jest.clearAllMocks()
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    next = jest.fn()
  })

  describe('subirAvatarHandler', () => {
    it('debe permitir a un usuario subir su propio avatar (req.params.id === "me")', async () => {
      req = {
        params: { id: 'me' },
        user: { user_id: 'user-uuid-1', tenant_id: 'tenant-uuid-1', rol: 'Docente' },
        file: {
          buffer: Buffer.from('image-data'),
          mimetype: 'image/jpeg',
        },
      }

      usuariosService.obtenerUsuario.mockResolvedValue({
        id: 'user-uuid-1',
        avatar_url: null,
      })
      storageService.subirAvatarUsuario.mockResolvedValue({
        publicUrl: 'https://storage/avatars/new.jpg',
      })
      usuariosService.actualizarAvatar.mockResolvedValue({
        id: 'user-uuid-1',
        avatar_url: 'https://storage/avatars/new.jpg',
      })

      await usuariosController.subirAvatarHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        data: expect.objectContaining({
          avatar_url: 'https://storage/avatars/new.jpg',
        }),
      }))
    })

    it('debe permitir a un Administrador subir el avatar de otro usuario', async () => {
      req = {
        params: { id: 'otro-usuario-uuid' },
        user: { user_id: 'admin-uuid', tenant_id: 'tenant-uuid-1', rol: 'Administrador' },
        file: {
          buffer: Buffer.from('image-data'),
          mimetype: 'image/png',
        },
      }

      usuariosService.obtenerUsuario.mockResolvedValue({
        id: 'otro-usuario-uuid',
        avatar_url: 'https://storage/old.png',
      })
      storageService.subirAvatarUsuario.mockResolvedValue({
        publicUrl: 'https://storage/avatars/nuevo.png',
      })
      usuariosService.actualizarAvatar.mockResolvedValue({
        id: 'otro-usuario-uuid',
        avatar_url: 'https://storage/avatars/nuevo.png',
      })

      await usuariosController.subirAvatarHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(storageService.subirAvatarUsuario).toHaveBeenCalledWith(expect.objectContaining({
        usuarioId: 'otro-usuario-uuid',
        urlAvatarAnterior: 'https://storage/old.png',
      }))
    })

    it('debe rechazar con 403 si un no-administrador intenta subir avatar a otro usuario', async () => {
      req = {
        params: { id: 'otro-usuario-uuid' },
        user: { user_id: 'user-1', tenant_id: 'tenant-uuid-1', rol: 'Docente' },
        file: { buffer: Buffer.from('img') },
      }

      await usuariosController.subirAvatarHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
        message: expect.stringContaining('No tienes autorización'),
      }))
    })

    it('debe rechazar con 400 si no se proporciona ningún archivo', async () => {
      req = {
        params: { id: 'me' },
        user: { user_id: 'user-1', tenant_id: 'tenant-uuid-1', rol: 'Docente' },
        file: null,
      }

      await usuariosController.subirAvatarHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 400,
        message: expect.stringContaining('No se ha proporcionado ninguna imagen'),
      }))
    })
  })

  describe('eliminarAvatarHandler', () => {
    it('debe permitir al propio usuario eliminar su avatar y purgar el archivo', async () => {
      req = {
        params: { id: 'me' },
        user: { user_id: 'user-1', tenant_id: 'tenant-uuid-1', rol: 'Docente' },
      }

      usuariosService.eliminarAvatar.mockResolvedValue({
        usuario: { id: 'user-1', avatar_url: null },
        urlAnterior: 'https://storage/avatars/foto.jpg',
      })
      storageService.eliminarAvatarUsuario.mockResolvedValue(true)

      await usuariosController.eliminarAvatarHandler(req, res, next)

      expect(storageService.eliminarAvatarUsuario).toHaveBeenCalledWith('https://storage/avatars/foto.jpg')
      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        message: 'Foto de perfil eliminada exitosamente',
      }))
    })

    it('debe rechazar con 403 si un no-administrador intenta eliminar el avatar de otro usuario', async () => {
      req = {
        params: { id: 'otro-user' },
        user: { user_id: 'user-1', tenant_id: 'tenant-uuid-1', rol: 'Inspector' },
      }

      await usuariosController.eliminarAvatarHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 403,
        message: expect.stringContaining('No tienes autorización'),
      }))
    })
  })
})
