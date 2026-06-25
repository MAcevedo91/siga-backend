# SIGA Escolar — Guía Completa: Crear Sprint 3 Manualmente en Jira

> **Capacidad comprometida:** 15 puntos (Marcelo 9 pts + Daniel 6 pts)
> **Duración:** 7 días (25 junio → 1 julio 2026)
> **Objetivo:** Completar el MVP con dashboard analítico, exportación PDF y despliegue a producción con URL pública HTTPS

---

## Estado del Sprint 3 al inicio

| Tarea | Estado |
|-------|--------|
| 3.3.1 Deploy Backend en Render | ✅ COMPLETADO |
| 3.3.2 Deploy Frontend en Vercel | ✅ COMPLETADO |
| 3.1.1 Vistas SQL y endpoints dashboard | 🔄 En desarrollo |
| 3.1.2 UI Dashboard con gráficos | ⏳ Pendiente |
| 3.2.1 API PDF con membrete | ⏳ Pendiente |
| 3.2.2 UI Botón descarga PDF | ⏳ Pendiente |
| 3.4.1 Carga de datos reales | ⏳ Pendiente |
| 3.4.2 UAT + Documentación de cierre | ⏳ Pendiente |

---

## PASO 0 — Crear el Sprint 3

1. Ir a **Backlog** del proyecto SIGA-escolar
2. Clic en **Crear sprint**

| Campo | Valor |
|-------|-------|
| **Nombre** | Sprint 3 |
| **Fecha inicio** | 25/06/2026 |
| **Fecha fin** | 01/07/2026 |
| **Objetivo** | Completar el MVP: dashboard analítico con gráficos en tiempo real, exportación PDF con membrete institucional, despliegue a producción con URL pública HTTPS y pruebas UAT con el cliente |

---

## PASO 1 — Crear la Épica

| Campo | Valor |
|-------|-------|
| **Tipo** | Epic |
| **Resumen** | Analítica, Reportería y Despliegue a Producción |
| **Descripción** | Completar el MVP con dashboard analítico en tiempo real, exportación de reportes PDF con membrete institucional, despliegue a producción en plataformas cloud PaaS con URL pública HTTPS, y validación UAT con el cliente. |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `deploy`, `analytics` |
| **Sprint** | Sprint 3 |

✅ Guardar y anotar el ID (ej. `SIGA-35`)

---

## PASO 2 — Crear las Historias de Usuario

---

### HISTORIA 1: HU 3.1 – Dashboard Analítico con Visualización en Tiempo Real

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 3.1 – Dashboard Analítico con Visualización en Tiempo Real |
| **Épica** | Analítica, Reportería y Despliegue a Producción |
| **Descripción** | **Como** equipo directivo, **quiero** visualizar estadísticas conductuales del establecimiento en gráficos dinámicos **para** facilitar la toma de decisiones basada en datos reales en tiempo real. |
| **Criterios de Aceptación** | - Dashboard carga en menos de 3 segundos (RNF-07). - Gráfico de barras muestra frecuencia de incidentes por curso. - Gráfico de torta muestra distribución por gravedad (Leve/Grave/Gravísima). - Gráfico de líneas muestra tendencia temporal de incidentes por mes. - Todos los gráficos consumen datos reales de la BD. - Tarjetas de resumen: total incidentes, graves, protocolos activos, estudiantes en seguimiento. - Vista accesible para roles Administrador, Coordinador y Directivo. - Sin datos muestra estado vacío con mensaje apropiado. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `dashboard`, `analytics` |
| **Sprint** | Sprint 3 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-36`)

---

### HISTORIA 2: HU 3.2 – Exportación PDF de Historial Conductual

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 3.2 – Exportación PDF de Historial Conductual con Membrete |
| **Épica** | Analítica, Reportería y Despliegue a Producción |
| **Descripción** | **Como** coordinador de convivencia, **quiero** exportar el historial conductual de un estudiante en formato PDF con membrete institucional **para** presentarlo en reuniones, derivaciones o como evidencia formal ante la Superintendencia de Educación. |
| **Criterios de Aceptación** | - PDF generado incluye membrete con nombre de la escuela y fecha de emisión (RF-11). - PDF contiene datos del estudiante, listado cronológico de incidentes, tipos de abordaje y medidas adoptadas. - PDF incluye espacios para firmas al pie: Coordinador de Convivencia y Director. - Archivo se descarga con nombre `historial_[rut]_[fecha].pdf`. - Tiempo de generación menor a 3 segundos para hasta 50 incidentes. - Botón visible solo para Administrador y Coordinador. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `pdf`, `reporteria` |
| **Sprint** | Sprint 3 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-37`)

---

### HISTORIA 3: HU 3.3 – Despliegue a Producción ✅ COMPLETADA

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 3.3 – Despliegue a Producción con URL Pública HTTPS |
| **Épica** | Analítica, Reportería y Despliegue a Producción |
| **Descripción** | **Como** escuela, **quiero** que el sistema esté disponible en internet con URL pública segura **para** acceder desde cualquier dispositivo escolar sin depender de servidores locales. |
| **Estado** | ✅ COMPLETADA |
| **URLs de producción** | Backend: https://siga-backend.onrender.com — Frontend: https://siga-frontend-delta-six.vercel.app |

---

### HISTORIA 4: HU 3.4 – Certificación UAT y Entrega Final

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 3.4 – Certificación UAT y Entrega Final al Cliente |
| **Épica** | Analítica, Reportería y Despliegue a Producción |
| **Descripción** | **Como** cliente (Coordinador de Convivencia), **quiero** validar el software operando con datos reales **para** dar mi aprobación formal de uso y recibir las credenciales y documentación del sistema. |
| **Criterios de Aceptación** | - Los 483 estudiantes están cargados en producción vía CSV. - Usuarios del establecimiento creados con sus 5 roles. - Pruebas UAT ejecutadas por el coordinador sin errores bloqueantes. - Acta de conformidad firmada por el cliente. - Credenciales entregadas al administrador del establecimiento. - Documentación técnica entregada: arquitectura, MER, URLs, manual básico. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `uat`, `entrega`, `documentacion` |
| **Sprint** | Sprint 3 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-38`)

---

## PASO 3 — Crear las Tareas

---

## Tareas de HU 3.1 (Dashboard Analítico)

---

### TAREA 3.1.1 — Vistas SQL y endpoints de métricas

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
| **Descripción** | Crear las vistas SQL de agrupación en Supabase y los endpoints REST que alimentan el dashboard. **Subtareas:** (1) Ejecutar en Supabase SQL Editor: `CREATE VIEW v_incidentes_por_curso` — agrupa incidentes por curso. (2) `CREATE VIEW v_incidentes_por_gravedad` — distribución por gravedad. (3) `CREATE VIEW v_tendencia_mensual` — conteo de incidentes por mes y año. (4) Crear `dashboardController.js` y `dashboardService.js`. (5) Crear `dashboard.routes.js` con `requireRole('Administrador', 'Equipo de Formación', 'Directivo')`. (6) Endpoints: `GET /api/v1/dashboard/incidentes-por-curso`, `GET /api/v1/dashboard/por-gravedad`, `GET /api/v1/dashboard/tendencia-mensual`, `GET /api/v1/dashboard/resumen`. (7) Registrar rutas en `index.js`. |
| **Criterios de Aceptación** | - Los 4 endpoints retornan datos correctos verificados contra la BD. - Tiempo de respuesta menor a 1 segundo con datos reales. - Datos filtrados por `tenant_id` (RLS activo). - Roles insuficientes (Inspector, Docente) → 403. - `GET /dashboard/resumen` retorna: total incidentes, total graves, protocolos activos, estudiantes con incidentes. |

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
| **Descripción** | Construir el dashboard analítico con gráficos dinámicos. **Dependencias:** `npm install recharts`. **Subtareas:** (1) Instalar Recharts: `npm install recharts`. (2) Crear `dashboardService.js` en frontend con llamadas a los 4 endpoints. (3) Reemplazar el `DashboardPage.jsx` placeholder con el dashboard real. (4) Tarjetas de resumen: total incidentes, incidentes graves, protocolos activos, estudiantes en seguimiento — con íconos y colores. (5) `GraficoBarrasCurso`: BarChart de Recharts con frecuencia por curso. (6) `GraficoTortaGravedad`: PieChart con distribución por gravedad (verde=Leve, naranja=Grave, rojo=Gravísima). (7) `GraficoTendenciaMensual`: LineChart con incidentes por mes. (8) Navegación lateral o barra superior con links a todos los módulos. (9) Estado vacío con mensaje si no hay datos. (10) Proteger ruta con `RoleRoute(['Administrador', 'Equipo de Formación', 'Directivo'])`. |
| **Criterios de Aceptación** | - Dashboard carga en menos de 3 segundos (RNF-07). - Los 3 gráficos renderizan con datos reales. - Gráfico de torta muestra leyenda con porcentajes. - Tarjetas muestran conteos actualizados. - Sin datos: estado vacío con mensaje claro. - Vista responsiva desde 360px (RNF-08). - Navegación a todos los módulos visible desde el dashboard. |

✅ Guardar

---

## Tareas de HU 3.2 (PDF)

---

### TAREA 3.2.1 — API Generación PDF con membrete

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.2.1 API Generación PDF historial conductual con membrete institucional |
| **Historia padre** | HU 3.2 – Exportación PDF |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `pdf`, `reporteria` |
| **Sprint** | Sprint 3 |
| **Descripción** | Implementar la generación de PDF del historial conductual. **Dependencia:** `npm install pdfkit`. **Endpoint:** `GET /api/v1/estudiantes/:id/pdf`. **Subtareas:** (1) Instalar pdfkit: `npm install pdfkit`. (2) Crear `pdfService.js` con función `generarHistorialPDF(estudiante, incidentes)`. (3) Estructura del PDF: encabezado con nombre del establecimiento y fecha de emisión, datos del estudiante (nombre, RUT, curso, fecha nacimiento), tabla cronológica de incidentes (fecha, tipo, gravedad, relato, medidas), sección de firmas al pie (Coordinador de Convivencia + Director). (4) Agregar endpoint `GET /api/v1/estudiantes/:id/pdf` en `estudiantes.routes.js` con `requireRole('Administrador', 'Equipo de Formación')`. (5) El endpoint retorna el PDF como stream con header `Content-Disposition: attachment; filename=historial_[rut]_[fecha].pdf`. (6) Registrar en auditoría con `tabla_afectada: 'reportes'`. |
| **Criterios de Aceptación** | - PDF generado contiene membrete con nombre de la escuela. - PDF incluye todos los incidentes del estudiante ordenados por fecha descendente. - Espacios de firma presentes al pie. - Tiempo de generación menor a 3 segundos para hasta 50 incidentes. - Archivo descarga con nombre `historial_[rut]_[fecha].pdf`. - Roles insuficientes → 403. |

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
| **Descripción** | Agregar el botón de descarga de PDF en la vista de perfil del estudiante. **Subtareas:** (1) Agregar función `descargarPDF(id)` en `estudiantesService.js`: llama a `GET /estudiantes/:id/pdf` con `responseType: 'blob'`, crea link temporal y dispara descarga. (2) Agregar botón `"Descargar historial PDF"` en `EstudiantePerfilPage.jsx`. (3) Mostrar spinner en el botón durante la generación. (4) Mostrar el botón solo para Administrador y Coordinador. (5) Si el estudiante no tiene incidentes: deshabilitar botón con tooltip `"Sin incidentes para exportar"`. |
| **Criterios de Aceptación** | - Botón visible solo para Administrador y Equipo de Formación. - Clic en el botón descarga el PDF correctamente en el navegador. - Spinner activo durante la generación. - Botón deshabilitado si el estudiante no tiene incidentes. |

✅ Guardar

---

## Tareas de HU 3.3 (Deploy) — ✅ YA COMPLETADAS

---

### TAREA 3.3.1 — Deploy Backend en Render ✅

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.3.1 Deploy Backend en Render con variables de entorno |
| **Historia padre** | HU 3.3 – Despliegue a Producción |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 2 |
| **Estado** | ✅ LISTO |
| **URL producción** | https://siga-backend.onrender.com |

---

### TAREA 3.3.2 — Deploy Frontend en Vercel ✅

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.3.2 Deploy Frontend en Vercel con HTTPS |
| **Historia padre** | HU 3.3 – Despliegue a Producción |
| **Asignado a** | Daniel Flores |
| **Story Points** | 1 |
| **Estado** | ✅ LISTO |
| **URL producción** | https://siga-frontend-delta-six.vercel.app |

---

## Tareas de HU 3.4 (UAT y Entrega)

---

### TAREA 3.4.1 — Carga de datos reales y preparación UAT

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 3.4.1 Carga de datos reales en producción y preparación ambiente UAT |
| **Historia padre** | HU 3.4 – Certificación UAT y Entrega Final |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 1 |
| **Prioridad** | Alta |
| **Etiquetas** | `uat`, `datos`, `produccion` |
| **Sprint** | Sprint 3 |
| **Descripción** | Preparar el ambiente de producción con datos reales para las pruebas UAT. **Subtareas:** (1) Exportar nómina real de estudiantes desde el SIGE del establecimiento y adaptar al formato CSV: `rut,nombre,apellido,curso`. (2) Importar nómina vía `POST /api/v1/estudiantes/importar` en producción. (3) Crear usuarios reales del establecimiento con contraseñas seguras: Administrador (1), Equipo de Formación/Coordinador (1), Directivo (1), Inspector (2), Docente (3). (4) Crear los cursos reales del establecimiento. (5) Registrar al menos 5 incidentes de prueba con distintas gravedades para poblar los gráficos del dashboard. (6) Verificar que el dashboard muestra datos correctamente en producción. |
| **Criterios de Aceptación** | - Los estudiantes reales están en producción y consultables por nombre y RUT. - Todos los usuarios del establecimiento pueden hacer login con sus credenciales. - El dashboard muestra datos reales con al menos 3 tipos de gravedad. - Los gráficos de Recharts renderizan correctamente con datos reales. |

✅ Guardar

---

### TAREA 3.4.2 — Pruebas UAT con el cliente y Documentación de Cierre

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
| **Descripción** | Ejecutar las pruebas UAT con el coordinador y entregar la documentación de cierre. **Guión de pruebas UAT (caja negra):** (1) Login con cada rol — verificar acceso correcto. (2) Buscar un estudiante por nombre sin tilde. (3) Ver perfil del estudiante con historial. (4) Registrar un incidente Gravísimo — verificar alerta visual. (5) Verificar notificación automática en panel del coordinador. (6) Abrir un protocolo RICE vinculado al incidente. (7) Cambiar estado del protocolo a Derivado con observación. (8) Exportar PDF del historial de un estudiante. (9) Verificar dashboard con gráficos actualizados. **Documentación de cierre:** arquitectura del sistema, modelo ER, URLs de producción, credenciales de administrador, manual básico de usuario. |
| **Criterios de Aceptación** | - Todas las pruebas UAT ejecutadas sin errores bloqueantes. - Acta de conformidad firmada por el cliente. - Documentación de cierre entregada en formato PDF o Word. - Credenciales de administrador entregadas al establecimiento. - URLs de producción documentadas y accesibles. |

✅ Guardar

---

## PASO 4 — Ordenar el Sprint 3

1. Ir a **Backlog**
2. Arrastrar al Sprint 3 en este orden:
   - **3.1.1** — Vistas SQL y endpoints (desbloquea el dashboard)
   - **3.1.2** — UI Dashboard
   - **3.2.1** — API PDF
   - **3.2.2** — UI Botón PDF
   - **3.4.1** — Carga de datos reales
   - **3.4.2** — UAT + Documentación
3. Las tareas 3.3.1 y 3.3.2 ya están en LISTO

---

## Resumen de puntos por persona

| Desarrollador | Tareas | Puntos |
|---------------|--------|--------|
| Marcelo Acevedo | 3.1.1, 3.2.1, 3.3.1 ✅, 3.4.1, 3.4.2 | 9 pts |
| Daniel Flores | 3.1.2, 3.2.2, 3.3.2 ✅ | 6 pts |
| **Total** | **8 tareas** | **15 pts** |

---

## Definición de Terminado (DoD) — Sprint 3

Además del DoD de sprints anteriores:

- [ ] Ambas URLs de producción accesibles con HTTPS
- [ ] Dashboard carga en menos de 3 segundos en producción
- [ ] PDF generado correctamente con membrete y firmas
- [ ] Pruebas E2E ejecutadas en producción sin errores bloqueantes
- [ ] Acta UAT firmada por el cliente
- [ ] Documentación de cierre entregada

---

## Buffer UAT — 2 y 3 de Julio

| Actividad | Responsable | Fecha |
|-----------|-------------|-------|
| Ajustes post-UAT (bugs detectados) | Ambos | 2 jul |
| Firma acta de conformidad | Cliente + Marcelo | 3 jul |
| Entrega credenciales y documentación | Marcelo | 3 jul |
| Cierre formal del proyecto | Marcelo | 3 jul |
