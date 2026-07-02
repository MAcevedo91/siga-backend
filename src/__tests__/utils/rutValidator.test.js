const { validarRut, formatearRut, normalizarRut } = require('../../utils/rutValidator')

describe('rutValidator', () => {
  describe('validarRut', () => {
    it('should validate correct RUT with formatting', () => {
      expect(validarRut('12.345.678-5')).toBe(true)
      expect(validarRut('12345678-5')).toBe(true)
    })

    it('should reject invalid RUT', () => {
      expect(validarRut('12.345.678-9')).toBe(false)
      expect(validarRut('invalid')).toBe(false)
      expect(validarRut('')).toBe(false)
    })

    it('should validate RUT without formatting', () => {
      expect(validarRut('123456785')).toBe(true)
      expect(validarRut('111111119')).toBe(false)
    })
  })

  describe('formatearRut', () => {
    it('should format RUT correctly (without dots)', () => {
      expect(formatearRut('123456785')).toBe('12345678-5')
      expect(formatearRut('76543217')).toBe('7654321-7')
    })

    it('should handle already formatted RUT', () => {
      expect(formatearRut('12.345.678-5')).toBe('12345678-5')
      expect(formatearRut('12345678-5')).toBe('12345678-5')
    })
  })

  describe('normalizarRut', () => {
    it('should normalize RUT by removing dots and dashes', () => {
      expect(normalizarRut('12.345.678-5')).toBe('123456785')
      expect(normalizarRut('12345678-5')).toBe('123456785')
      expect(normalizarRut('123456785')).toBe('123456785')
    })

    it('should handle lowercase k', () => {
      expect(normalizarRut('12345678-k')).toBe('12345678K')
    })
  })
})
