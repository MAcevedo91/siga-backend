# SIGA Escolar — Guía Completa: Crear Sprint 7 Manualmente en Jira (Ampliación 7 Pantallas)

> **Capacidad comprometida:** 51 Story Points (Claudia Infante: 33 pts, Daniel Flores: 10 pts, Marcelo Acevedo: 8 pts)  
> **Duración estimada:** 14 días corridos (del 06 de octubre al 20 de octubre de 2026)  
> **Objetivo:** Rediseño integral en Figma de **7 pantallas críticas** (Acciones Pendientes, Directorio Estudiantes, Ficha de Estudiante, Nuevo Incidente, Tablero RICE, Detalle de Protocolo RICE y Nuevo Protocolo RICE) a cargo de Claudia Infante; implementación del Mapa de Calor Analítico por Cursos (Opción A: Curso vs Mes del Año con drill-down pedagógico anónimo); auditoría exhaustiva de Definition of Done (DoD) de todo el monorepo y ejecución del plan de pruebas UAT con el equipo directivo de la Escuela Coeducacional N° 1 El Salvador.

---

## PASO 0 — Configuración del Sprint 7 en Jira

1. Ir a **Backlog** del proyecto SIGA Escolar (`SE`) en Jira.
2. Clic en **Crear sprint**.
3. Completar:

| Campo | Valor |
| :--- | :--- |
| **Nombre** | `Sprint 7 — Rediseño Figma (7 Pantallas), Analítica Preventiva, Auditoría DoD y UAT` |
| **Fecha inicio** | `06/10/2026` |
| **Fecha fin** | `20/10/2026` |
| **Objetivo** | Prototipar en Figma 7 pantallas críticas del sistema a cargo de Claudia Infante; implementar el Mapa de Calor Analítico por Cursos; certificar la calidad técnica global bajo DoD y ejecutar el protocolo UAT con el cliente. |

---

## PASO 1 — Crear la Épica en Jira

| Campo | Valor |
| :--- | :--- |
| **Tipo de Incidencia** | `Epic` |
| **Resumen** | `ÉPICA 7: UX/UI Redesign Integral (7 Pantallas), Analítica Preventiva y Certificación (DoD / UAT)` |
| **Descripción** | Esta épica consolida el perfeccionamiento visual y funcional en Figma de los 7 flujos de usuario más neurálgicos de SIGA Escolar, introduce el análisis de clima de aula mediante un mapa de calor por cursos (Curso vs Mes) y audita la calidad técnica (DoD) y funcional (UAT) en terreno de todo el monorepo escolar. |
| **Prioridad** | `Alta` |
| **Etiquetas** | `figma`, `ux-ui`, `analitica`, `dod`, `uat`, `calidad` |
| **Sprint** | `Sprint 7` |

---

## PASO 2 — Historias de Usuario y Tareas Técnicas Detalladas

---

### HISTORIA 1: Rediseño UI/UX en Figma de las 7 Pantallas Críticas del Sistema

| Campo | Valor |
| :--- | :--- |
| **Tipo de Incidencia** | `Historia` |
| **Resumen** | `HU 7.1 – Rediseño UI/UX en Figma de las 7 Pantallas Críticas del Ecosistema Escolar` |
| **Épica Vinculada** | `ÉPICA 7` |
| **Descripción** | **Como** equipo directivo, docentes e inspectores de la Escuela El Salvador, **quiero** contar con prototipos en alta fidelidad y rediseños intuitivos, modernos y accesibles en las 7 vistas principales de la plataforma **para** registrar incidentes, consultar historiales, activar protocolos RICE y gestionar plazos legales con fluidez, sin errores y con una experiencia de usuario óptima en computadores y dispositivos móviles. |
| **Criterios de Aceptación** | 1. 7 pantallas prototipadas en Figma en alta fidelidad para Desktop (1440px) y Mobile (360px).<br>2. Componentes estandarizados según el Design System SIGA (paleta institucional, semáforo normativo RICE, badges PIE y tipografía legible WCAG AA).<br>3. Especificación detallada de cada componente, estados interactivos (:hover, :active, :focus, :disabled) y microinteracciones. |
| **Asignado a** | **Claudia Infante Soto** |
| **Estimación** | `33 Story Points` |
| **Prioridad** | `Muy Alta` |
| **Sprint** | `Sprint 7` |

#### Desglose de Subtareas Técnicas (7 Pantallas):

#### TASK 7.1.1 — Rediseño en Figma: Bandeja de Acciones Pendientes (4 SP | Claudia Infante)
* **Descripción:** Diseñar un centro de control de plazos y tareas operativas para Inspectoría General y Convivencia Escolar.
* **Componentes Necesarios a Prototipar:**
  - `ContadorUrgenciasBar`: Barra superior con contadores en tiempo real (*"X vencidas"*, *"X urgentes < 48 hrs"*, *"X en plazo"*).
  - `TabsFiltroEstado`: Pestañas de estado (*Todas*, *Vencidas 🔴*, *Críticas 🟡*, *En Plazo 🟢*).
  - `FiltrosAvanzadosBar`: Selectores de filtrado por Curso (Kínder a 8°), Tipo de Protocolo y Responsable.
  - `AccionPendienteCard`: Tarjeta individual de tarea con nombre del alumno, curso, protocolo asociado, acción legal exigida, `CountdownTimerBadge` (días/horas restantes) y botones de acción rápida.
  - `ModalCompletarAccion`: Modal para registrar el cumplimiento de la tarea con fecha, observaciones y subida de evidencia.
* **Criterios de Aceptación:** Vista interactiva navegable; jerarquización clara de casos con riesgo de infracción ante la Superintendencia.

---

#### TASK 7.1.2 — Rediseño en Figma: Listado de Estudiantes del Curso Seleccionado (5 SP | Claudia Infante)
* **Descripción:** Rediseñar la vista del listado detallado de estudiantes que se despliega inmediatamente tras hacer clic en la tarjeta de un curso específico (ej. 5° Básico A). **Se excluye** el rediseño de la sección/cards de selección de cursos previa, enfocándose 100% en la experiencia de gestión, búsqueda y visualización de la nómina de alumnos del curso.
* **Componentes Necesarios a Prototipar:**
  - `BotonVolverACursos`: Botón de navegación contextual *"← Volver a Cursos"* para retornar a la selección de niveles.
  - `CabeceraCursoActivoCard`: Tarjeta informativa fija del curso en consulta con fotografía y nombre del Profesor Jefe, sala asignada, total de matriculados activos y total de estudiantes con apoyo PIE.
  - `OmniboxBuscadorEstudiantes`: Barra de búsqueda interna en tiempo real con debounce por Nombre, Apellido o RUT con formateo automático (Módulo 11).
  - `ToggleFiltrosRapidos`: Chips conmutables de filtro instantáneo `[ Solo PIE ]`, `[ Con Incidentes Activos ]`, `[ Riesgo Conductual Alto ]`, `[ Retirados ]`.
  - `VistaToggleControl`: Alternador visual para conmutar entre *Vista Lista / Tabla* y *Vista Tarjetas / Grid*.
  - `EstudianteFilaItem` y `EstudianteCard`: Fila/tarjeta de alumno con:
    * `AvatarUsuario`: Fotografía institucional con fallback de iniciales coloreadas por estado.
    * `DatosIdentificacion`: Nombre completo del alumno, RUT chileno formateado y edad.
    * `BadgePIE`: Distintivo visual violeta para estudiantes del Programa de Integración Escolar.
    * `BadgeRiesgoConductual`: Semáforo de recurrencia conductual (Verde: 0; Amarillo: 1-2 leves; Rojo: $\ge 3$ incidentes o casos RICE activos).
    * `MenuAccionesFila`: Botones de acción directa `[Ver Ficha Completa]`, `[Registrar Incidente]` y menú de 3 puntos.
  - `BarraAccionesNomina`: Botones de cabecera *"Exportar Nómina (Excel / PDF)"* y *"Registrar Incidente Grupal"*.
* **Criterios de Aceptación:** Vista interactiva en Desktop y Mobile optimizada para nóminas de 35 a 45 estudiantes por curso; alternancia fluida entre vista lista y vista cuadrícula; no modifica ni altera el diseño de la pantalla previa de selección de cursos.

---

#### TASK 7.1.3 — Rediseño en Figma: Ficha y Detalles del Estudiante (5 SP | Claudia Infante)
* **Descripción:** Rediseñar el expediente digital único del alumno (`EstudiantePerfilPage`) para entrevistas con apoderados, fiscalizaciones y seguimiento de la Dupla Psicosocial.
* **Componentes Necesarios a Prototipar:**
  - `PerfilHeaderCard`: Fotografía de perfil en alta resolución con badge de estado (*Matriculado*, *Retirado*, *Egresado*), nombre, RUT, curso, fecha de nacimiento, edad, datos del apoderado titular (con botón de llamada/WhatsApp) y badge PIE.
  - `BannerRiesgoConductual`: Alerta superior contextual que se activa si el alumno posee score de riesgo conductual $\ge 6$.
  - `ResumenMetricasGrid`: 4 tarjetas KPI (*Total Incidentes*, *Faltas Graves*, *Protocolos RICE Activos* y *Entrevistas Realizadas*).
  - `TabsExpediente`: Pestañas navegables:
    * `TimelineIncidentes`: Línea de tiempo cronológica con tarjeta de cada suceso, fecha, gravedad, relato y medidas.
    * `ListaProtocolosAlumno`: Historial de protocolos donde figura como afectado o agresor.
    * `HistorialEntrevistas`: Citaciones a la familia con compromisos firmados.
  - `BarraAccionesPerfil`: Botón primario *"Descargar Historial Oficial PDF"* (con membrete de la Escuela El Salvador), botón *"Nuevo Incidente"* y botón *"Citar Apoderado"*.
* **Criterios de Aceptación:** Expediente completo legible en una sola vista; diseño que facilite la lectura rápida durante una reunión presencial con la familia.

---

#### TASK 7.1.4 — Rediseño en Figma: Registro de Nuevo Incidente (5 SP | Claudia Infante)
* **Descripción:** Rediseñar el formulario de ingreso de incidentes (`NuevoIncidentePage`) para registrar situaciones de patio o sala con múltiples alumnos involucrados de forma rápida y sin ambigüedades.
* **Componentes Necesarios a Prototipar:**
  - `CabeceraFormularioIncidente`: Fecha, hora y selector de lugar físico (*Patio central*, *Sala de clases*, *Comedor*, *Baños*, *Gimnasio*).
  - `SelectorEstudiantesInvolucrados` (Multiselección N:M en cascada: Nivel $\rightarrow$ Curso $\rightarrow$ Alumno).
  - `EstudianteInvolucradoItemCard`: Tarjeta por alumno agregado con `SelectorRolEstudiante` (radio chips para definir: *Afectado / Víctima*, *Involucrado / Agresor*, *Testigo*), campo de observación individual y botón de remover.
  - `SelectorTipoAbordaje`: Menú interactivo de los 7 abordajes normativos.
  - `SelectorGravedad`: Radio cards explicativos (*Leve*, *Grave*, *Gravísima*).
  - `ModalAlertaGrave` (`AlertaGrave.jsx`): Modal automático que advierte sobre la obligación de activar protocolo RICE ante situaciones graves.
  - `TextareaRelatoFactico`: Cuadro de redacción objetivo con contador de caracteres.
  - `TextareaMedidasInmediatas`: Campo de registro de primeros auxilios y contención.
  - `FooterAccionesFormulario`: Botones *"Cancelar"*, *"Guardar Borrador"* y *"Registrar y Activar Protocolo RICE"*.
* **Criterios de Aceptación:** Flujo ágil que permita registrar un incidente complejo con 3 alumnos involucrados en menos de 2 minutos.

---

#### TASK 7.1.5 — Rediseño en Figma: Tablero General de Protocolos RICE (5 SP | Claudia Infante)
* **Descripción:** Rediseñar la vista general `ProtocolosPage` para transformar la lista plana en un tablero de gestión procesal normativo.
* **Componentes Necesarios a Prototipar:**
  - `FiltrosProtocolosBar`: Filtros combinados por Estado (*En Investigación*, *Derivado*, *Cerrado*), Tipo de Protocolo (los 10 oficiales) y Año.
  - `PipelineFasesNormativas`: Columnas/embudo que represente las 4 fases de la circular RICE (*Detección/Medidas Urgentes*, *Indagación*, *Descargos*, *Resolución*).
  - `ProtocoloCard`: Tarjeta de caso con Folio oficial (ej. `PROT-2026-0042`), icono temático del protocolo, nombre del alumno, curso, `BadgeSemaforoPlazo` (días hábiles transcurridos vs permitidos), barra de avance del checklist y avatar del responsable.
  - `BotonNuevoProtocolo`: Botón superior destacado *"Aperturar Nuevo Protocolo RICE"*.
* **Criterios de Aceptación:** Vista de embudo interactiva que permita al equipo directivo auditar de un vistazo cuántos casos hay abiertos en cada etapa procesal.

---

#### TASK 7.1.6 — Rediseño en Figma: Apertura de Nuevo Protocolo RICE (4 SP | Claudia Infante)
* **Descripción:** Rediseñar la pantalla de apertura formal (`NuevoProtocoloPage`) asegurando el cumplimiento estricto de las exigencias legales de la Superintendencia de Educación.
* **Componentes Necesarios a Prototipar:**
  - `SelectorEstudianteFoco`: Selector en cascada con buscador predictivo.
  - `AlertaEscaladaBanner`: Banner predictivo automático que resume antecedentes de reincidencia o agresiones en los últimos 45 días al seleccionar al estudiante.
  - `SelectorTipoProtocoloCards`: Cuadrícula con los 10 protocolos normativos oficiales (Bullying, Ciberacoso, Drogas, Vulneración de derechos, etc.) con tooltip explicativo de la normativa.
  - `SelectorIncidenteOrigen`: Lista desplegable con los incidentes recientes del alumno para vincular la apertura a un hecho fáctico previo.
  - `TextareaMedidasResguardoUrgentes`: Campo obligatorio de medidas inmediatas de protección (Circular N° 482).
  - `FooterApertura`: Botón *"Cancelar"* y botón primario *"Activar Protocolo e Iniciar Checklist Normativo"*.
* **Criterios de Aceptación:** Formulario blindado que impida abrir un protocolo sin medidas de resguardo inmediatas especificadas.

---

#### TASK 7.1.7 — Rediseño en Figma: Detalle y Seguimiento de Protocolo RICE (5 SP | Claudia Infante)
* **Descripción:** Rediseñar el expediente formal del protocolo (`ProtocoloDetallePage`) para tramitar avances, cumplir plazos y registrar evidencias normativas.
* **Componentes Necesarios a Prototipar:**
  - `CabeceraExpediente`: Folio oficial, tipo de protocolo, estado actual y `SemaforoPlazosFatales` (alerta de 48 hrs para denuncias judiciales y 10 días para descargos).
  - `StepperProgresoNormativo`: Barra horizontal interactiva que ilustra las fases del proceso escolar.
  - `ChecklistSuperintendencia` (`ChecklistProtocolo.jsx`): Lista interactiva de pasos obligatorios según el tipo de protocolo, con checkboxes, responsable asignado, fecha de completitud y campo para adjuntar evidencias.
  - `BitacoraObservaciones`: Historial inmutable de avances con marca de tiempo y autor.
  - `ModalAvanzarEstado`: Formulario de cambio de fase con campo obligatorio de fundamentación legal.
  - `BarraAccionesProtocolo`: Botones *"Asistente IA: Generar Acta"*, *"Descargar Expediente PDF"*, *"Derivar a Red Externa"* y *"Cerrar Protocolo"*.
* **Criterios de Aceptación:** Tramitación intuitiva del expediente con feedback visual claro del cumplimiento de los requisitos de la Superintendencia.

---

### HISTORIA 2: Mapa de Calor por Cursos en Analítica (Clima Escolar)

| Campo | Valor |
| :--- | :--- |
| **Tipo de Incidencia** | `Historia` |
| **Resumen** | `HU 7.2 – Mapa de Calor por Cursos (Evolución del Clima Escolar)` |
| **Épica Vinculada** | `ÉPICA 7` |
| **Descripción** | **Monitoreo preventivo del clima de aula por nivel y mes.** Haz clic en cualquier celda para abrir el diagnóstico pedagógico.<br><br>**Como** Encargado de Convivencia Escolar o Directiva, **quiero** una matriz anual de cursos vs meses lectivos con semáforos y drill-down, **para** anticipar focos de conflicto y focalizar intervenciones preventivas sin estigmatizar alumnos. |
| **Criterios de Aceptación** | 1. Matriz de cursos (Pre-Kínder a 8°) vs meses lectivos (Marzo a Diciembre).<br>2. Orden jerárquico escolar chileno estricto.<br>3. Semáforos: Neutro (0), Verde (1-2), Amarillo (3-5 o 1 grave), Naranja (6-8), Rojo (9+ o gravísima).<br>4. Clic en celda abre modal de diagnóstico con métricas agregadas, tipologías y recomendación formativa.<br>5. Anonimización estricta (sin nombres ni RUTs).<br>6. RBAC: Directivos ven todos los cursos; Profesores Jefes solo su curso jefatura.<br>7. Filtros por ciclo escolar y año. |
| **Asignado a** | **Daniel Flores Jaime / Marcelo Acevedo Silva** |
| **Estimación** | `8 Story Points` |
| **Prioridad** | `Alta` |
| **Sprint** | `Sprint 7` |

#### Subtareas de HU 7.2:

* **TASK 7.2.1 — Backend: Servicios analíticos, agregación por curso/mes, ordenamiento jerárquico, RBAC y DLP ético (4 SP | Marcelo Acevedo):**
  - **Servicio de Matriz Anual:** Creación del servicio analítico para consultar la matriz anual por año escolar y ciclo, agrupando incidentes por mes lectivo (excluyendo vacaciones de enero y febrero) y calculando niveles de criticidad dinámicos por celda.
  - **Servicio de Detalle por Celda (Drill-Down):** Creación del servicio para obtener el diagnóstico específico de un curso en un mes determinado, calculando totales de faltas leves, graves y gravísimas, protocolos RICE activados, porcentaje de tipologías de conflicto, concentración de lugares físicos y generación de una recomendación pedagógica orientadora.
  - **Ordenamiento Jerárquico Chileno:** Implementación de ordenamiento institucional por niveles (Pre-Kínder, Kínder, 1° Básico hasta 8° Básico con sus respectivas letras A y B), evitando el orden alfabético simple.
  - **Control de Acceso (RBAC):** Restricción automática para que los docentes con jefatura solo puedan consultar su curso asignado, retornando error de permisos si intentan acceder a otro curso.
  - **Tratamiento Ético y DLP:** Sanitización de respuestas para garantizar que ningún dato analítico incluya identificadores personales de estudiantes.
  - **Optimización de Rendimiento:** Implementación de caché en memoria con tiempo de vida de 3 minutos e invalidación automática al registrar un nuevo incidente.

* **TASK 7.2.2 — Frontend: Componente de visualización matricial, filtros por ciclo y modal pedagógico de drill-down (4 SP | Daniel Flores):**
  - **Componente de Matriz de Calor:** Construcción del componente de tabla matricial con cabecera de meses de ancho fijo, filas jerarquizadas por curso, tooltips descriptivos al posar el cursor, leyenda de semáforos explicativa y tarjetas resumen al pie con el mes de mayor conflictividad y el curso con mayor requerimiento formativo.
  - **Barra de Filtros y Navegación:** Controles interactivos para cambiar de año escolar, filtrar por ciclo educativo (Parvularia, Primer Ciclo, Segundo Ciclo) y botón para exportar el reporte de clima escolar.
  - **Modal de Diagnóstico Pedagógico:** Construcción de la ventana modal emergente con animación de entrada, desenfoque de fondo, tarjetas de resumen de gravedad, barras horizontales de distribución de faltas, etiquetas de lugares críticos y panel con sugerencia formativa preventiva.
  - **Integración en Panel Analítico:** Incorporación del mapa de calor como pestaña dedicada dentro del dashboard de analítica, con estados visuales de carga mediante esqueletos y estado vacío amigable si no hay registros.

---

### TAREA 1: Auditoría DoD (Definition of Done) de Todo el Sistema

| Campo | Valor |
| :--- | :--- |
| **Tipo de Incidencia** | `Tarea` (Task) |
| **Clave Sugerida** | `SIGA-S7-TASK-01` (o `TASK 7.3`) |
| **Resumen** | `TASK 7.3 – Auditoría Integral de Calidad Técnica del Sistema bajo Estándar Definition of Done (Sprints 1 al 7)` |
| **Épica Vinculada** | `ÉPICA 7` |
| **Descripción** | **Propósito:** Ejecutar una auditoría técnica exhaustiva sobre todos los módulos desarrollados en el monorepo (Sprints 1 al 7) utilizando la lista de verificación oficial de Definition of Done (DoD), para asegurar estabilidad operativa y cero errores antes de la entrega final.<br><br>**Alcance del Trabajo:**<br>1. **Inspección de Consola DevTools:** Recorrer todos los flujos principales (autenticación, gestión de alumnos, registro de incidentes, protocolos RICE, analítica y reportes) verificando 0 advertencias de claves de renderizado, 0 errores no controlados y ausencia de fugas de memoria.<br>2. **Resiliencia y Persistencia:** Comprobar recargas forzadas de página en rutas anidadas (perfiles de alumnos, detalle de protocolos y analítica), validando que la sesión se preserve sin redirigir al login ni presentar pantallas en blanco.<br>3. **Adaptabilidad Responsiva:** Verificar que toda la interfaz sea completamente operable en anchos móviles (360px a 414px) sin desbordes horizontales no deseados.<br>4. **Accesibilidad y Modo Oscuro:** Comprobar contraste tipográfico y legibilidad conforme al estándar WCAG AA.<br>5. **Aislamiento Multi-Tenant:** Validar que las consultas y servicios filtren estrictamente por el colegio del usuario, impidiendo accesos cruzados entre establecimientos.<br>6. **Firma del Dictamen DoD:** Completar y formalizar la matriz de chequeo como requisito previo para iniciar las pruebas con el cliente. |
| **Criterios de Aceptación** | 1. 0 errores y 0 warnings críticos en la consola del navegador durante el recorrido completo.<br>2. Recarga con tecla de actualización exitosa en todas las rutas privadas.<br>3. Interfaz 100% responsiva y sin scroll horizontal en resolución de 360px.<br>4. Contraste accesible WCAG AA verificado en modo claro y modo oscuro.<br>5. Aislamiento multi-tenant certificado.<br>6. Protocolo de auditoría DoD completado y firmado. |
| **Asignado a** | **Claudia Infante Soto** |
| **Estimación** | `5 Story Points` |
| **Prioridad** | `Muy Alta` |
| **Sprint** | `Sprint 7` |

---

### TAREA 2: Plan y Ejecución de Pruebas UAT en Terreno

| Campo | Valor |
| :--- | :--- |
| **Tipo de Incidencia** | `Tarea` (Task) |
| **Clave Sugerida** | `SIGA-S7-TASK-02` (o `TASK 7.4`) |
| **Resumen** | `TASK 7.4 – Planificación, Conducción en Terreno y Firma de Acta de Pruebas UAT con Escuela El Salvador` |
| **Épica Vinculada** | `ÉPICA 7` |
| **Descripción** | **Propósito:** Planificar, coordinar y conducir la sesión formal de Pruebas de Aceptación de Usuario (UAT) en terreno con el equipo directivo de la Escuela Coeducacional N° 1 El Salvador, validando la adopción operativa de la plataforma y formalizando la entrega del sistema.<br><br>**Alcance del Trabajo:**<br>1. **Preparación de Ambiente y Datos:** Configurar credenciales de acceso para los perfiles evaluadores (Directora, Inspectora General, Encargada de Convivencia) y poblar datos de simulación representativos.<br>2. **Libreto Guiado de Pruebas:** Disponer de los 14 casos de prueba estructurados (incluyendo el Mapa de Calor de Clima Escolar) para orientar a las usuarias paso a paso.<br>3. **Conducción de la Jornada Presencial:** Acompañar a las autoridades del establecimiento durante la ejecución de los flujos reales de convivencia, levantando observaciones y validando su satisfacción de uso.<br>4. **Formalización del Acta Conforme:** Redactar y firmar conjuntamente el Acta de Recepción Conforme UAT, certificando que la plataforma cumple con los requerimientos acordados. |
| **Criterios de Aceptación** | 1. 100% de los casos de prueba bloqueantes aprobados por el cliente.<br>2. Al menos 13 de los 14 casos de prueba totales aprobados.<br>3. Acta de recepción y conformidad formalmente firmada por la Dirección de la Escuela El Salvador. |
| **Asignado a** | **Claudia Infante Soto** |
| **Estimación** | `5 Story Points` |
| **Prioridad** | `Muy Alta` |
| **Sprint** | `Sprint 7` |

---

## Matriz Consolidada de Distribución de Carga del Sprint 7

| Integrante | Rol en el Sprint | Incidencias Asignadas | Total Story Points |
| :--- | :--- | :--- | :---: |
| **Claudia Infante Soto** | Lead UI/UX, QA & UAT | HU 7.1 (7 Pantallas Figma: 33 SP), TASK 7.3 (DoD: 5 SP) y TASK 7.4 (UAT: 5 SP) | **43 SP** |
| **Daniel Flores Jaime** | Frontend Lead | HU 7.2 (Frontend Mapa de Calor y Modales) | **4 SP** |
| **Marcelo Acevedo Silva** | Backend Lead | HU 7.2 (Backend Analítica y RBAC) | **4 SP** |
| **TOTAL COMPROMETIDO SPRINT 7** | | | **51 SP** |
