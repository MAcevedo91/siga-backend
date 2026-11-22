# Guía de Automatización con N8N: Despacho Multicanal y Recordatorio de Citaciones Formativas

## 1. Visión General
Esta integración conecta el sistema **SIGA Escolar** con **N8N** para automatizar el ciclo de comunicación con los apoderados ante citaciones formativas y entrevistas pedagógicas (Circular N° 482 de la Superintendencia de Educación).

### Capacidades del Flujo:
1. **Despacho Inmediato por WhatsApp:** Envía el aviso formal con datos de la entrevista y enlace seguro para confirmar en 1 clic móvil (válido por 72 horas).
2. **Sincronización de Calendario (.ics):** Despacha un correo formal adjuntando el evento `.ics` para que el apoderado lo agregue automáticamente a su Google Calendar o Apple Calendar.
3. **Recordatorio Preventivo T-24h:** Pausa de forma asíncrona la ejecución hasta 24 horas antes de la cita y envía un recordatorio automático por WhatsApp para reducir el ausentismo escolar.
4. **Seguridad y DLP Escolar (Ley N° 19.628):** Los mensajes no contienen RUTs, anotaciones disciplinarias íntimas ni antecedentes confidenciales de los menores.
5. **Autenticación Criptográfica:** El webhook saliente de SIGA viaja firmado con **HMAC-SHA256** en el header `x-siga-signature` con control anti-replay mediante timestamp (`x-siga-timestamp`).

---

## 2. Configuración en SIGA Escolar (`siga-backend/.env`)

Agregue las siguientes variables a su archivo `.env` en `siga-backend`:

```env
# Habilitar integración con N8N
N8N_WEBHOOK_ENABLED=true

# URL del webhook expuesto por su instancia N8N (Producción o Túnel Ngrok/Cloudflare)
N8N_WEBHOOK_CITACIONES_URL=https://n8n.escuelaelsalvador.cl/webhook/siga-citacion-creada

# Clave secreta compartida para la firma HMAC-SHA256 (mínimo 32 caracteres)
N8N_WEBHOOK_SECRET=tu-clave-secreta-super-segura-de-32-caracteres

# URL pública de acceso web para las familias
FRONTEND_URL=https://siga.escuelaelsalvador.cl
```

---

## 3. Importación del Flujo en N8N

1. Inicie sesión en su instancia de **N8N**.
2. Vaya a **Workflows** > **Add Workflow**.
3. En la esquina superior derecha, haga clic en el menú `...` y seleccione **Import from File**.
4. Seleccione el archivo: `docs/n8n/SIGA_Escolar_Notificaciones_Citaciones.json`.
5. Guarde el flujo y haga clic en **Active** (Activar).

---

## 4. Configuración de Credenciales en N8N

### A. Variable de Entorno en N8N
En las variables de entorno de su contenedor N8N o en el nodo de código:
* Variable: `N8N_WEBHOOK_SECRET` con el mismo valor configurado en SIGA Escolar.

### B. Proveedor de WhatsApp
El nodo `Enviar WhatsApp (Meta Cloud API)` viene preconfigurado para la **API Oficial de WhatsApp Cloud (Meta)**:
1. Cree o configure una credencial de tipo **Header Auth**:
   * Header Name: `Authorization`
   * Header Value: `Bearer <TU_ACCESS_TOKEN_META>`
2. Reemplace en la URL `YOUR_PHONE_NUMBER_ID` por su ID de número de teléfono de WhatsApp Business.
*(Alternativamente, puede reemplazar este nodo por nodos de proveedores como Twilio, Evolution API o Baileys).*

### C. Proveedor de Correo (SMTP / SendGrid / Gmail)
El nodo `Enviar Email con ICS` requiere una credencial SMTP:
* Host: `smtp.gmail.com` (o el servidor del colegio)
* Usuario y Contraseña de aplicación.

---

## 5. Prueba Manual y Simulación de Webhook (cURL)

Puede probar el endpoint de N8N simulando el envío de una citación con el siguiente comando:

```bash
curl -X POST https://n8n.escuelaelsalvador.cl/webhook/siga-citacion-creada \
  -H "Content-Type: application/json" \
  -H "x-siga-event: citacion.creada" \
  -H "x-siga-timestamp: $(date +%s%3N)" \
  -d '{
    "evento": "citacion.creada",
    "timestamp": "'$(date -Iseconds)'",
    "data": {
      "folio": "CIT-2026-0042",
      "fecha_hora_programada": "'$(date -d "+2 days 10:00" -Iseconds)'",
      "lugar_entrevista": "Sala de Entrevistas / Convivencia Escolar",
      "modalidad": "presencial",
      "enlace_confirmacion": "https://siga.escuelaelsalvador.cl/citaciones/confirmacion/b1a2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "token_expira_at": "'$(date -d "+3 days 10:00" -Iseconds)'",
      "estudiante": {
        "nombre": "Esteban",
        "apellido": "Lagos",
        "curso": "7° Básico A"
      },
      "apoderado": {
        "nombre": "Carolina",
        "apellido": "Pérez",
        "telefono": "+56987654321",
        "email": "carolina.apoderada@gmail.com"
      },
      "docente": {
        "nombre": "Prof. Roberto Muñoz",
        "email": "rmunoz@escuelaelsalvador.cl"
      }
    }
  }'
```
