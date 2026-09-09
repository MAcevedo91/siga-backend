require('dotenv').config()
const { supabase } = require('./db')

const seed = async () => {
  console.log('Iniciando seed de prueba de riesgo...')

  const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single()
  const { data: usuario } = await supabase.from('usuarios').select('id').limit(1).single()

  if (!tenant || !usuario) {
    console.error('No se encontró tenant o usuario base')
    process.exit(1)
  }

  const { data: estudiantes } = await supabase.from('estudiantes')
    .select('id, nombre')
    .in('nombre', ['Juan', 'María', 'Carlos'])
    .eq('tenant_id', tenant.id)
    .limit(3)

  const juan = estudiantes.find(e => e.nombre === 'Juan')
  const maria = estudiantes.find(e => e.nombre === 'María')
  const carlos = estudiantes.find(e => e.nombre === 'Carlos')

  if (!juan || !maria || !carlos) {
    console.error('No se encontraron los 3 estudiantes requeridos. Asegúrate de que Juan, María y Carlos existen.')
    process.exit(1)
  }

  const today = new Date().toISOString().split('T')[0]

  const insertarIncidente = async (estudianteId, gravedad) => {
    const { data: incidente, error } = await supabase.from('incidentes').insert({
      tenant_id: tenant.id,
      usuario_id: usuario.id,
      tipo_abordaje_id: 2, 
      fecha: today,
      gravedad: gravedad,
      relato: `Incidente ${gravedad} de prueba generado automáticamente.`,
      medidas: 'Medidas de prueba.',
      estado: 'Cerrado'
    }).select().single()

    if (error) {
        console.error('Error insertando incidente:', error)
        throw error
    }

    const { error: err2 } = await supabase.from('incidente_estudiantes').insert({
      incidente_id: incidente.id,
      estudiante_id: estudianteId,
      es_victima: false,
      observacion: 'Agresor de prueba'
    })

    if (err2) {
        console.error('Error asociando estudiante:', err2)
        throw err2
    }
  }

  console.log('Creando incidentes para Juan (2 Graves)...')
  await insertarIncidente(juan.id, 'Grave')
  await insertarIncidente(juan.id, 'Grave')

  console.log('Creando incidentes para María (3 Leves)...')
  await insertarIncidente(maria.id, 'Leve')
  await insertarIncidente(maria.id, 'Leve')
  await insertarIncidente(maria.id, 'Leve')

  console.log('Creando incidentes para Carlos (1 Leve)...')
  await insertarIncidente(carlos.id, 'Leve')

  console.log('¡Seed completado exitosamente!')
  process.exit(0)
}

seed().catch(console.error)
