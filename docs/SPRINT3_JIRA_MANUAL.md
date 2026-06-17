# SIGA Escolar — Guía Completa: Crear Sprint 3 Manualmente en Jira

> **Capacidad comprometida:** 15 puntos (Marcelo 9 pts + Daniel 6 pts)
> **Duración:** 7 días (25 junio → 1 julio 2026)
> **Objetivo:** Completar el MVP con dashboard analítico, exportación PDF y despliegue a producción con URL pública HTTPS

---

## Cronograma General del Proyecto

| Sprint | Período | Días | Estado |
|--------|---------|------|--------|
| Sprint 1 | 02 jun → 15 jun | 14 | ✅ Completado |
| Sprint 2 | 16 jun → 24 jun | 9 | 🔄 En curso |
| Sprint 3 | 25 jun → 1 jul | 7 | ⏳ Pendiente |
| Buffer UAT | 2 jul → 3 jul | 2 | ⏳ Pendiente |
| **Fecha límite** | **3 julio 2026** | | |

---

## PASO 0 — Crear el Sprint 3

1. Ir a **Backlog** del proyecto SIGA-escolar
2. Clic en **Crear sprint**
3. Completar:

| Campo | Valor |
|-------|-------|
| **Nombre** | Sprint 3 |
| **Fecha inicio** | 25/06/2026 |
| **Fecha fin** | 01/07/2026 |
| **Objetivo** | Completar el MVP: dashboard analítico con gráficos en tiempo real, exportación PDF con membrete institucional, despliegue a producción con URL pública HTTPS y pruebas E2E |

---

## PASO 1 — Crear la Épica

| Campo | Valor |
|-------|-------|
| **Tipo** | Epic |
| **Resumen** | Analítica, Reportería y Despliegue a Producción |
| **Descripción** | Completar el MVP con dashboard analítico, exportación de reportes PDF con membrete institucional, despliegue a producción en plataformas cloud PaaS con URL pública HTTPS, y validación UAT con el cliente. |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `deploy`, `analytics` |
| **Sprint** | Sprint 3 |

✅ Guardar y anotar el ID generado (ej. `SIGA-22`)

---

## PASO 2 — Crear las Historias de Usuario

---

### HISTORIA 1: HU 3.1 – Dashboard Analítico y Gráficos

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 3.1 – Dashboard Analítico con Visualización en Tiempo Real |
| **Épica** | Analítica, Reportería y Despliegue a Producción |
| **Descripción** | **Como** equipo directivo, **quiero** visualizar estadísticas conductuales del establecimiento en gráficos dinámicos **para** facilitar la toma de decisiones basada en datos reales. |
| **Criterios de Aceptación** | - Dashboard carga en menos de 3 segundos (RNF-07). - Gráfico de barras muestra frecuencia de incidentes por curso. - Gráfico de torta muestra distribución por gravedad (Leve/Grave/Gravísima). - Gráfico de líneas muestra tendencia temporal de incidentes por mes. - Todos los gráficos se actualizan con datos reales de la BD. - Vista accesible para roles Administrador, Coordinador y Directivo. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `dashboard`, `analytics` |
| **Sprint** | Sprint 3 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-23`)

---

### HISTORIA 2: HU 3.2 – Exportación PDF con Membrete

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 3.2 – Exportación PDF de Historial Conductual |
| **Épica** | Analítica, Reportería y Despliegue a Producción |
| **Descripción** | **Como** coordinador de convivencia, **quiero** exportar el historial conductual de un estudiante en formato PDF con membrete institucional **para** presentarlo en reuniones, derivaciones o como evidencia formal ante la Superintendencia. |
| **Criterios de Aceptación** | - PDF generado incluye membrete con nombre y logo de la escuela. - PDF contiene: datos del estudiante, listado cronológico de incidentes, tipos de abordaje y medidas adoptadas. - PDF incluye espacios para firmas al pie de página (RF-11). - El archivo se descarga correctamente en el navegador. - El tiempo de generación no supera 3 segundos para un historial de hasta 50 incidentes. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `pdf`, `reporteria` |
| **Sprint** | Sprint 3 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-24`)

---

### HISTORIA 3: HU 3.3 – Despliegue a Producción (Go-Live)

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 3.3 – Despliegue a Producción con URL Pública HTTPS |
| **Épica** | Analítica, Reportería y Despliegue a Producción |
| **Descripción** | **Como** escuela, **quiero** que el sistema esté disponible en internet con URL pública segura **para** acceder desde cualquier dispositivo escolar sin depender de servidores locales. |
| **Criterios de Aceptación** | - API Backend responde sin fallos desde URL pública en Render o Railway. - Frontend accesible desde URL pública HTTPS en Vercel o Netlify. - Certificado SSL/TLS activo (HTTPS) en ambas URLs (RNF-01). - Variables de entorno configuradas en producción (sin credenciales en el código). - Ejecución de flujos E2E completos en producción sin errores críticos. - Tiempo de carga del dashboard en producción menor a 3 segundos (RNF-07). |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `deploy`, `produccion` |
| **Sprint** | Sprint 3 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-25`)

---

### HISTORIA 4: HU 3.4 – Certificación y Entrega Final (UAT)

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 3.4 – Certificación UAT y Entrega Final al Cliente |
| **Épica** | Analítica, Reportería y Despliegue a Producción |
| **Descripción** | **Como** cliente (Coordinador de Convivencia), **quiero** validar el software operando con datos reales **para** dar mi aprobación formal de uso y recibir las credenciales y documentación del sistema. |
| **Criterios de Aceptación** | - Los 483 estudiantes están cargados en producción vía CSV. - Usuarios del establecimiento creados con sus 5 roles correspondientes. - Pruebas UAT (caja negra) ejecutadas por el coordinador sin errores bloqueantes. - Acta de conformidad funcional firmada por el cliente. - Credenciales de acceso entregadas al administrador del establecimiento. - Documentación técnica entregada: arquitectura, MER, manual de usuario básico. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `uat`, `entrega`, `documentacion` |
| **Sprint** | Sprint 3 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-26`)

---

## PASO 3 — Crear las Tareas

---

## Tareas de HU 3.1 (Dashboard Analítico)

---

### TAREA 3.1.1 — Vistas SQL para analítica

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.1.1 Vistas SQL y endpoints de métricas para el dashboard |
| **Historia padre** | HU 3.1 – Dashboard Analítico |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 2 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `database`, `analytics` |
| **Sprint** | Sprint 3 |
| **Descripción** | Crear las vistas SQL de agrupación y los endpoints que alimentan el dashboard. **Subtareas:** (1) Crear vista SQL `v_incidentes_por_curso`: cuenta incidentes agrupados por curso y año académico. (2) Crear vista SQL `v_incidentes_por_gravedad`: distribución porcentual por gravedad. (3) Crear vista SQL `v_tendencia_mensual`: conteo de incidentes agrupados por mes y año. (4) Crear endpoints: `GET /api/v1/dashboard/incidentes-por-curso`, `GET /api/v1/dashboard/por-gravedad`, `GET /api/v1/dashboard/tendencia-mensual`. (5) Proteger todos los endpoints con `requireRole('Administrador', 'Coordinador', 'Directivo')`. (6) Todos los endpoints aplican filtro de `tenant_id` via RLS. |
| **Criterios de Aceptación** | - Los 3 endpoints retornan datos correctos verificados contra la BD. - Tiempo de respuesta de cada endpoint menor a 1 segundo con datos reales. - Los datos están filtrados por `tenant_id` (aislamiento multi-tenant verificado). - Roles insuficientes (Inspector, Docente) → 403. |

✅ Guardar

---

### TAREA 3.1.2 — UI Dashboard con gráficos Recharts

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.1.2 UI Dashboard con gráficos Recharts en tiempo real |
| **Historia padre** | HU 3.1 – Dashboard Analítico |
| **Asignado a** | Daniel Flores |
| **Story Points** | 4 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `dashboard`, `recharts` |
| **Sprint** | Sprint 3 |
| **Descripción** | Construir el dashboard analítico con gráficos dinámicos usando Recharts. **Dependencias:** `npm install recharts`. **Subtareas:** (1) Instalar Recharts: `npm install recharts`. (2) Crear `DashboardPage.jsx` (reemplaza el placeholder del Sprint 1): layout con 3 secciones de gráficos + tarjetas de resumen. (3) Componente `GraficoBarrasCurso.jsx`: gráfico de barras con frecuencia de incidentes por curso. (4) Componente `GraficoTortaGravedad.jsx`: gráfico de torta con distribución por gravedad (colores: verde/amarillo/rojo). (5) Componente `GraficoTendenciaMensual.jsx`: gráfico de líneas con tendencia de incidentes por mes. (6) Tarjetas de resumen: total incidentes, incidentes graves, protocolos activos, estudiantes en seguimiento. (7) Todos los gráficos consumen datos reales desde los endpoints del dashboard. (8) Proteger ruta `/dashboard` para roles Administrador, Coordinador y Directivo. |
| **Criterios de Aceptación** | - Dashboard carga en menos de 3 segundos (RNF-07). - Los 3 gráficos se renderizan correctamente con datos reales. - Gráfico de torta muestra leyenda con porcentajes. - Las tarjetas de resumen muestran conteos actualizados. - Vista responsiva desde 360px (RNF-08). - Sin datos: muestra estado vacío con mensaje `"Sin incidentes registrados aún"`. |

✅ Guardar

---

## Tareas de HU 3.2 (PDF)

---

### TAREA 3.2.1 — API Generación de PDF con membrete

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.2.1 API Generación PDF historial conductual con membrete |
| **Historia padre** | HU 3.2 – Exportación PDF |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `pdf`, `reporteria` |
| **Sprint** | Sprint 3 |
| **Descripción** | Implementar la generación de PDF del historial conductual del estudiante. **Dependencias:** `npm install pdfkit` o `npm install puppeteer`. **Recomendación:** usar `pdfkit` (más liviano, sin dependencias de Chromium). **Subtareas:** (1) Instalar `pdfkit`: `npm install pdfkit`. (2) Crear `pdfService.js` con función `generarHistorialPDF(estudiante, incidentes)`. (3) Estructura del PDF: encabezado con nombre del establecimiento y fecha de emisión, datos del estudiante (nombre, RUT, curso, fecha nacimiento), tabla cronológica de incidentes (fecha, tipo, gravedad, relato, medidas), sección de firmas al pie (Coordinador de Convivencia + Director). (4) Crear endpoint: `GET /api/v1/estudiantes/:id/pdf` — genera y descarga el PDF. (5) Proteger endpoint con `requireRole('Administrador', 'Coordinador')`. (6) Registrar en auditoría con acción `CREATE` y `tabla_afectada: 'reportes'`. |
| **Criterios de Aceptación** | - PDF generado contiene membrete con nombre de la escuela. - PDF incluye todos los incidentes del estudiante ordenados por fecha. - Espacios de firma presentes al pie del documento. - Tiempo de generación menor a 3 segundos para hasta 50 incidentes. - El archivo se descarga con nombre `historial_[rut]_[fecha].pdf`. - Roles insuficientes → 403. |

✅ Guardar

---

### TAREA 3.2.2 — UI Botón descarga PDF en perfil del estudiante

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.2.2 UI Botón descarga PDF en perfil del estudiante |
| **Historia padre** | HU 3.2 – Exportación PDF |
| **Asignado a** | Daniel Flores |
| **Story Points** | 1 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `pdf` |
| **Sprint** | Sprint 3 |
| **Descripción** | Agregar el botón de descarga de PDF en la vista de perfil del estudiante. **Subtareas:** (1) Agregar botón `"Descargar historial PDF"` en `EstudiantePerfilPage.jsx`. (2) Al hacer clic: llamar a `GET /api/v1/estudiantes/:id/pdf` con axios `responseType: 'blob'`. (3) Crear un link temporal en el DOM y disparar la descarga automáticamente. (4) Mostrar spinner en el botón mientras se genera el PDF. (5) Mostrar el botón solo para roles Administrador y Coordinador. |
| **Criterios de Aceptación** | - Botón visible solo para Administrador y Coordinador. - Clic en el botón descarga el PDF correctamente en el navegador. - Spinner activo durante la generación. - Si el estudiante no tiene incidentes: mostrar mensaje `"Sin incidentes para exportar"` en lugar de generar un PDF vacío. |

✅ Guardar

---

## Tareas de HU 3.3 (Deploy)

---

### TAREA 3.3.1 — Deploy Backend en Render o Railway

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.3.1 Deploy Backend en Render/Railway con variables de entorno |
| **Historia padre** | HU 3.3 – Despliegue a Producción |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 2 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `deploy`, `produccion` |
| **Sprint** | Sprint 3 |
| **Descripción** | Desplegar el servidor Node.js/Express en una plataforma PaaS con URL pública HTTPS. **Plataforma recomendada:** Render (gratuito, fácil integración con GitHub). **Subtareas:** (1) Crear cuenta en Render.com y conectar el repositorio `siga-backend`. (2) Configurar el servicio: tipo Web Service, rama `main`, build command `npm install`, start command `npm start`. (3) Agregar todas las variables de entorno de producción en el panel de Render: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET`, `NODE_ENV=production`, `PORT`. (4) Actualizar `ALLOWED_ORIGINS` en `app.js` con la URL real del frontend en producción. (5) Verificar que `GET https://[url-render]/api/v1/health` responde 200 OK. (6) Actualizar `CORS` para incluir la URL de producción del frontend. (7) Documentar la URL pública en el README y en el documento de cierre. |
| **Criterios de Aceptación** | - `GET https://[url-produccion]/api/v1/health` responde 200 OK desde internet. - HTTPS activo (certificado SSL visible en el navegador). - Variables de entorno configuradas en Render (no en el código). - CORS configurado para aceptar la URL del frontend en producción. - El servidor no crashea con el tráfico de las pruebas UAT. |

✅ Guardar

---

### TAREA 3.3.2 — Deploy Frontend en Vercel o Netlify

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.3.2 Deploy Frontend en Vercel/Netlify con HTTPS |
| **Historia padre** | HU 3.3 – Despliegue a Producción |
| **Asignado a** | Daniel Flores |
| **Story Points** | 1 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `deploy`, `produccion` |
| **Sprint** | Sprint 3 |
| **Descripción** | Desplegar el frontend React/Vite en una plataforma de hosting estático. **Plataforma recomendada:** Vercel (integración nativa con Vite y GitHub). **Subtareas:** (1) Crear cuenta en Vercel.com y conectar el repositorio `siga-frontend`. (2) Configurar el proyecto: framework Vite, build command `npm run build`, output directory `dist`. (3) Agregar variables de entorno en el panel de Vercel: `VITE_API_URL=https://[url-backend-produccion]/api/v1`. (4) Verificar que la URL pública carga el login correctamente. (5) Hacer login con credenciales reales y verificar flujo completo en producción. (6) Documentar la URL pública en el README. |
| **Criterios de Aceptación** | - Frontend accesible desde URL pública HTTPS. - Login funciona contra el backend en producción. - Redirección a `/dashboard` tras login exitoso. - HTTPS activo (sin advertencias de seguridad en el navegador). - La app carga en menos de 5 segundos en conexión normal. |

✅ Guardar

---

## Tareas de HU 3.4 (UAT y Entrega)

---

### TAREA 3.4.1 — Carga de datos reales y preparación UAT

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.4.1 Carga de datos reales y preparación ambiente UAT |
| **Historia padre** | HU 3.4 – Certificación UAT y Entrega Final |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 1 |
| **Prioridad** | Alta |
| **Etiquetas** | `uat`, `datos`, `produccion` |
| **Sprint** | Sprint 3 |
| **Descripción** | Preparar el ambiente de producción con datos reales para las pruebas UAT con el cliente. **Subtareas:** (1) Importar nómina real de 483 estudiantes vía CSV en producción. (2) Crear usuarios del establecimiento con sus roles: Administrador (1), Coordinador de Convivencia (1), Directivo (1), Inspector (2), Docente (3). (3) Crear los cursos del establecimiento (7° Básico A, 7° Básico B, etc.). (4) Registrar al menos 5 incidentes de prueba para que el dashboard muestre datos. (5) Verificar que el dashboard muestra los datos correctamente en producción. |
| **Criterios de Aceptación** | - Los 483 estudiantes están en producción y consultables. - Todos los usuarios del establecimiento pueden hacer login con sus credenciales. - El dashboard muestra datos reales del establecimiento. - Los 5 incidentes de prueba tienen distintas gravedades para poblar los gráficos. |

✅ Guardar

---

### TAREA 3.4.2 — Pruebas UAT + Documentación de Cierre

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.4.2 Pruebas UAT con el cliente y Documentación de Cierre |
| **Historia padre** | HU 3.4 – Certificación UAT y Entrega Final |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 1 |
| **Prioridad** | Alta |
| **Etiquetas** | `uat`, `documentacion`, `entrega` |
| **Sprint** | Sprint 3 |
| **Descripción** | Ejecutar las pruebas UAT con el coordinador de convivencia y entregar la documentación de cierre del proyecto. **Subtareas:** (1) Preparar guión de pruebas UAT (caja negra): login con cada rol, búsqueda de estudiante, registro de incidente Gravísimo, verificar notificación, apertura de protocolo RICE, exportación PDF, verificación del dashboard. (2) Ejecutar demostración técnica con el cliente en el ambiente de producción. (3) Acompañar al coordinador en las pruebas UAT — documentar observaciones. (4) Redactar documentación de cierre: arquitectura del sistema, modelo ER, URLs de producción, credenciales de acceso, manual de usuario básico. (5) Obtener firma del acta de conformidad. |
| **Criterios de Aceptación** | - Todas las pruebas UAT ejecutadas sin errores bloqueantes. - Acta de conformidad firmada por el cliente. - Documentación de cierre entregada: arquitectura, MER, credenciales, manual. - Credenciales de administrador entregadas al establecimiento. - URLs de producción documentadas y accesibles. |

✅ Guardar

---

## PASO 4 — Ordenar el Sprint 3 en el Backlog

1. Ir a **Backlog**
2. Arrastrar al Sprint 3 en este orden de prioridad:
   - Primero: **3.3.1** (Deploy Backend — base para todo lo demás)
   - Segundo: **3.3.2** (Deploy Frontend)
   - Tercero: **3.1.1** (API Dashboard)
   - Cuarto: **3.1.2** (UI Dashboard)
   - Quinto: **3.2.1** (API PDF)
   - Sexto: **3.2.2** (UI Botón PDF)
   - Séptimo: **3.4.1** (Carga de datos reales)
   - Octavo: **3.4.2** (UAT + Documentación)

---

## PASO 5 — Iniciar el Sprint 3

1. Ir a **Backlog**
2. Clic en **Iniciar sprint** en el bloque del Sprint 3
3. Confirmar fechas: 25/06/2026 → 01/07/2026
4. Confirmar objetivo del sprint
5. Clic en **Iniciar**

---

## Resumen de puntos por persona

| Desarrollador | Tareas | Puntos Sprint 3 |
|---------------|--------|-----------------|
| Marcelo Acevedo | 3.1.1, 3.2.1, 3.3.1, 3.4.1, 3.4.2 | 9 pts |
| Daniel Flores | 3.1.2, 3.2.2, 3.3.2 | 6 pts |
| **Total comprometido** | **8 tareas** | **15 pts** |

---

## Buffer UAT — 2 y 3 de Julio

| Actividad | Responsable | Fecha |
|-----------|-------------|-------|
| Ajustes post-UAT (bugs bloqueantes detectados) | Ambos | 2 jul |
| Firma acta de conformidad | Cliente + Marcelo | 3 jul |
| Entrega credenciales y documentación final | Marcelo | 3 jul |
| Cierre formal del proyecto | Marcelo | 3 jul |

---

## Resumen Global del Proyecto

| Sprint | Período | Puntos | RF cubiertos |
|--------|---------|--------|-------------|
| Sprint 1 | 02-15 jun | 25 | RF-01, RF-02 parcial, RF-03 |
| Sprint 2 | 16-24 jun | 34 | RF-02 completo, RF-04, RF-05, RF-06, RF-07, RF-08, RF-09 |
| Sprint 3 | 25 jun-1 jul | 15 | RF-10, RF-11 + Deploy + UAT |
| **Total** | | **74 pts** | **RF-01 al RF-11 ✅** |

---

## Definición de Terminado (DoD) — Sprint 3

Aplica todo el DoD de Sprints anteriores, más:

- [ ] Ambas URLs de producción accesibles con HTTPS
- [ ] Variables de entorno configuradas en producción (no hardcodeadas)
- [ ] Pruebas E2E ejecutadas en producción sin errores bloqueantes
- [ ] Dashboard carga en menos de 3 segundos en producción
- [ ] PDF generado correctamente con membrete y firmas
- [ ] Acta UAT firmada por el cliente
- [ ] Documentación de cierre entregada
