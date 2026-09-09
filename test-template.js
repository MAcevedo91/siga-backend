const { renderIncidenteGraveTemplate } = require('./src/utils/emailTemplates')

const html = renderIncidenteGraveTemplate({
  estudianteNombre: 'Juan Pérez',
  incidenteDescripcion: 'Pelea en el patio durante el recreo',
  gravedadLabel: 'Grave',
  fecha: '2026-07-01'
})

console.log('Template rendered successfully')
console.log('Length:', html.length)
console.log('Contains student name:', html.includes('Juan Pérez'))
