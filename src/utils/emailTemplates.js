const fs = require('fs')
const path = require('path')

function renderTemplate(templateName, data) {
  const templatePath = path.join(__dirname, '..', 'templates', 'emails', `${templateName}.html`)
  let html = fs.readFileSync(templatePath, 'utf-8')

  // Replace all {{variable}} with data values
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    html = html.replace(regex, value || '')
  }

  return html
}

function renderIncidenteGraveTemplate(data) {
  return renderTemplate('incidente-grave', data)
}

function renderProtocoloAbiertoTemplate(data) {
  return renderTemplate('protocolo-abierto', data)
}

function renderProtocoloVencidoTemplate(data) {
  return renderTemplate('protocolo-vencido', data)
}

module.exports = {
  renderIncidenteGraveTemplate,
  renderProtocoloAbiertoTemplate,
  renderProtocoloVencidoTemplate
}
