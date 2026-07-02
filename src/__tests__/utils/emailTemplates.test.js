const {
  renderIncidenteGraveTemplate,
  renderProtocoloAbiertoTemplate,
  renderProtocoloVencidoTemplate
} = require('../../utils/emailTemplates')

describe('emailTemplates', () => {
  describe('renderIncidenteGraveTemplate', () => {
    it('should render incidente grave email template', () => {
      const result = renderIncidenteGraveTemplate({
        estudianteNombre: 'Juan Pérez',
        incidenteDescripcion: 'Test incident description',
        gravedadLabel: 'Grave',
        fecha: '01/01/2024'
      })

      expect(result).toContain('Juan Pérez')
      expect(result).toContain('Test incident description')
      expect(result).toContain('Grave')
      expect(result).toContain('01/01/2024')
    })
  })

  describe('renderProtocoloAbiertoTemplate', () => {
    it('should render protocolo abierto email template', () => {
      const result = renderProtocoloAbiertoTemplate({
        estudianteNombre: 'María González',
        protocoloTipo: 'Académico'
      })

      expect(result).toContain('María González')
      expect(result).toContain('Académico')
    })
  })

  describe('renderProtocoloVencidoTemplate', () => {
    it('should render protocolo vencido email template', () => {
      const result = renderProtocoloVencidoTemplate({
        estudianteNombre: 'Carlos Ramírez',
        diasVencido: '5'
      })

      expect(result).toContain('Carlos Ramírez')
      expect(result).toContain('5')
    })
  })
})
