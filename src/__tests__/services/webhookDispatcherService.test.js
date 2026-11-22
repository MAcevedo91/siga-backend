const crypto = require('crypto')
const {
  generarFirmaWebhook,
  verificarFirmaWebhook,
  enviarWebhookSeguro,
  despacharEventoCitacionCreada,
} = require('../../services/webhookDispatcherService')

describe('WebhookDispatcherService — Seguridad y Despacho N8N', () => {
  const secretPrueba = 'mi-secreto-seguro-para-pruebas-12345'
  const payloadEjemplo = JSON.stringify({ evento: 'test', folio: 'CIT-2026-0001' })

  describe('Criptografía y Control Anti-Replay (HMAC-SHA256)', () => {
    it('debe generar y verificar una firma válida con el timestamp actual', () => {
      const timestamp = Date.now()
      const firma = generarFirmaWebhook(payloadEjemplo, secretPrueba, timestamp)

      expect(typeof firma).toBe('string')
      expect(firma.length).toBe(64) // Longitud de un hash SHA256 en hex

      const esValido = verificarFirmaWebhook(
        payloadEjemplo,
        secretPrueba,
        firma,
        timestamp
      )
      expect(esValido).toBe(true)
    })

    it('debe rechazar la firma si el payload fue alterado (integridad violada)', () => {
      const timestamp = Date.now()
      const firma = generarFirmaWebhook(payloadEjemplo, secretPrueba, timestamp)
      const payloadAlterado = JSON.stringify({ evento: 'test', folio: 'CIT-2026-9999' })

      const esValido = verificarFirmaWebhook(
        payloadAlterado,
        secretPrueba,
        firma,
        timestamp
      )
      expect(esValido).toBe(false)
    })

    it('debe rechazar la firma si la clave secreta es incorrecta', () => {
      const timestamp = Date.now()
      const firma = generarFirmaWebhook(payloadEjemplo, secretPrueba, timestamp)

      const esValido = verificarFirmaWebhook(
        payloadEjemplo,
        'clave-invalida',
        firma,
        timestamp
      )
      expect(esValido).toBe(false)
    })

    it('debe rechazar la petición por Replay Attack si el timestamp supera los 5 minutos', () => {
      const timestampAntiguo = Date.now() - (6 * 60 * 1000) // 6 minutos atrás
      const firma = generarFirmaWebhook(payloadEjemplo, secretPrueba, timestampAntiguo)

      const esValido = verificarFirmaWebhook(
        payloadEjemplo,
        secretPrueba,
        firma,
        timestampAntiguo,
        5 * 60 * 1000 // ventana 5 min
      )
      expect(esValido).toBe(false)
    })

    it('debe retornar false de forma segura si faltan argumentos', () => {
      expect(verificarFirmaWebhook(null, secretPrueba, 'abc', Date.now())).toBe(false)
      expect(verificarFirmaWebhook(payloadEjemplo, null, 'abc', Date.now())).toBe(false)
      expect(verificarFirmaWebhook(payloadEjemplo, secretPrueba, null, Date.now())).toBe(false)
      expect(verificarFirmaWebhook(payloadEjemplo, secretPrueba, 'abc', null)).toBe(false)
    })
  })

  describe('enviarWebhookSeguro (HTTP Fail-Safe)', () => {
    const originalFetch = globalThis.fetch

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    it('debe retornar false inmediatamente si la URL no está configurada', async () => {
      const resultado = await enviarWebhookSeguro('', 'test.evento', { dummy: 1 }, secretPrueba)
      expect(resultado).toBe(false)
    })

    it('debe enviar la petición POST con los headers de seguridad correctos', async () => {
      let peticionRecibida = null
      globalThis.fetch = jest.fn(async (url, init) => {
        peticionRecibida = { url, init }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
        }
      })

      const resultado = await enviarWebhookSeguro(
        'https://n8n.escuelaelsalvador.cl/webhook/citaciones',
        'citacion.creada',
        { folio: 'CIT-2026-0042' },
        secretPrueba
      )

      expect(resultado).toBe(true)
      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      expect(peticionRecibida.init.method).toBe('POST')
      expect(peticionRecibida.init.headers['Content-Type']).toBe('application/json')
      expect(peticionRecibida.init.headers['x-siga-event']).toBe('citacion.creada')
      expect(peticionRecibida.init.headers['x-siga-signature']).toBeDefined()
      expect(peticionRecibida.init.headers['x-siga-timestamp']).toBeDefined()

      const cuerpoEnviado = JSON.parse(peticionRecibida.init.body)
      expect(cuerpoEnviado.evento).toBe('citacion.creada')
      expect(cuerpoEnviado.data.folio).toBe('CIT-2026-0042')
    })

    it('debe manejar errores HTTP del servidor externo sin lanzar excepciones (Fail-Safe)', async () => {
      globalThis.fetch = jest.fn(async () => ({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      }))

      const resultado = await enviarWebhookSeguro(
        'https://n8n.escuelaelsalvador.cl/webhook/citaciones',
        'citacion.creada',
        { folio: 'CIT-2026-0042' },
        secretPrueba
      )

      expect(resultado).toBe(false)
    })

    it('debe manejar rechazos de red o abortos sin lanzar excepciones', async () => {
      globalThis.fetch = jest.fn(async () => {
        throw new Error('ECONNREFUSED: Conexión rechazada')
      })

      const resultado = await enviarWebhookSeguro(
        'http://localhost:5678/webhook/invalido',
        'citacion.creada',
        { folio: 'CIT-2026-0042' },
        secretPrueba
      )

      expect(resultado).toBe(false)
    })
  })

  describe('despacharEventoCitacionCreada (Cumplimiento DLP Escolar)', () => {
    const envOriginal = { ...process.env }
    const originalFetch = globalThis.fetch

    beforeEach(() => {
      process.env.N8N_WEBHOOK_ENABLED = 'true'
      process.env.N8N_WEBHOOK_CITACIONES_URL = 'https://n8n.local/webhook/siga'
      process.env.N8N_WEBHOOK_SECRET = 'secreto-test'
      process.env.FRONTEND_URL = 'https://siga.escuelaelsalvador.cl'
    })

    afterEach(() => {
      process.env = { ...envOriginal }
      globalThis.fetch = originalFetch
    })

    it('debe omitir el despacho si N8N_WEBHOOK_ENABLED es "false"', async () => {
      process.env.N8N_WEBHOOK_ENABLED = 'false'
      globalThis.fetch = jest.fn()

      const resultado = await despacharEventoCitacionCreada({ folio: 'CIT-2026-0001' })
      expect(resultado).toBe(false)
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('debe sanitizar el payload aplicando DLP escolar (sin RUTs ni notas íntimas)', async () => {
      let cuerpoCapturado = null
      globalThis.fetch = jest.fn(async (url, init) => {
        cuerpoCapturado = JSON.parse(init.body)
        return { ok: true, status: 200 }
      })

      const mockCitacion = {
        folio: 'CIT-2026-0010',
        fecha_hora_programada: '2026-11-20T10:00:00Z',
        lugar_entrevista: 'Inspectoría General',
        modalidad: 'presencial',
        token_confirmacion: 'uuid-token-seguro-1234',
        token_expira_at: '2026-11-23T10:00:00Z',
        estudiante: {
          id: 'est-uuid',
          nombre: 'Mateo',
          apellido: 'Morales',
          rut: '23.456.789-K', // Dato sensible que debe omitirse
          curso: '6° Básico B',
        },
        apoderado: {
          id: 'apod-uuid',
          nombre: 'Marcela',
          apellido: 'Morales',
          rut: '12.345.678-5', // Dato sensible que debe omitirse
          email: 'marcela.apoderada@gmail.com',
          telefono: '+56912345678',
        },
        docente: {
          nombre: 'Profesor Carlos Gómez',
          email: 'cgomez@escuelaelsalvador.cl',
        },
      }

      const res = await despacharEventoCitacionCreada(mockCitacion)
      expect(res).toBe(true)
      expect(cuerpoCapturado).toBeDefined()

      const datosEnviados = cuerpoCapturado.data
      expect(datosEnviados.folio).toBe('CIT-2026-0010')
      expect(datosEnviados.enlace_confirmacion).toBe(
        'https://siga.escuelaelsalvador.cl/citaciones/confirmacion/uuid-token-seguro-1234'
      )

      // Verificación estricta de DLP Escolar (Ley N° 19.628):
      expect(datosEnviados.estudiante.nombre).toBe('Mateo')
      expect(datosEnviados.estudiante.apellido).toBe('Morales')
      expect(datosEnviados.estudiante.curso).toBe('6° Básico B')
      expect(datosEnviados.estudiante.rut).toBeUndefined() // NO debe viajar el RUT

      expect(datosEnviados.apoderado.nombre).toBe('Marcela')
      expect(datosEnviados.apoderado.email).toBe('marcela.apoderada@gmail.com')
      expect(datosEnviados.apoderado.telefono).toBe('+56912345678')
      expect(datosEnviados.apoderado.rut).toBeUndefined() // NO debe viajar el RUT
    })
  })
})
