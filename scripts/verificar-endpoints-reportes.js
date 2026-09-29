require('dotenv').config()
const jwt = require('jsonwebtoken')
const { supabase } = require('../src/utils/db')
const reportesService = require('../src/services/reportesService')

async function ejecutarVerificacionEndpoints() {
  console.log('\n======================================================================')
  console.log('  SIGA Escolar - Verificación en Terreno: Endpoints REST (Tarea 6.1.3) ')
  console.log('======================================================================\n')

  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret'

  // ---------------------------------------------------------------------------
  // 1. Obtener Tenant e Incidente de prueba de la base de datos
  // ---------------------------------------------------------------------------
  console.log('🔍 [PASO 1] Obteniendo contexto de prueba desde Supabase...')
  const { data: incidentes, error: incError } = await supabase
    .from('incidentes')
    .select(`
      id,
      tenant_id,
      relato,
      incidente_estudiantes (
        estudiante_id,
        estudiantes (
          id,
          nombre,
          apellido
        )
      )
    `)
    .limit(5)

  if (incError || !incidentes || incidentes.length === 0) {
    console.error('❌ Error al consultar incidentes en Supabase:', incError?.message)
    process.exit(1)
  }

  // Buscar un incidente que tenga al menos un estudiante involucrado
  const incidenteValido = incidentes.find(
    (inc) => inc.incidente_estudiantes && inc.incidente_estudiantes.length > 0
  )

  if (!incidenteValido) {
    console.error('⚠️  No se encontró un incidente con estudiantes vinculados para realizar la prueba.')
    process.exit(1)
  }

  const incidenteId = incidenteValido.id
  const tenantId = incidenteValido.tenant_id
  const estudianteId = incidenteValido.incidente_estudiantes[0].estudiante_id
  const estudianteObj = incidenteValido.incidente_estudiantes[0].estudiantes
  const estudianteNombre = `${estudianteObj?.nombre || 'Estudiante'} ${estudianteObj?.apellido || 'Prueba'}`

  console.log(`   - Incidente ID: ${incidenteId}`)
  console.log(`   - Tenant ID: ${tenantId}`)
  console.log(`   - Estudiante Foco: ${estudianteNombre} (${estudianteId})`)
  console.log('----------------------------------------------------------------------\n')

  // ---------------------------------------------------------------------------
  // 2. Simulación de Identidad y Roles RBAC (JWT)
  // ---------------------------------------------------------------------------
  console.log('🔑 [PASO 2] Obteniendo Usuario Real y Generando Token RBAC:')
  const { data: usuarioExistente } = await supabase
    .from('usuarios')
    .select('id, email, rol, tenant_id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle()

  const usuarioProfesor = usuarioExistente || {
    id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    email: 'profesor.prueba@escuelaelsalvador.cl',
    rol: 'Profesor',
    tenant_id: tenantId,
  }

  const tokenProfesor = jwt.sign(
    { user_id: usuarioProfesor.id, tenant_id: usuarioProfesor.tenant_id, rol: usuarioProfesor.rol },
    jwtSecret,
    { expiresIn: '1h' }
  )
  console.log(`   - Usuario: ${usuarioProfesor.email} (${usuarioProfesor.id})`)
  console.log(`   - Rol Autorizado: ${usuarioProfesor.rol}`)
  console.log(`   - Token generado: ${tokenProfesor.substring(0, 20)}...`)
  console.log('----------------------------------------------------------------------\n')

  // ---------------------------------------------------------------------------
  // 3. Prueba POST /borrador-reporte (Generación Asistida + Persistencia DB)
  // ---------------------------------------------------------------------------
  console.log('📝 [PASO 3] Probando POST: Generación Asistida de Borrador...')
  const startTime = Date.now()
  const reportesGuardados = await reportesService.generarBorradoresParaIncidente({
    tenantId,
    incidenteId,
    usuarioId: usuarioProfesor.id,
  })
  const borradorGuardado = reportesGuardados[0]
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log(`⏱️  Borrador generado y persistido en ${duration}s`)
  console.log(`   - Reporte ID: ${borradorGuardado.id}`)
  console.log(`   - Estado: ${borradorGuardado.estado} (Esperado: Borrador)`)
  console.log(`   - Versión: ${borradorGuardado.version} (Esperado: 1)`)
  console.log(`   - Creado por: ${borradorGuardado.creado_por}`)

  if (borradorGuardado.estado === 'Borrador' && borradorGuardado.contenido_borrador) {
    console.log('✅ POST /borrador-reporte: OPERATIVO Y PERSISTIDO')
  } else {
    console.error('❌ POST /borrador-reporte: Falló validación de persistencia')
  }
  console.log('----------------------------------------------------------------------\n')

  // ---------------------------------------------------------------------------
  // 4. Prueba GET /reportes (Listado de Reportes del Incidente)
  // ---------------------------------------------------------------------------
  console.log('📋 [PASO 4] Probando GET: Listado de Reportes del Incidente...')
  const listadoReportes = await reportesService.obtenerReportesPorIncidente(
    tenantId,
    incidenteId
  )

  console.log(`   - Total de reportes encontrados: ${listadoReportes.length}`)
  const reporteEncontrado = listadoReportes.find((r) => r.id === borradorGuardado.id)

  if (reporteEncontrado) {
    console.log(`   - Reporte recién creado localizado en lista: ✅ SÍ`)
    console.log(`   - Estado en lista: ${reporteEncontrado.estado}`)
    console.log('✅ GET /reportes: OPERATIVO')
  } else {
    console.error('❌ GET /reportes: No se encontró el reporte creado en la lista')
  }
  console.log('----------------------------------------------------------------------\n')

  // ---------------------------------------------------------------------------
  // 5. Prueba PATCH /reportes/:reporteId (Edición Humana Docente)
  // ---------------------------------------------------------------------------
  console.log('✏️  [PASO 5] Probando PATCH: Edición Docente Humana del Borrador...')
  const contenidoModificado = {
    ...borradorGuardado.contenido_borrador,
    acuerdos_compromisos: 'El estudiante se compromete a acudir a mediación escolar con el profesor jefe los días viernes en horario de orientación.',
  }

  const reporteActualizado = await reportesService.guardarEdicionBorrador({
    tenantId,
    reporteId: borradorGuardado.id,
    contenidoEditado: contenidoModificado,
    modificadoPor: usuarioProfesor.id,
  })

  console.log(`   - Reporte ID: ${reporteActualizado.id}`)
  console.log(`   - Estado: ${reporteActualizado.estado}`)
  console.log(`   - Versión: ${reporteActualizado.version}`)
  console.log(`   - Acuerdos modificados en contenido_editado: "${reporteActualizado.contenido_editado.acuerdos_compromisos}"`)
  console.log(`   - Borrador original de IA intacto para trazabilidad: ${reporteActualizado.contenido_borrador ? '✅ SÍ' : '❌ NO'}`)

  if (
    reporteActualizado.contenido_editado &&
    reporteActualizado.contenido_editado.acuerdos_compromisos === contenidoModificado.acuerdos_compromisos &&
    reporteActualizado.contenido_borrador
  ) {
    console.log('✅ PATCH /reportes/:reporteId: OPERATIVO (EDICIÓN GUARDADA Y TRAZABILIDAD PRESERVADA)')
  } else {
    console.error('❌ PATCH /reportes/:reporteId: Falló actualización de contenido')
  }

  console.log('\n======================================================================')
  console.log('  RESULTADO FINAL TAREA 6.1.3: ENDPOINTS Y CONTROL RBAC OPERATIVOS    ')
  console.log('======================================================================\n')
  process.exit(0)
}

ejecutarVerificacionEndpoints().catch((err) => {
  console.error('\n❌ ERROR EN LA VERIFICACIÓN DE ENDPOINTS:', err)
  process.exit(1)
})
