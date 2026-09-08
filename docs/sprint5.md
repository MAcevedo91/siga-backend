# SIGA Escolar — Guía Completa: Crear Sprint 5 Manualmente en Jira

> **Capacidad comprometida:** 36 puntos (Marcelo 20 pts + Daniel 16 pts)  
> **Duración:** 7 días (continuación y consolidación de la Épica de Motor de Reglas y Alertas)  
> **Objetivo:** Implementar el Checklist RICE normativo interactivo con validación estricta de cumplimiento de etapas, el motor de alertas de escalada y reincidencia por estudiante (con banners contextuales), el panel de configuración centralizada de parámetros y plazos para el Administrador, la ficha integral del estudiante con condición PIE (Programa de Integración Escolar) y domicilios, y la reestructuración curricular con tabla `periodos_academicos` junto al selector de alumnos en cascada (Nivel $\rightarrow$ Letra $\rightarrow$ Alumnos).

---

## 💡 ¿Cómo sabe el sistema que los pasos del Checklist se realizaron? (Mecanismo Estricto)

Para garantizar la validez legal y pedagógica ante fiscalizaciones de la Superintendencia de Educación, el sistema no opera con "marcas automáticas ciegas", sino mediante **certificación explícita con trazabilidad**:

1. **Plantilla Automática:** Al abrirse un nuevo protocolo en `POST /protocolos`, el sistema crea automáticamente los registros en la tabla `protocolo_pasos` clonando las acciones definidas en `reglas_protocolo` para ese tipo de caso.
2. **Registro de Cumplimiento en UI:** En `ProtocoloDetallePage`, cada paso tiene un botón/checkbox interactivo `"Completar paso"`. Al pulsarlo, se despliega un modal obligatorio donde el funcionario debe ingresar una **glosa u observación de respaldo** (ej: *"Se realiza entrevista presencial con apoderado Juan Pérez, se levanta acta N° 14 archivada en inspectoría"*).
3. **Persistencia y Firma Digital Interna:** El backend almacena:
   - `completado = true`
   - `fecha_completado = NOW()`
   - `responsable_id = req.user.id` (usuario autenticado que certifica la acción)
   - `observacion = glosa ingresada`
4. **Bloqueo Estricto de Transición:** Al intentar cambiar el estado del protocolo (ej: de `En Investigación` a `Derivado` o a `Cerrado`), el backend valida en `protocolosService.js` que el 100% de los pasos normativos de la fase estén completados (`completado = true`). Si existe algún paso pendiente, el backend rechaza la petición con código `400 Bad Request` indicando qué pasos faltan, y el botón en el frontend se muestra deshabilitado con un tooltip de advertencia.

---

## PASO 0 — Crear el Sprint 5 en Jira

1. Ir a la vista **Backlog** del proyecto SIGA-escolar en Jira.
2. Hacer clic en **Crear sprint**.
3. Completar los campos con los siguientes datos:

| Campo | Valor |
|-------|-------|
| **Nombre del sprint** | Sprint 5 |
| **Fecha de inicio** | _(Día hábil siguiente al cierre del Sprint 4)_ |
| **Fecha de finalización** | _(+7 días corridos)_ |
| **Objetivo del sprint** | Entregar el checklist normativo RICE con validación estricta de pasos en detalle de protocolo, banners de alerta por reincidencia y escalada de gravedad, panel de administración para calibrar umbrales y plazos sin tocar código, condición PIE y domicilios en ficha de estudiante, y selector en cascada (Nivel -> Letra -> Alumno) con períodos académicos |

---

## PASO 1 — Épica Asociada

Este sprint concluye y consolida la épica iniciada en el Sprint 4:

| Campo | Valor |
|-------|-------|
| **Tipo** | Epic |
| **Clave / Nombre** | `Motor de Reglas y Alertas Tempranas` (o clave existente `SE-59`) |
| **Descripción** | Implementar un sistema determinístico de scoring y alertas de plazo que procese los datos ya existentes en SIGA para informar al equipo de convivencia sobre qué casos requieren acción inmediata. El Sprint 5 implementa el checklist normativo por caso, las alertas de escalada contextuales, el panel de configuración, los campos de inclusión y domicilio, y el modelo de períodos académicos con selector en cascada. |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `alertas`, `rice`, `configuracion`, `pie`, `cursos` |

---

## PASO 2 — Crear las Historias de Usuario

---

### HISTORIA 1: HU 5.1 – Checklist RICE Normativo con Bloqueo Estricto de Etapas

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 5.1 – Checklist RICE Normativo con Bloqueo Estricto de Etapas |
| **Épica** | Motor de Reglas y Alertas Tempranas |
| **Descripción** | **Como** coordinador de convivencia o directivo, **quiero** registrar y verificar el cumplimiento paso a paso de las acciones normativas de cada protocolo RICE **para** certificar que ningún caso se derive o cierre sin haber ejecutado las actuaciones obligatorias que exige la Superintendencia de Educación. |
| **Criterios de Aceptación** | 1. Al abrir un protocolo se inicializan automáticamente los pasos normativos según su tipo. <br>2. Cada paso puede marcarse como completado requiriendo obligatoriamente una glosa de observación.<br>3. Se registra fecha exacta y el usuario que certificó la acción.<br>4. El sistema bloquea el avance a `Derivado` o `Cerrado` si existen pasos pendientes en la fase.<br>5. En la vista de detalle se muestra el porcentaje de avance del checklist. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `rice`, `auditoria`, `protocolos` |
| **Sprint** | Sprint 5 |
| **Estado inicial** | POR HACER |

---

### HISTORIA 2: HU 5.2 – Alertas de Antecedentes y Detección de Escalada de Casos

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 5.2 – Alertas de Antecedentes y Detección de Escalada de Casos |
| **Épica** | Motor de Reglas y Alertas Tempranas |
| **Descripción** | **Como** encargado de convivencia o inspector, **quiero** visualizar un banner de alerta preventiva al abrir o revisar un caso si el estudiante presenta reincidencia en el mismo ámbito o escalada rápida de faltas leves a graves **para** tomar medidas formativas oportunas y evaluar protocolos más rigurosos. |
| **Criterios de Aceptación** | 1. Detección automática de reincidencia (≥ 2 incidentes del mismo tipo/ámbito en la ventana de análisis).<br>2. Detección de escalada de gravedad (salto de falta Leve a Grave/Gravísima en menos de 15 días).<br>3. Renderizado de banner prominente en `NuevoProtocoloPage` al seleccionar al estudiante.<br>4. Renderizado de banner contextual persistente en el encabezado de `ProtocoloDetallePage`.<br>5. El texto del banner es descriptivo, no estigmatizante y fundamentado en hechos. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `escalada`, `alertas`, `ui` |
| **Sprint** | Sprint 5 |
| **Estado inicial** | POR HACER |

---

### HISTORIA 3: HU 5.3 – Panel de Administración y Configuración Dinámica de Parámetros

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 5.3 – Panel de Administración y Configuración Dinámica de Parámetros |
| **Épica** | Motor de Reglas y Alertas Tempranas |
| **Descripción** | **Como** administrador del establecimiento, **quiero** un panel de configuración para calibrar los umbrales de riesgo, ventanas de días y editar los plazos en días de las reglas de los 10 protocolos **para** adaptar el sistema a actualizaciones del RICE o exigencias normativas del Ministerio sin depender de cambios en el código. |
| **Criterios de Aceptación** | 1. Nueva ruta protegida `/configuracion` accesible exclusivamente para el rol `Administrador`.<br>2. Configuración editable de umbral de score de riesgo (default 6) y ventana de análisis (default 30 días).<br>3. Tabla editable de plazos en días para las acciones de los 10 tipos de protocolo RICE.<br>4. Validación de campos numéricos positivos y guardado seguro con feedback en pantalla.<br>5. Los cambios en umbrales impactan de inmediato en el cálculo de endpoints analíticos. |
| **Asignado a** | Daniel Flores |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `configuracion`, `admin`, `ui` |
| **Sprint** | Sprint 5 |
| **Estado inicial** | POR HACER |

---

### HISTORIA 4: HU 5.4 – Ficha Integral del Estudiante: Condición PIE y Domicilio Familiar

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 5.4 – Ficha Integral del Estudiante: Condición PIE y Domicilio Familiar |
| **Épica** | Motor de Reglas y Alertas Tempranas |
| **Descripción** | **Como** encargado de convivencia, dupla psicosocial o directivo, **quiero** registrar y visualizar si un estudiante pertenece al Programa de Integración Escolar (PIE) y conocer su domicilio y el de su apoderado **para** contextualizar adecuadamente las intervenciones formativas, visitas domiciliarias y protocolos RICE conforme a las necesidades educativas especiales del alumno. |
| **Criterios de Aceptación** | 1. Registro de campo booleano `es_pie` (true/false) por estudiante en base de datos y endpoints.<br>2. Registro de campo `direccion` tanto para el estudiante como para el apoderado.<br>3. Visualización destacada de badge `"PIE"` en el encabezado de `EstudiantePerfilPage.jsx`.<br>4. Visualización de los domicilios en la ficha personal del estudiante y del apoderado.<br>5. Soporte en el importador masivo CSV/Excel para columnas opcionales `pie` y `domicilio`. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Media |
| **Etiquetas** | `backend`, `frontend`, `estudiantes`, `pie`, `inclusion` |
| **Sprint** | Sprint 5 |
| **Estado inicial** | POR HACER |

---

### HISTORIA 5: HU 5.5 – Gestión de Períodos Académicos y Búsqueda en Cascada de Estudiantes

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 5.5 – Períodos Académicos y Selector en Cascada (Nivel -> Letra -> Alumno) |
| **Épica** | Motor de Reglas y Alertas Tempranas |
| **Descripción** | **Como** usuario registrador de incidentes o protocolos, **quiero** seleccionar a los estudiantes mediante un flujo en cascada ordenado por Nivel y Letra de curso **para** encontrar al alumno en segundos de forma inequívoca sin tener que escribir nombres o RUTs en listas globales extensas. |
| **Criterios de Aceptación** | 1. Estructura relacional con tabla `periodos_academicos` vinculada a `cursos` (`periodo_id`, `nivel`, `letra`).<br>2. Al buscar un alumno en incidentes o protocolos, aparece inicialmente el selector de **Nivel** (ej. 1° Básico, 2° Básico...).<br>3. Al seleccionar el nivel, se despliega automáticamente el selector de **Letra** (ej. A, B).<br>4. Al seleccionar la letra, se despliega la lista desplegable con los alumnos pertenecientes a ese curso exacto, ordenados alfabéticamente.<br>5. El selector permite seleccionar al alumno con un clic y soporta agregar múltiples involucrados en incidentes. |
| **Asignado a** | Daniel Flores |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `cursos`, `ux`, `cascada` |
| **Sprint** | Sprint 5 |
| **Estado inicial** | POR HACER |

---

## PASO 3 — Crear las Tareas Técnicas Detalladas

---

### Tareas de HU 5.1 (Checklist RICE y Bloqueo Estricto)

---

#### TAREA 5.1.1 — Tabla `protocolo_pasos` con RLS e Inicialización Automática

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 5.1.1 Modelo DDL `protocolo_pasos` e inicialización automática |
| **Historia padre** | HU 5.1 – Checklist RICE Normativo con Bloqueo Estricto de Etapas |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `bd`, `supabase`, `ddl` |
| **Sprint** | Sprint 5 |
| **Descripción** | Crear la estructura de persistencia en Supabase para almacenar el avance de las acciones individuales de cada protocolo abierto. <br><br>**Subtareas:**<br>1. Ejecutar DDL en PostgreSQL/Supabase para `protocolo_pasos` con RLS y claves foráneas.<br>2. Actualizar `protocolosService.js`: en la función `crearProtocolo()`, tras insertar en `protocolos_rice`, consultar las reglas activas de `reglas_protocolo` para ese `tipo_protocolo_id` y generar mediante `bulk insert` los pasos iniciales en `protocolo_pasos` (`completado: false`).<br>3. Migración de retrocompatibilidad: crear script de relleno para vincular pasos en los protocolos ya existentes en la BD. |
| **Criterios de Aceptación** | - Tabla creada en Supabase con RLS verificado.<br>- Al crear un nuevo protocolo RICE se insertan automáticamente sus 4 pasos correspondientes.<br>- Protocolo con id inexistente o de otro tenant no permite inserción ni lectura. |

---

#### TAREA 5.1.2 — API de Gestión de Pasos y Validación de Cierre Estricto

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 5.1.2 Endpoints de pasos y validación estricta al avanzar estado |
| **Historia padre** | HU 5.1 – Checklist RICE Normativo con Bloqueo Estricto de Etapas |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 4 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `api`, `protocolos`, `validaciones` |
| **Sprint** | Sprint 5 |
| **Descripción** | Implementar los endpoints para consultar y certificar pasos, e integrar la regla de bloqueo en la máquina de estados de protocolos.<br><br>**Subtareas:**<br>1. Crear ruta `GET /api/v1/protocolos/:id/pasos` que retorne la lista de pasos ordenados por `orden` con datos del usuario que completó.<br>2. Crear ruta `PATCH /api/v1/protocolos/:id/pasos/:pasoId`: recibe body `{ completado: boolean, observacion: string }`. Requiere obligatoriamente `observacion` (mínimo 5 caracteres) al marcar como completado. Registra `responsable_id = req.user.id` y `fecha_completado = new Date()`.<br>3. Modificar `avanzarEstado()` en `protocolosService.js`: antes de actualizar el estado del protocolo a `Derivado` o `Cerrado`, consultar si existen pasos con `completado = false`. Si existen, lanzar excepción HTTP 400 con detalle: `{"error": "No se puede avanzar el estado: existen pasos normativos pendientes", "pasos_pendientes": [...]}`.<br>4. Registrar cada paso completado en la tabla `auditoria`. |
| **Criterios de Aceptación** | - Marcar paso sin observación retorna 400 Bad Request.<br>- Marcar paso con usuario logueado guarda correctamente `responsable_id` y `fecha_completado`.<br>- Intentar cerrar protocolo con pasos pendientes retorna 400 y no altera el estado en BD.<br>- Completar todos los pasos permite cambiar estado a `Cerrado` exitosamente. |

---

#### TAREA 5.1.3 — Componente `ChecklistProtocolo.jsx` y Bloqueo en `ProtocoloDetallePage`

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 5.1.3 UI Checklist interactivo con modal de certificación en Detalle |
| **Historia padre** | HU 5.1 – Checklist RICE Normativo con Bloqueo Estricto de Etapas |
| **Asignado a** | Daniel Flores |
| **Story Points** | 4 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `protocolos`, `modal` |
| **Sprint** | Sprint 5 |
| **Descripción** | Desarrollar el componente visual de lista de verificación normativa e integrarlo en la vista del protocolo.<br><br>**Subtareas:**<br>1. Crear servicio frontend en `protocolosService.js`: `getPasosProtocolo(id)` y `actualizarPasoProtocolo(id, pasoId, data)`.<br>2. Crear componente `ChecklistProtocolo.jsx` con barra de progreso porcentual (`X de Y pasos completados`).<br>3. Cada ítem muestra: badge con orden y plazo, título de acción, estado (completado verde con check / pendiente gris), fecha y responsable de realización, observación registrada.<br>4. Modal `CompletarPasoModal.jsx`: textarea para ingresar la glosa de respaldo con validación client-side.<br>5. Integrar en `ProtocoloDetallePage.jsx`: ubicar el checklist entre los datos generales y el historial de estados.<br>6. El botón `"Avanzar Estado"` se deshabilita visualmente si hay pasos pendientes, con mensaje explicativo: *"Debe completar todos los pasos del checklist antes de cambiar de etapa"*. |
| **Criterios de Aceptación** | - El checklist carga los pasos dinámicamente al abrir la página.<br>- Al completar un paso en el modal, la lista y la barra de progreso se actualizan al instante sin recargar la página.<br>- Botón de avanzar estado bloqueado mientras falten pasos por cumplir.<br>- Diseño responsivo compatible con dispositivos móviles desde 360px. |

---

### Tareas de HU 5.2 (Alertas de Antecedentes y Escalada)

---

#### TAREA 5.2.1 — Motor Backend de Detección de Escalada y Reincidencia

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 5.2.1 Endpoint de análisis de antecedentes y escalada por estudiante |
| **Historia padre** | HU 5.2 – Alertas de Antecedentes y Detección de Escalada de Casos |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 4 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `algoritmo`, `alertas`, `escalada` |
| **Sprint** | Sprint 5 |
| **Descripción** | Diseñar la lógica analítica de detección de patrones críticos de convivencia para un estudiante específico.<br><br>**Subtareas:**<br>1. Crear método `getAntecedentesEscalada(tenantId, estudianteId)` en `dashboardService.js` (o `alertasService.js`).<br>2. **Regla de Reincidencia de Ámbito:** consultar incidentes del estudiante en los últimos 45 días agrupados por `tipo_abordaje_id`. Si cuenta $\ge 2$ del mismo tipo $\rightarrow$ activa flag `reincidencia_ambito`.<br>3. **Regla de Escalada de Gravedad:** analizar la cronología de incidentes del estudiante en los últimos 30 días. Si registra un incidente Leve seguido de uno Grave o Gravísimo en un intervalo $\le 15$ días $\rightarrow$ activa flag `escalada_gravedad`.<br>4. Endpoint `GET /api/v1/estudiantes/:id/antecedentes-escalada` protegido con `authenticateToken`.<br>5. Retorno estructurado: `{ tiene_alerta: boolean, nivel: 'advertencia' | 'critico', motivos: [...], total_incidentes_recientes: number, sugerencia_accion: string }`. |
| **Criterios de Aceptación** | - Estudiante sin incidentes o faltas aisladas retorna `tiene_alerta: false`.<br>- Estudiante con 2 incidentes de agresión en 30 días retorna alerta de reincidencia.<br>- Estudiante con salto Leve $\rightarrow$ Grave retorna alerta de escalada.<br>- Tiempo de respuesta inferior a 250ms. |

---

#### TAREA 5.2.2 — Componente Visual `AlertaEscaladaBanner.jsx` en Flujos RICE

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 5.2.2 Banners contextuales de advertencia en Nuevo y Detalle Protocolo |
| **Historia padre** | HU 5.2 – Alertas de Antecedentes y Detección de Escalada de Casos |
| **Asignado a** | Daniel Flores |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `alertas`, `componentes` |
| **Sprint** | Sprint 5 |
| **Descripción** | Construir el banner de advertencia preventiva e incrustarlo en los puntos clave de toma de decisiones de convivencia.<br><br>**Subtareas:**<br>1. Crear componente `AlertaEscaladaBanner.jsx` en `src/components/shared/` con diseño Tailwind estilizado (ícono de alerta, fondo ámbar o rojo suave, lista de motivos detectados y sugerencia formativa).<br>2. En `NuevoProtocoloPage.jsx`: al seleccionar un estudiante en el selector, invocar la API de antecedentes. Si `tiene_alerta: true`, renderizar el banner inmediatamente sobre el selector de tipo de protocolo.<br>3. En `ProtocoloDetallePage.jsx`: mostrar el banner en la cabecera superior junto a los datos del estudiante.<br>4. Botón desplegable *"Ver detalle de antecedentes"* que muestra las fechas y tipos de los incidentes que dispararon la alerta sin salir de la vista. |
| **Criterios de Aceptación** | - Al cambiar de estudiante en el formulario de creación, el banner se actualiza reactivamente.<br>- En el detalle de protocolo el banner permanece visible si el estudiante mantiene la condición de riesgo.<br>- Texto claro y constructivo orientado a la prevención pedagógica. |

---

### Tareas de HU 5.3 (Panel de Configuración de Umbrales)

---

#### TAREA 5.3.1 — Tabla `configuracion_tenant` y API de Parámetros y Plazos

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 5.3.1 DDL `configuracion_tenant` y endpoints de configuración |
| **Historia padre** | HU 5.3 – Panel de Administración y Configuración Dinámica de Parámetros |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 4 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `bd`, `configuracion`, `api` |
| **Sprint** | Sprint 5 |
| **Descripción** | Proveer la persistencia y los endpoints para desacoplar las constantes del código y permitir la configuración por tenant.<br><br>**Subtareas:**<br>1. Crear tabla en Supabase `configuracion_tenant` con RLS activo.<br>2. Endpoints: `GET /api/v1/configuracion`, `PUT /api/v1/configuracion` y `PUT /api/v1/configuracion/reglas/:id`.<br>3. Proteger rutas estrictamente con `requireRole('Administrador')`.<br>4. Modificar `getEstudiantesEnRiesgo()` y `calcular_acciones_pendientes()` para que lean los valores desde `configuracion_tenant` en lugar de constantes hardcodeadas. |
| **Criterios de Aceptación** | - Roles no Administradores reciben 403 Forbidden al intentar acceder o modificar.<br>- Actualizar el umbral a 8 modifica inmediatamente la cantidad de alumnos reportados en `/dashboard/estudiantes-en-riesgo`.<br>- Modificar un plazo en `reglas_protocolo` actualiza el cálculo de fechas límite futuras. |

---

#### TAREA 5.3.2 — Vista `ConfiguracionPage.jsx` y Navegación Administrativa

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 5.3.2 Vista Frontend de Configuración General y Editor de Plazos RICE |
| **Historia padre** | HU 5.3 – Panel de Administración y Configuración Dinámica de Parámetros |
| **Asignado a** | Daniel Flores |
| **Story Points** | 4 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `configuracion`, `admin` |
| **Sprint** | Sprint 5 |
| **Descripción** | Construir la interfaz de usuario para que el Administrador gestione los parámetros del colegio.<br><br>**Subtareas:**<br>1. Crear página `ConfiguracionPage.jsx` en `src/pages/`.<br>2. Sección 1 — **Parámetros del Motor de Alertas**: inputs numéricos para *Umbral de Riesgo* y *Ventana de Días de Análisis* con botones de guardar y tooltips de ayuda.<br>3. Sección 2 — **Matriz de Plazos Normativos RICE**: acordeón o selector con los 10 tipos de protocolo, mostrando la tabla de sus 4 acciones con inputs para editar los días de plazo.<br>4. Agregar enlace `"Configuración"` en el sidebar de navegación (`DashboardLayout.jsx`), visible únicamente para rol `Administrador`.<br>5. Proteger ruta en `AppRouter.jsx` con `<RoleRoute roles={['Administrador']}>`.<br>6. Notificaciones toast de éxito o error al guardar cambios. |
| **Criterios de Aceptación** | - La ruta `/configuracion` es accesible solo para Administrador.<br>- Los formularios validan que los plazos sean números enteros mayores a 0.<br>- Guardar cambios muestra feedback visual y persiste los nuevos datos tras recargar. |

---

### Tareas de HU 5.4 (PIE y Domicilio Familiar)

---

#### TAREA 5.4.1 — Migración DDL y API Estudiantes (PIE y Domicilios)

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 5.4.1 Migración DDL y soporte API para condición PIE y domicilios |
| **Historia padre** | HU 5.4 – Ficha Integral del Estudiante: Condición PIE y Domicilio Familiar |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 2 |
| **Prioridad** | Media |
| **Etiquetas** | `backend`, `bd`, `estudiantes`, `pie` |
| **Sprint** | Sprint 5 |
| **Descripción** | Agregar los nuevos campos al modelo relacional y actualizar los servicios de gestión e importación de estudiantes.<br><br>**Subtareas:**<br>1. Ejecutar DDL en PostgreSQL/Supabase:<br>```sql
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS es_pie BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE estudiantes ADD COLUMN IF NOT EXISTS direccion VARCHAR(255);
ALTER TABLE apoderados ADD COLUMN IF NOT EXISTS direccion VARCHAR(255);
```<br>2. Actualizar `estudiantesService.js`: incluir `es_pie` y `direccion` en `obtenerPerfil`, `crearEstudiante` y `actualizarEstudiante`.<br>3. Actualizar `importarEstudiantes`: reconocer columnas opcionales `pie` (valores `si`, `true`, `1`, `s`) y `direccion`/`domicilio` para el estudiante y apoderado.<br>4. Actualizar validaciones de esquema Zod en backend. |
| **Criterios de Aceptación** | - Columnas creadas en Supabase sin pérdida de registros existentes.<br>- `GET /estudiantes/:id/perfil` retorna `es_pie` (boolean) y `direccion` del estudiante y apoderado.<br>- Importador masivo procesa correctamente archivos que incluyan columna PIE y domicilio. |

---

#### TAREA 5.4.2 — Visualización de Condición PIE y Domicilios en UI

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 5.4.2 Badge PIE y domicilios en Perfil de Estudiante y plantilla CSV |
| **Historia padre** | HU 5.4 – Ficha Integral del Estudiante: Condición PIE y Domicilio Familiar |
| **Asignado a** | Daniel Flores |
| **Story Points** | 2 |
| **Prioridad** | Media |
| **Etiquetas** | `frontend`, `ui`, `estudiantes`, `perfil` |
| **Sprint** | Sprint 5 |
| **Descripción** | Presentar los nuevos datos en la interfaz de usuario con diseño claro e inclusivo.<br><br>**Subtareas:**<br>1. En `EstudiantePerfilPage.jsx`: mostrar un badge visual distintivo `PIE` (color morado suave/azul índigo `bg-purple-100 text-purple-800`) junto al nombre y RUT del estudiante si `es_pie === true`.<br>2. En `EstudiantePerfilPage.jsx`: agregar fila de `"Domicilio"` en la tarjeta de Datos del Estudiante y en la tarjeta de Apoderado con icono de ubicación.<br>3. Actualizar `ImportarEstudiantesModal.jsx`: agregar las columnas `pie` y `direccion` en la tabla de ejemplo de la plantilla y en la documentación del dropzone.<br>4. Actualizar plantilla descargable CSV para incluir las nuevas cabeceras de ejemplo. |
| **Criterios de Aceptación** | - Estudiante con `es_pie: true` muestra badge visible en su perfil.<br>- Domicilios del alumno y apoderado se visualizan correctamente con formato limpio.<br>- Plantilla de importación CSV descargable actualizada y funcional. |

---

### Tareas de HU 5.5 (Períodos Académicos y Selector en Cascada)

---

#### TAREA 5.5.1 — Tabla `periodos_academicos`, estructura `cursos` y API en Cascada

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 5.5.1 DDL periodos_academicos, cursos (letra/periodo) y endpoints en cascada |
| **Historia padre** | HU 5.5 – Períodos Académicos y Selector en Cascada (Nivel -> Letra -> Alumno) |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `bd`, `cursos`, `periodos`, `api` |
| **Sprint** | Sprint 5 |
| **Descripción** | Diseñar la estructura de períodos académicos y enriquecer la tabla de cursos para permitir la navegación jerárquica.<br><br>**Subtareas:**<br>1. Ejecutar DDL en Supabase:<br>```sql
CREATE TABLE IF NOT EXISTS periodos_academicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    anio INT NOT NULL,
    fecha_inicio DATE,
    fecha_fin DATE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_periodo_tenant UNIQUE (tenant_id, anio)
);
ALTER TABLE periodos_academicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_periodos ON periodos_academicos
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

ALTER TABLE cursos ADD COLUMN IF NOT EXISTS periodo_id UUID REFERENCES periodos_academicos(id) ON DELETE RESTRICT;
ALTER TABLE cursos ADD COLUMN IF NOT EXISTS letra VARCHAR(5);
```<br>2. Migración de datos: crear período 2026 y asociar los cursos actuales extrayendo la letra del nombre (ej: "1° Básico A" $\rightarrow$ nivel: "1° Básico", letra: "A").<br>3. Endpoints en `cursosController.js` y `cursosService.js`:<br>   - `GET /api/v1/cursos/niveles`: retorna lista de niveles disponibles en el período activo (ej: `["1° Básico", "2° Básico", ...]`).<br>   - `GET /api/v1/cursos/letras?nivel=X`: retorna las letras disponibles para ese nivel (ej: `["A", "B"]`) junto con el `curso_id`.<br>   - `GET /api/v1/cursos/:id/estudiantes`: retorna la nómina alfabética de alumnos matriculados en ese curso exacto (`id`, `nombre`, `apellido`, `rut`, `es_pie`). |
| **Criterios de Aceptación** | - Tabla `periodos_academicos` creada con RLS verificado.<br>- Cursos existentes asociados al período 2026 sin duplicados.<br>- Endpoint de niveles retorna lista ordenada sin duplicados.<br>- Endpoint de letras filtra exactamente por el nivel consultado.<br>- Endpoint de estudiantes del curso retorna la nómina en menos de 100ms. |

---

#### TAREA 5.5.2 — Componente `SelectorEstudianteCascada.jsx` en Incidentes y Protocolos

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 5.5.2 Selector en cascada (Nivel -> Letra -> Alumno) en Incidentes y Protocolos |
| **Historia padre** | HU 5.5 – Períodos Académicos y Selector en Cascada (Nivel -> Letra -> Alumno) |
| **Asignado a** | Daniel Flores |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `componentes`, `cascada` |
| **Sprint** | Sprint 5 |
| **Descripción** | Construir el flujo de selección jerárquica de estudiantes para evitar errores de digitación.<br><br>**Subtareas:**<br>1. Crear componente `SelectorEstudianteCascada.jsx` en `src/components/shared/`.<br>2. **Paso 1:** Renderizar selector desplegable de **Nivel** (poblado desde `GET /cursos/niveles`).<br>3. **Paso 2:** Al seleccionar nivel, desplegar inmediatamente selector de **Letra** (`GET /cursos/letras?nivel=...`).<br>4. **Paso 3:** Al seleccionar letra, desplegar la lista plegable de alumnos de ese curso, mostrando nombre completo, RUT y badge si es PIE.<br>5. Integrar en `NuevoIncidentePage.jsx`: permitir seleccionar uno o múltiples alumnos para agregarlos a la lista de involucrados (definiendo si es víctima, agresor o testigo).<br>6. Integrar en `NuevoProtocoloPage.jsx`: vincular al estudiante del protocolo mediante este flujo en cascada.<br>7. Mantener un botón de alternancia rápida "Búsqueda directa por RUT/Nombre" por si el usuario ya conoce el RUT del alumno. |
| **Criterios de Aceptación** | - El input de letra permanece oculto o deshabilitado hasta que se elige un nivel.<br>- La lista de alumnos se carga al instante tras elegir la letra.<br>- Al seleccionar al alumno se transfiere correctamente su `id` al formulario padre.<br>- Funciona con fluidez en pantallas móviles (360px) y desktop. |

---

## PASO 4 — Ordenar el Sprint 5 en el Backlog

Para evitar bloqueos y permitir el desarrollo paralelo eficiente entre backend y frontend:

| Orden | Tarea | Responsable | Razón de la Secuencia |
| :---: | :--- | :---: | :--- |
| **1°** | **5.1.1** — Tabla `protocolo_pasos` | Marcelo | Base de datos para el checklist normativo. |
| **2°** | **5.3.1** — Tabla `configuracion_tenant` y API | Marcelo | Persistencia de parámetros configurables. |
| **3°** | **5.4.1** — Migración PIE y Domicilio en BD y API | Marcelo | Campos adicionales sin impacto en lógica de estados. |
| **4°** | **5.5.1** — `periodos_academicos`, `cursos` y API cascada | Marcelo | Estructura para la navegación curricular y filtros. |
| **5°** | **5.1.2** — API gestión de pasos y validación de cierre | Marcelo | Lógica de bloqueo estricto en backend. |
| **6°** | **5.2.1** — Motor backend de detección de escalada | Marcelo | Algoritmo de reincidencia y antecedentes. |
| **7°** | **5.1.3** — UI Checklist en `ProtocoloDetallePage` | Daniel | Consume los endpoints de pasos normativos. |
| **8°** | **5.2.2** — Banners `AlertaEscaladaBanner.jsx` | Daniel | Consume la API de antecedentes de escalada. |
| **9°** | **5.3.2** — Vista `ConfiguracionPage.jsx` | Daniel | Pantalla de ajustes para el Administrador. |
| **10°** | **5.4.2** — UI Perfil PIE y Domicilios | Daniel | Presentación visual de datos inclusivos y residencia. |
| **11°** | **5.5.2** — UI `SelectorEstudianteCascada.jsx` | Daniel | Flujo de selección Nivel $\rightarrow$ Letra $\rightarrow$ Alumnos en formularios. |

---

## PASO 5 — Iniciar el Sprint 5

1. Ir a **Backlog** en Jira.
2. Comprobar que las 11 tareas estén asignadas a las 5 historias y estimadas con sus Story Points correspondientes.
3. Clic en **Iniciar sprint** en el bloque del Sprint 5.
4. Confirmar las fechas y el objetivo del sprint.
5. Clic en **Iniciar**.

---

## 📊 Resumen de Puntos y Capacidad

| Desarrollador | Tareas Asignadas | Puntos Sprint 5 | % Carga |
|---------------|------------------|:---------------:|:-------:|
| **Marcelo Acevedo** (Backend/PM) | 5.1.1, 5.1.2, 5.2.1, 5.3.1, 5.4.1, 5.5.1 | **20 pts** | 55.6% |
| **Daniel Flores** (Frontend/UI) | 5.1.3, 5.2.2, 5.3.2, 5.4.2, 5.5.2 | **16 pts** | 44.4% |
| **Total Sprint 5** | **11 Tareas (5 Historias)** | **36 pts** | **100%** |

---

## 🛡️ Definición de Terminado (DoD) — Sprint 5

Para dar por cerrada cada tarea e historia en Jira, se debe certificar:

- [ ] Tablas `protocolo_pasos`, `configuracion_tenant` y `periodos_academicos` creadas y verificadas en Supabase con RLS activo.
- [ ] Columnas `es_pie`, `direccion` (en `estudiantes` y `apoderados`), `periodo_id` y `letra` (en `cursos`) migradas exitosamente sin pérdida de datos.
- [ ] Al abrir un protocolo se inicializan siempre sus 4 pasos normativos correspondientes.
- [ ] No es posible cambiar el estado de un protocolo a `Derivado` o `Cerrado` si tiene pasos sin completar (retorna 400 y mensaje explicativo).
- [ ] Cada paso completado tiene responsable, fecha exacta y observación de respaldo almacenada.
- [ ] La alerta de antecedentes detecta correctamente casos con $\ge 2$ incidentes similares o saltos de Leve a Grave.
- [ ] Banner de escalada visible y funcional en `NuevoProtocoloPage` y en `ProtocoloDetallePage`.
- [ ] Ruta `/configuracion` inaccesible para Docentes, Inspectores y Directivos (403 verificado).
- [ ] Modificar umbrales en el panel de configuración altera en tiempo real los resultados de riesgo del Dashboard.
- [ ] Perfil del estudiante muestra correctamente el badge PIE y los domicilios del alumno y apoderado.
- [ ] El selector en cascada despliega secuencialmente Nivel $\rightarrow$ Letra $\rightarrow$ Lista de alumnos del curso en `NuevoIncidentePage` y `NuevoProtocoloPage`.
- [ ] Importador masivo CSV/Excel procesa exitosamente columnas de PIE y domicilio sin romper nóminas estándar.
- [ ] Cero regresiones en la suite de pruebas unitarias (`npm test` y `vitest`) y build de producción limpio (`npm run build`).
