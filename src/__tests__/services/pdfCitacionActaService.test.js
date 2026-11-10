const {
  calcularHashActaCitacion,
  generarActaCitacionPDF,
} = require('../../services/pdfCitacionActaService')

describe('TASK 10.2.1 — Motor PDFKit de Acta Oficial de Citación y Acuerdos Mutuos', () => {
  const mockCitacion = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    folio: 'CIT-2026-0015',
    fecha_hora_programada: '2026-11-12T10:30:00.000Z',
    motivo_categoria: 'acuerdos_convivencia',
    motivo_detalle: 'Entrevista para acordar compromisos de buen trato y resolución pacífica en aula.',
    modalidad: 'presencial',
    lugar_entrevista: 'Oficina de Convivencia Escolar',
    estudiante: {
      nombre: 'Valentina',
      apellido: 'Baeza Miranda',
      rut: '22.333.444-5',
      curso: { nombre: '8° Básico B' },
    },
    apoderado: {
      nombre: 'Carlos',
      apellido: 'Baeza Toledo',
      rut: '12.345.678-9',
    },
    docente: {
      nombre: 'Prof. Mario Casas',
    },
  }

  const mockAcuerdos = {
    compromisos_colegio: [
      {
        descripcion: 'Brindar apoyo psicopedagógico semanal y tutoría entre pares.',
        responsable: 'Dupla Psicosocial',
        plazo: 'Semanal',
      },
      {
        descripcion: 'Monitorear la integración en recreos y trabajo grupal.',
        responsable: 'Profesor Jefe',
        plazo: 'Permanente',
      },
    ],
    compromisos_apoderado: [
      {
        descripcion: 'Establecer rutina de descanso y supervisar tareas en el hogar.',
        responsable: 'Apoderado Titular',
        plazo: 'Diario',
      },
      {
        descripcion: 'Asistir puntualmente a las sesiones de seguimiento formativo.',
        responsable: 'Familia',
        plazo: 'Según citación',
      },
    ],
    fecha_proximo_seguimiento: '2026-12-10',
    observaciones_pedagogicas: 'Se constata excelente disposición al diálogo y compromiso mutuo.',
  }

  describe('1. Criterio 3: Cálculo Forense de Hash Criptográfico SHA-256', () => {
    it('debe generar un hash SHA-256 inmutable de exactamente 64 caracteres hexadecimales', () => {
      const hash = calcularHashActaCitacion(mockCitacion, mockAcuerdos)

      expect(typeof hash).toBe('string')
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('debe ser determinista ante el mismo payload de acuerdos', () => {
      const hash1 = calcularHashActaCitacion(mockCitacion, mockAcuerdos)
      const hash2 = calcularHashActaCitacion(mockCitacion, mockAcuerdos)

      expect(hash1).toBe(hash2)
    })

    it('debe variar si se altera cualquier compromiso asumido', () => {
      const acuerdosAlterados = {
        ...mockAcuerdos,
        compromisos_apoderado: [{ descripcion: 'Compromiso modificado' }],
      }

      const hashOriginal = calcularHashActaCitacion(mockCitacion, mockAcuerdos)
      const hashAlterado = calcularHashActaCitacion(mockCitacion, acuerdosAlterados)

      expect(hashOriginal).not.toBe(hashAlterado)
    })
  })

  describe('2. Generación del Buffer PDF del Acta Oficial', () => {
    it('debe compilar exitosamente un Buffer binario de PDF válido con cabecera %PDF-', async () => {
      const pdfBuffer = await generarActaCitacionPDF(mockCitacion, mockAcuerdos)

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
      expect(pdfBuffer.length).toBeGreaterThan(1000)

      // Encabezado estándar de archivo PDF
      const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii')
      expect(pdfHeader).toBe('%PDF-')
    })

    it('debe generar el acta incluso si los compromisos son textos planos o listas vacías', async () => {
      const acuerdosSimples = {
        compromisos_colegio: ['Acompañamiento en aula'],
        compromisos_apoderado: ['Revisión diaria de cuaderno'],
        fecha_proximo_seguimiento: '2026-11-30',
      }

      const pdfBuffer = await generarActaCitacionPDF(mockCitacion, acuerdosSimples)

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
      expect(pdfBuffer.length).toBeGreaterThan(1000)
    })

    it('debe tolerar datos incompletos de la citación aplicando fallbacks institucionales', async () => {
      const citacionMinima = {
        folio: 'CIT-2026-9999',
      }

      const pdfBuffer = await generarActaCitacionPDF(citacionMinima, {})

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
      expect(pdfBuffer.length).toBeGreaterThan(1000)
    })
  })
})
