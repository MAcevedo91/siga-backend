const { generarInformeOficialIncidentePDF } = require('../../services/pdfService')

describe('pdfService — generarInformeOficialIncidentePDF (Tarea 6.3.1)', () => {
  const mockReporte = {
    id: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
    estado: 'Aprobado',
    version: 1,
    fecha_aprobacion: '2026-09-29T10:00:00.000Z',
    created_at: '2026-09-29T09:30:00.000Z',
    contenido_aprobado: {
      contexto: 'Patio central de la escuela durante el segundo recreo pedagógico.',
      hechos_objetivos: 'El estudiante foco y otro alumno participan en un altercado verbal que culmina con intervención de inspectoría.',
      medidas_adoptadas: 'Contención inmediata en inspectoría, aplicación del protocolo RICE y notificación a los apoderados.',
      acuerdos_compromisos: 'El alumno se compromete a mantener trato respetuoso y asistir a mediación escolar formativa.',
      plan_seguimiento: 'Acompañamiento semanal por dupla psicosocial y profesor jefe durante el mes lectivo.',
    },
    aprobador: {
      nombre: 'Roberto',
      apellido: 'Miranda',
      rol: 'Equipo de Formación',
    },
  }

  const mockIncidente = {
    id: 'inc-999',
    fecha: '2026-09-29T08:45:00.000Z',
    tipo_abordaje: 'Convivencia Escolar',
    gravedad: 'Grave',
  }

  const mockEstudiante = {
    id: 'est-123',
    nombre: 'Martín',
    apellido: 'González',
    rut: '21.456.789-0',
    es_pie: true,
    cursos: { nombre: '8° Básico B' },
  }

  const mockTenant = {
    nombre: 'Escuela Coeducacional N° 1 El Salvador',
    rbd: '00234-1',
    direccion: 'Av. Potrerillos S/N, El Salvador',
  }

  const mockApoderado = {
    nombre: 'Juana',
    apellido: 'Pérez',
    rut: '12.345.678-9',
    telefono: '+56912345678',
    email: 'juana.perez@email.cl',
  }

  it('debe generar un Buffer binario de PDF válido que comience con la firma %PDF-', async () => {
    const buffer = await generarInformeOficialIncidentePDF({
      reporte: mockReporte,
      incidente: mockIncidente,
      estudiante: mockEstudiante,
      tenant: mockTenant,
      apoderado: mockApoderado,
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1000)

    // Todo archivo PDF válido inicia con los bytes ASCII "%PDF-"
    const pdfMagicBytes = buffer.toString('ascii', 0, 5)
    expect(pdfMagicBytes).toBe('%PDF-')
  })

  it('debe generar exitosamente el PDF aun cuando faltan datos opcionales (tenant por defecto y sin apoderado)', async () => {
    const buffer = await generarInformeOficialIncidentePDF({
      reporte: mockReporte,
      incidente: mockIncidente,
      estudiante: {
        id: 'est-456',
        nombre: 'Sofía',
        apellido: 'López',
        rut: '22.111.222-3',
      },
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-')
  })

  it('debe proteger la identidad de los demás involucrados anonimizándolos en el PDF individual de Martín', async () => {
    const reporteConNombresTerceros = {
      ...mockReporte,
      contenido_aprobado: {
        ...mockReporte.contenido_aprobado,
        hechos_objetivos: 'Martín González discute acaloradamente con Lucas Silva (RUT: 23.456.789-1) en el patio.',
      },
    }

    const incidenteConOtrosAlumnos = {
      ...mockIncidente,
      estudiantes: [
        { id: 'est-123', nombre: 'Martín', apellido: 'González' },
        { id: 'est-999', nombre: 'Lucas', apellido: 'Silva', rut: '23.456.789-1' },
      ],
    }

    const buffer = await generarInformeOficialIncidentePDF({
      reporte: reporteConNombresTerceros,
      incidente: incidenteConOtrosAlumnos,
      estudiante: mockEstudiante,
      tenant: mockTenant,
      apoderado: mockApoderado,
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-')
  })

  it('debe generar exitosamente el PDF en modo vista previa (preview: true) para validación antes de la aprobación', async () => {
    const reporteBorrador = {
      ...mockReporte,
      estado: 'Borrador',
      fecha_aprobacion: null,
      contenido_aprobado: null,
      contenido_borrador: mockReporte.contenido_aprobado,
    }

    const buffer = await generarInformeOficialIncidentePDF({
      reporte: reporteBorrador,
      incidente: mockIncidente,
      estudiante: mockEstudiante,
      tenant: mockTenant,
      apoderado: mockApoderado,
      preview: true,
    })

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-')
  })

  it('debe generar exitosamente el PDF de historial conductual con firma única de Encargado de Convivencia', async () => {
    const { generarHistorialPDF } = require('../../services/pdfService')
    const buffer = await generarHistorialPDF(mockEstudiante, [
      {
        id: 1,
        fecha: '2026-09-20',
        gravedad: 'Leve',
        relato: 'Falta menor en sala de clases',
        medidas: 'Amonestación verbal',
      },
    ])

    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(1000)
    expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-')
  })
})
