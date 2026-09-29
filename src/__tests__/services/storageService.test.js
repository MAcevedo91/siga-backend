const storageService = require('../../services/storageService')
const { supabase } = require('../../utils/db')

// Mock de Supabase
jest.mock('../../utils/db', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
}))

describe('storageService - Gestión de Avatares en Supabase Storage', () => {
  const mockStorageFrom = {
    upload: jest.fn(),
    getPublicUrl: jest.fn(),
    remove: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    supabase.storage.from.mockReturnValue(mockStorageFrom)
  })

  describe('extensionPorMime', () => {
    it('debe retornar jpg para image/jpeg', () => {
      expect(storageService.extensionPorMime('image/jpeg')).toBe('jpg')
    })

    it('debe retornar png para image/png', () => {
      expect(storageService.extensionPorMime('image/png')).toBe('png')
    })

    it('debe retornar webp para image/webp', () => {
      expect(storageService.extensionPorMime('image/webp')).toBe('webp')
    })

    it('debe retornar jpg por defecto para tipos no reconocidos', () => {
      expect(storageService.extensionPorMime('unknown/type')).toBe('jpg')
    })
  })

  describe('extraerRutaDeUrl', () => {
    it('debe extraer la ruta relativa correctamente a partir de una URL pública', () => {
      const url = 'https://nosfdmgbxyypllpdnrct.supabase.co/storage/v1/object/public/avatars/tenant-123/user-456-1727600000.webp'
      const ruta = storageService.extraerRutaDeUrl(url)
      expect(ruta).toBe('tenant-123/user-456-1727600000.webp')
    })

    it('debe retornar null si la URL no corresponde al formato del bucket avatars', () => {
      expect(storageService.extraerRutaDeUrl('https://otro-dominio.com/foto.jpg')).toBeNull()
      expect(storageService.extraerRutaDeUrl(null)).toBeNull()
      expect(storageService.extraerRutaDeUrl('')).toBeNull()
    })
  })

  describe('subirAvatarUsuario', () => {
    const params = {
      tenantId: 'tenant-uuid-1',
      usuarioId: 'user-uuid-1',
      buffer: Buffer.from('fake-image-bytes'),
      mimeType: 'image/png',
    }

    it('debe subir el archivo correctamente y retornar la URL pública', async () => {
      mockStorageFrom.upload.mockResolvedValue({ data: { path: 'path/file.png' }, error: null })
      mockStorageFrom.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://supabase.co/storage/v1/object/public/avatars/tenant-uuid-1/user-uuid-1.png' },
      })

      const resultado = await storageService.subirAvatarUsuario(params)

      expect(supabase.storage.from).toHaveBeenCalledWith('avatars')
      expect(mockStorageFrom.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^tenant-uuid-1\/user-uuid-1-\d+\.png$/),
        params.buffer,
        expect.objectContaining({
          contentType: 'image/png',
          upsert: true,
          cacheControl: '3600',
        })
      )
      expect(resultado.publicUrl).toBe('https://supabase.co/storage/v1/object/public/avatars/tenant-uuid-1/user-uuid-1.png')
    })

    it('debe purgar el avatar previo si se especifica urlAvatarAnterior', async () => {
      mockStorageFrom.upload.mockResolvedValue({ data: {}, error: null })
      mockStorageFrom.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://supabase.co/storage/v1/object/public/avatars/nuevo.png' },
      })
      mockStorageFrom.remove.mockResolvedValue({ error: null })

      const urlVieja = 'https://supabase.co/storage/v1/object/public/avatars/tenant-uuid-1/viejo-avatar.jpg'

      await storageService.subirAvatarUsuario({
        ...params,
        urlAvatarAnterior: urlVieja,
      })

      expect(mockStorageFrom.remove).toHaveBeenCalledWith(['tenant-uuid-1/viejo-avatar.jpg'])
    })

    it('debe lanzar un error si Supabase Storage falla al subir', async () => {
      mockStorageFrom.upload.mockResolvedValue({
        data: null,
        error: new Error('Storage bucket limit exceeded'),
      })

      await expect(storageService.subirAvatarUsuario(params)).rejects.toThrow(
        'Error al almacenar imagen: Storage bucket limit exceeded'
      )
    })
  })

  describe('eliminarAvatarUsuario', () => {
    it('debe eliminar la imagen del bucket mediante su URL', async () => {
      mockStorageFrom.remove.mockResolvedValue({ error: null })
      const url = 'https://supabase.co/storage/v1/object/public/avatars/tenant-1/user-1.jpg'

      const resultado = await storageService.eliminarAvatarUsuario(url)

      expect(mockStorageFrom.remove).toHaveBeenCalledWith(['tenant-1/user-1.jpg'])
      expect(resultado).toBe(true)
    })

    it('debe retornar true inmediatamente si la URL es nula o vacía', async () => {
      const resultado = await storageService.eliminarAvatarUsuario(null)
      expect(resultado).toBe(true)
      expect(mockStorageFrom.remove).not.toHaveBeenCalled()
    })

    it('debe retornar false si Storage devuelve un error al eliminar', async () => {
      mockStorageFrom.remove.mockResolvedValue({ error: new Error('File not found') })

      const resultado = await storageService.eliminarAvatarUsuario('https://supabase.co/storage/v1/object/public/avatars/t/u.jpg')

      expect(resultado).toBe(false)
    })
  })
})
