require('dotenv').config()
const { supabase } = require('./db')

const seedReglas = async () => {
  console.log('[SEED REGLAS] Iniciando la carga de reglas por defecto...')

  // 1. Obtener el tenant (Escuela El Salvador, o el primero que exista)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, nombre')
    .limit(1)
    .single()

  if (tenantError || !tenant) {
    console.error('[SEED REGLAS] ✗ No se encontró ningún tenant.')
    process.exit(1)
  }

  console.log(`[SEED REGLAS] ✓ Tenant encontrado: ${tenant.nombre} (${tenant.id})`)

  // 2. Obtener todos los tipos_protocolo existentes
  const { data: tipos, error: tiposError } = await supabase
    .from('tipos_protocolo')
    .select('id, nombre')

  if (tiposError || !tipos || tipos.length === 0) {
    console.error('[SEED REGLAS] ✗ No se encontraron tipos de protocolo.')
    process.exit(1)
  }

  console.log(`[SEED REGLAS] ✓ Se encontraron ${tipos.length} tipos de protocolo.`)

  // 3. Preparar las reglas para insertar/actualizar
  const reglasParaInsertar = []

  const plantillasReglas = [
    { orden: 1, accion: 'Entrevista inicial con las partes involucradas', plazo_dias: 2, prorrogable: false },
    { orden: 2, accion: 'Citación y reunión con apoderados', plazo_dias: 5, prorrogable: true },
    { orden: 3, accion: 'Informe de situación a Dirección', plazo_dias: 7, prorrogable: true },
    { orden: 4, accion: 'Cierre, derivación externa o solicitud de prórroga', plazo_dias: 10, prorrogable: true }
  ]

  for (const tipo of tipos) {
    for (const plantilla of plantillasReglas) {
      reglasParaInsertar.push({
        tenant_id: tenant.id,
        tipo_protocolo_id: tipo.id,
        orden: plantilla.orden,
        accion: plantilla.accion,
        plazo_dias: plantilla.plazo_dias,
        prorrogable: plantilla.prorrogable
      })
    }
  }

  // 4. Ejecutar upsert
  const { error: upsertError } = await supabase
    .from('reglas_protocolo')
    .upsert(reglasParaInsertar, {
      onConflict: 'tenant_id,tipo_protocolo_id,orden'
    })

  if (upsertError) {
    console.error('[SEED REGLAS] ✗ Error al insertar/actualizar reglas:', upsertError.message)
    process.exit(1)
  }

  console.log(`[SEED REGLAS] ✓ Se procesaron (upsert) ${reglasParaInsertar.length} reglas exitosamente (4 reglas × ${tipos.length} tipos).`)
  process.exit(0)
}

seedReglas()
