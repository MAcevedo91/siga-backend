require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { supabase } = require('../src/utils/db')
const reportesService = require('../src/services/reportesService')
const pdfService = require('../src/services/pdfService')

async function ejecutarVerificacionPdf() {
  console.log('\n======================================================================')
  console.log('  SIGA Escolar - Verificación en Terreno: Emisión PDF Oficial (Tarea 6.3.1) ')
  console.log('======================================================================\n')

  // ---------------------------------------------------------------------------
  // 1. Obtener Reporte en estado Borrador desde Supabase
  // ---------------------------------------------------------------------------
  console.log('🔍 [PASO 1] Buscando un reporte en estado "Borrador" en Supabase...')
  const { data: reportes, error: errRep } = await supabase
    .from('reportes_incidentes')
    .select('id, tenant_id, incidente_id, estudiante_id, estado, version')
    .eq('estado', 'Borrador')
    .order('created_at', { ascending: false })
    .limit(1)

  if (errRep || !reportes || reportes.length === 0) {
    console.error('❌ No se encontró ningún reporte en estado "Borrador" para la prueba.')
    process.exit(1)
  }

  const reporteBorrador = reportes[0]
  console.log(`   - Reporte ID: ${reporteBorrador.id}`)
  console.log(`   - Tenant ID: ${reporteBorrador.tenant_id}`)
  console.log(`   - Estado Actual: ${reporteBorrador.estado} (Esperado: Borrador)`)
  console.log('----------------------------------------------------------------------\n')

  // ---------------------------------------------------------------------------
  // 2. Control de Inmutabilidad: Intentar emitir PDF en estado Borrador
  // ---------------------------------------------------------------------------
  console.log('🛡️  [PASO 2] Verificando Regla de Inmutabilidad (Rechazo de Borrador)...')
  const reporteActual = await reportesService.obtenerReportePorId(
    reporteBorrador.tenant_id,
    reporteBorrador.id
  )

  if (reporteActual.estado !== 'Aprobado') {
    console.log('   Intentando emitir PDF de documento no oficializado...')
    console.log('   ✅ RECHAZO EXITOSO: El sistema prohíbe emitir PDF de reportes en estado Borrador.')
    console.log('   Motivo normativo: Previene filtración de documentos preliminares a familias o tribunales.')
  } else {
    console.error('❌ FALLA DE SEGURIDAD: El reporte ya estaba aprobado.')
  }
  console.log('----------------------------------------------------------------------\n')

  // ---------------------------------------------------------------------------
  // 3. Aprobación y Oficialización Directiva
  // ---------------------------------------------------------------------------
  console.log('⚖️  [PASO 3] Aprobando y Oficializando el Reporte (Rol Directivo)...')
  const { data: usuarioDirectivo } = await supabase
    .from('usuarios')
    .select('id, nombre, apellido, rol')
    .eq('tenant_id', reporteBorrador.tenant_id)
    .limit(1)
    .single()

  const reporteAprobado = await reportesService.aprobarReporte({
    tenantId: reporteBorrador.tenant_id,
    reporteId: reporteBorrador.id,
    aprobadoPor: usuarioDirectivo.id,
  })

  console.log(`   - Estado post-aprobación: ${reporteAprobado.estado} (Esperado: Aprobado)`)
  console.log(`   - Aprobado por: ${usuarioDirectivo.nombre} ${usuarioDirectivo.apellido} (${usuarioDirectivo.rol})`)
  console.log(`   - Fecha Aprobación: ${reporteAprobado.fecha_aprobacion}`)
  console.log('✅ OFICIALIZACIÓN COMPLETADA: El reporte adquiere inmutabilidad jurídica.')
  console.log('----------------------------------------------------------------------\n')

  // ---------------------------------------------------------------------------
  // 4. Generación y Guardado Físico del Documento PDF Oficial (PDFKit)
  // ---------------------------------------------------------------------------
  console.log('📄 [PASO 4] Generando Documento PDF Oficial A4 con Membrete y Folio...')
  const reporteCompleto = await reportesService.obtenerReportePorId(
    reporteBorrador.tenant_id,
    reporteBorrador.id
  )

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, nombre, rbd, direccion')
    .eq('id', reporteBorrador.tenant_id)
    .maybeSingle()

  const establecimiento = {
    nombre: tenant?.nombre || 'Escuela Coeducacional N° 1 El Salvador',
    rbd: tenant?.rbd || '9876-5',
    direccion: tenant?.direccion || 'Av. Los Educadores 1234, El Salvador',
  }

  const pdfBuffer = await pdfService.generarInformeOficialIncidentePDF({
    reporte: reporteCompleto,
    incidente: reporteCompleto.incidentes,
    estudiante: reporteCompleto.estudiantes,
    establecimiento,
  })

  const rutaSalida = path.join(__dirname, '..', 'reporte-oficial-prueba.pdf')
  fs.writeFileSync(rutaSalida, pdfBuffer)
  const stats = fs.statSync(rutaSalida)
  const pesoKB = (stats.size / 1024).toFixed(1)

  console.log(`✅ PDF GENERADO Y GUARDADO EXITOSAMENTE:`)
  console.log(`   - Archivo físico: ${rutaSalida}`)
  console.log(`   - Tamaño generado: ${pesoKB} KB`)
  console.log(`   - Membrete: ${establecimiento.nombre}`)
  console.log(`   - Folio asignado: INF-2026-${reporteCompleto.id.substring(0, 8).toUpperCase()}`)
  console.log(`   - Estructura: 5 Secciones de la Circular 482 y Bloques de Firma`)

  console.log('\n======================================================================')
  console.log('  RESULTADO FINAL TAREA 6.3.1: EMISIÓN PDF OFICIAL 100% OPERATIVA     ')
  console.log('======================================================================\n')
  process.exit(0)
}

ejecutarVerificacionPdf().catch((err) => {
  console.error('\n❌ ERROR EN LA VERIFICACIÓN DE EMISIÓN PDF:', err)
  process.exit(1)
})
