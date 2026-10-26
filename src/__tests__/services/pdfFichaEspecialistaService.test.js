const pdfFichaEspecialistaService = require('../../services/pdfFichaEspecialistaService')
const reporteEspecialistaService = require('../../services/reporteEspecialistaService')
const { descargarFichaSaludPdfHandler } = require('../../controllers/reporteEspecialistaController')

describe('TASK 8.2.1.2 — Motor PDFKit de Ficha Médica/Psicológica Oficial de 2 Páginas', () => {
  const mockExpediente = {
    estudiante_evaluado: {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      rut: '21.456.789-0',
      nombre: 'Martín',
      apellido: 'Gómez',
      nombre_completo: 'Martín Gómez',
      fecha_nacimiento: '2012-05-14',
      genero: 'M',
      curso: '7° Básico A',
      estado_matricula: 'activo',
    },
    resumen_clinico_escolar: {
      total_incidentes_registrados: 1,
      total_mediaciones_registradas: 1,
      total_derivaciones_previas: 1,
      fecha_emision: '2026-10-26T10:00:00.000Z',
      solicitante: {
        id: 'uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu',
        nombre: 'Constanza Valenzuela',
        rol: 'Equipo de Formación',
      },
      destinatario_especialista: 'Dr. Alejandro Silva - Neurólogo Infantil CESFAM El Salvador',
      motivo_informe: 'Evaluación integral de atención y dinamismo relacional',
      aviso_confidencialidad: 'DOCUMENTO CONFIDENCIAL — LEY N° 19.628 Y LEY N° 20.584.',
    },
    incidentes: [
      {
        id: 'inc-1',
        folio: 'INC-2026-0045',
        fecha: '2026-03-20',
        gravedad: 'Grave',
        tipo_incidente: 'Conflicto entre pares',
        rol_estudiante_foco: 'Involucrado',
        descripcion_sanitizada: 'J. C. P. G. empujó a Martín Gómez en la multicancha.',
        medidas_tomadas_sanitizadas: 'Citación a apoderado de J. C. P. G. y entrevista formativa.',
        acuerdos_sanitizados: 'C. S. y D. F. colaborarán en el seguimiento.',
        observacion_individual_sanitizada: 'Martín manifiesta tranquilidad tras la intervención.',
        estado: 'cerrado',
        otros_involucrados_anonimizados: [{ id: 'part-2', iniciales: 'J. C. P. G.', rol: 'Involucrado' }],
      },
    ],
    mediaciones: [
      {
        id: 'med-1',
        folio: 'MED-2026-0012',
        fecha_programada: '2026-03-25T10:00:00.000Z',
        fecha_acuerdo: '2026-03-25T11:00:00.000Z',
        estado: 'cerrada',
        motivo_sanitizado: 'Diferencias reiteradas entre Martín Gómez y J. C. P. G.',
        conclusiones_sanitizadas: 'Ambos estudiantes acordaron respetarse formativamente.',
      },
    ],
    derivaciones_anteriores: [
      {
        id: 'der-1',
        tipo: 'Psicológica',
        prioridad: 'Alta',
        motivo_sanitizado: 'Evaluación de déficit atencional y dinámica con J. C. P. G.',
        fecha_derivacion: '2026-03-26T09:00:00.000Z',
        estado: 'activa',
      },
    ],
  }

  describe('Criterio 1: Compilación en Memoria (< 1 segundo como Buffer)', () => {
    it('debe compilar en menos de 1000 ms y retornar un Buffer de Node.js no vacío', async () => {
      const inicio = performance.now()
      const pdfBuffer = await pdfFichaEspecialistaService.generarFichaSaludPDF(mockExpediente)
      const fin = performance.now()
      const duracionMs = fin - inicio

      expect(duracionMs).toBeLessThan(1000) // Criterio: < 1 segundo
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true)
      expect(pdfBuffer.length).toBeGreaterThan(1000)

      // Encabezado estándar de PDF
      const encabezadoPDF = pdfBuffer.slice(0, 5).toString('ascii')
      expect(encabezadoPDF).toBe('%PDF-')
    })
  })

  describe('Criterio 3: Código Hash SHA-256 de Certificación de Autenticidad', () => {
    it('calcularHashFichaSalud debe generar un hash SHA-256 de 64 caracteres hexadecimales', () => {
      const hash = pdfFichaEspecialistaService.calcularHashFichaSalud(mockExpediente)

      expect(typeof hash).toBe('string')
      expect(hash).toHaveLength(64)
      expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true)
    })

    it('el hash debe ser determinista para el mismo payload canónico', () => {
      const hash1 = pdfFichaEspecialistaService.calcularHashFichaSalud(mockExpediente)
      const hash2 = pdfFichaEspecialistaService.calcularHashFichaSalud(mockExpediente)

      expect(hash1).toBe(hash2)
    })

    it('el hash debe variar si se modifican datos sensibles del estudiante o del resumen', () => {
      const hashOriginal = pdfFichaEspecialistaService.calcularHashFichaSalud(mockExpediente)

      const expedienteAlterado = {
        ...mockExpediente,
        estudiante_evaluado: {
          ...mockExpediente.estudiante_evaluado,
          rut: '11.111.111-1',
        },
      }

      const hashAlterado = pdfFichaEspecialistaService.calcularHashFichaSalud(expedienteAlterado)
      expect(hashAlterado).not.toBe(hashOriginal)
    })
  })

  describe('Criterio 2: Contenido Normativo y Estructura de 2 Páginas', () => {
    it('el documento PDF debe tener exactamente 2 páginas y contener las 4 secciones normativas con membrete institucional', async () => {
      const pdfBuffer = await pdfFichaEspecialistaService.generarFichaSaludPDF(mockExpediente)
      const raw = pdfBuffer.toString('latin1')

      // Verificación de estructura de exactamente 2 páginas
      const matchPaginas = raw.match(/\/Type\s*\/Pages[\s\S]*?\/Count\s+(\d+)/)
      const totalPaginas = matchPaginas ? parseInt(matchPaginas[1], 10) : 0
      expect(totalPaginas).toBe(2)

      // Extraer texto renderizado en operadores TJ (arrays de strings y offsets)
      const tjMatches = raw.match(/\[([^[\]]+)\]\s*TJ/g) || []
      const textoDecodificado = tjMatches
        .map((tj) => {
          const hexParts = tj.match(/<([0-9a-fA-F]+)>/g) || []
          return hexParts.map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join('')
        })
        .join('\n')

      const textoCompleto = raw + '\n' + textoDecodificado

      // Membrete oficial
      expect(textoCompleto).toContain('ESCUELA COEDUCACIONAL N° 1 EL SALVADOR')
      expect(textoCompleto).toContain('FICHA MÉDICA / PSICOLÓGICA OFICIAL')

      // Cuatro Secciones normativas
      // I. Identificación
      expect(textoCompleto).toContain('I. IDENTIFICACIÓN DEL ESTUDIANTE')
      // II. Hábitos y Atención en Aula
      expect(textoCompleto).toContain('II. HÁBITOS, CONDUCTA Y ATENCIÓN')
      // III. Convivencia Escolar y Mediaciones
      expect(textoCompleto).toContain('III. HISTORIAL DE CONVIVENCIA ESCOLAR')
      // IV. Conclusiones y Sugerencias
      expect(textoCompleto).toContain('IV. CONCLUSIONES INSTITUCIONALES')

      // Estudiante foco y tercero con iniciales genéricas anonimizadas
      expect(textoCompleto).toContain('Martín Gómez')
      expect(textoCompleto).toContain('J. C. P. G.')

      // Hash de autenticidad en pie de página
      const hashEsperado = pdfFichaEspecialistaService.calcularHashFichaSalud(mockExpediente)
      expect(textoCompleto).toContain(hashEsperado)
    })
  })

  describe('Controlador Express: descargarFichaSaludPdfHandler', () => {
    it('debe responder HTTP 200 con el PDF y los headers oficiales de autenticidad', async () => {
      jest.spyOn(reporteEspecialistaService, 'extraerExpedienteEspecialistaSalud').mockResolvedValueOnce(mockExpediente)

      const req = {
        user: { tenant_id: 'tenant-1', id: 'usr-1', rol: 'Equipo de Formación' },
        params: { id: mockExpediente.estudiante_evaluado.id },
        query: { especialista: 'Neurólogo', motivo: 'Diagnóstico' },
      }
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      }
      const next = jest.fn()

      await descargarFichaSaludPdfHandler(req, res, next)

      expect(res.status).toHaveBeenCalledWith(200)
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf')
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('inline; filename='))
      expect(res.setHeader).toHaveBeenCalledWith('X-Hash-Autenticidad-SHA256', expect.any(String))
      expect(res.send).toHaveBeenCalledWith(expect.any(Buffer))
      expect(next).not.toHaveBeenCalled()
    })

    it('debe delegar a next(err) en caso de excepción', async () => {
      const errorForzado = new Error('PDF Generation Error')
      jest.spyOn(reporteEspecialistaService, 'extraerExpedienteEspecialistaSalud').mockRejectedValueOnce(errorForzado)

      const req = {
        user: { tenant_id: 'tenant-1' },
        params: { id: 'est-1' },
      }
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      }
      const next = jest.fn()

      await descargarFichaSaludPdfHandler(req, res, next)

      expect(next).toHaveBeenCalledWith(errorForzado)
    })
  })
})
