# SIGA Escolar — Guía Completa: Crear Sprint 4 Manualmente en Jira

> **Capacidad comprometida:** 26 puntos (Marcelo 16 pts + Daniel 10 pts)
> **Duración:** 7 días (continúa tras el Sprint 3)
> **Objetivo:** Implementar el motor de reglas y alertas tempranas — que el equipo de convivencia entre al sistema cada mañana y sepa exactamente qué casos requieren acción, en qué orden y con qué urgencia, sin buscar nada manualmente.

---

## PASO 0 — Crear el Sprint 4

1. Ir a **Backlog** del proyecto SIGA-escolar
2. Clic en **Crear sprint**
3. Completar:

| Campo | Valor |
|-------|-------|
| **Nombre** | Sprint 4 |
| **Fecha inicio** | _(día siguiente al cierre del Sprint 3)_ |
| **Fecha fin** | _(+7 días)_ |
| **Objetivo** | Implementar la tabla de reglas de protocolo, el scoring de riesgo por estudiante y los endpoints de acciones pendientes, más los widgets de semáforo en el Dashboard y badge de riesgo en el perfil del estudiante |

---

## PASO 1 — Crear la Épica

| Campo | Valor |
|-------|-------|
| **Tipo** | Epic |
| **Resumen** | Motor de Reglas y Alertas Tempranas |
| **Descripción** | Implementar un sistema determinístico de scoring y alertas de plazo que procese los datos ya existentes en SIGA para informar al equipo de convivencia sobre qué casos requieren acción inmediata. No requiere API externa — 100% implementado en PostgreSQL y Node.js con los datos actuales. Esta épica abarca los Sprints 4 y 5. |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `alertas`, `ia` |
| **Sprint** | Sprint 4 |

✅ Guardar y anotar el ID generado (ej. `SIGA-30`)

---

## PASO 2 — Crear las Historias de Usuario

---

### HISTORIA 1: HU 4.1 – Reglas de Protocolo y Plazos Normativos

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 4.1 – Reglas de Protocolo y Plazos Normativos |
| **Épica** | Motor de Reglas y Alertas Tempranas |
| **Descripción** | **Como** coordinador de convivencia, **quiero** que el sistema calcule automáticamente qué acción está pendiente en cada protocolo abierto y cuánto tiempo queda para realizarla **para** no depender de la memoria del equipo ni de seguimiento manual en papel o WhatsApp. |
| **Criterios de Aceptación** | - Tabla `reglas_protocolo` creada con RLS activo por tenant. - Cada tipo de protocolo tiene al menos 4 acciones con sus plazos en días. - El endpoint retorna los protocolos abiertos ordenados por urgencia con semáforo (vencido / urgente / ok). - Los plazos son editables por el administrador del tenant sin intervención del equipo de desarrollo. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `bd`, `protocolos`, `plazos` |
| **Sprint** | Sprint 4 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-31`)

---

### HISTORIA 2: HU 4.2 – Score de Riesgo de Escalada por Estudiante

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 4.2 – Score de Riesgo de Escalada por Estudiante |
| **Épica** | Motor de Reglas y Alertas Tempranas |
| **Descripción** | **Como** coordinador de convivencia o docente, **quiero** ver una alerta en el perfil de los estudiantes que acumulan múltiples incidentes recientes **para** intervenir a tiempo antes de que una situación menor escale a acoso escolar u otra falta grave. |
| **Criterios de Aceptación** | - El sistema calcula un score de riesgo usando frecuencia y gravedad de incidentes de los últimos 30 días. - Estudiantes con score ≥ 6 muestran badge de alerta en su perfil. - El badge es visible para todos los roles. - El endpoint retorna la lista ordenada de mayor a menor score. - El umbral de activación (6 por defecto) es configurable por el administrador. |
| **Asignado a** | Marcelo Acevedo |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `frontend`, `riesgo`, `alertas` |
| **Sprint** | Sprint 4 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-32`)

---

### HISTORIA 3: HU 4.3 – Widgets de Alerta en Dashboard y Perfil

| Campo | Valor |
|-------|-------|
| **Tipo** | Historia |
| **Resumen** | HU 4.3 – Widgets de Alerta en Dashboard y Perfil |
| **Épica** | Motor de Reglas y Alertas Tempranas |
| **Descripción** | **Como** coordinador de convivencia, **quiero** ver al ingresar al sistema un resumen priorizado de los casos con acciones pendientes y a los estudiantes en riesgo **para** organizar mi jornada en menos de 30 segundos sin tener que revisar cada protocolo individualmente. |
| **Criterios de Aceptación** | - Widget de acciones pendientes visible en el Dashboard existente con semáforo de colores. - Cada fila del widget es clickeable y navega al detalle del protocolo. - Badge de riesgo visible en `EstudiantePerfilPage` cuando el score supera el umbral. - Ambos widgets se cargan junto al Dashboard actual sin degradar el tiempo de carga. |
| **Asignado a** | Daniel Flores |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `dashboard`, `alertas` |
| **Sprint** | Sprint 4 |
| **Estado inicial** | POR HACER |

✅ Guardar y anotar el ID (ej. `SIGA-33`)

---

## PASO 3 — Crear las Tareas

---

## Tareas de HU 4.1 (Reglas y Plazos)

---

### TAREA 4.1.1 — Nueva tabla `reglas_protocolo` en Supabase

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 4.1.1 Nueva tabla `reglas_protocolo` con RLS |
| **Historia padre** | HU 4.1 – Reglas de Protocolo y Plazos Normativos |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 2 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `bd`, `supabase` |
| **Sprint** | Sprint 4 |
| **Descripción** | Crear la tabla que almacena los plazos y acciones para cada tipo de protocolo RICE. **Subtareas:** (1) Ejecutar en Supabase SQL Editor: `CREATE TABLE reglas_protocolo (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), tipo_protocolo_id uuid NOT NULL REFERENCES tipos_protocolo(id), orden smallint NOT NULL, accion text NOT NULL, plazo_dias smallint NOT NULL, prorrogable boolean DEFAULT true, activo boolean DEFAULT true, created_at timestamptz DEFAULT now(), UNIQUE (tenant_id, tipo_protocolo_id, orden))`. (2) Activar RLS: `ALTER TABLE reglas_protocolo ENABLE ROW LEVEL SECURITY`. (3) Crear política: `CREATE POLICY tenant_isolation ON reglas_protocolo USING (tenant_id = current_setting('app.tenant_id')::uuid)`. (4) Agregar campo a `protocolos_rice`: `ALTER TABLE protocolos_rice ADD COLUMN IF NOT EXISTS fecha_ultimo_avance timestamptz DEFAULT now()`. (5) Actualizar `protocolosService.js`: al ejecutar `PATCH /:id/estado`, incluir `fecha_ultimo_avance: new Date().toISOString()` en el update. |
| **Criterios de Aceptación** | - Tabla visible en Supabase con estructura correcta. - RLS activo: verificar que `SELECT * FROM reglas_protocolo` sin contexto de tenant no retorna filas. - Campo `fecha_ultimo_avance` presente en `protocolos_rice`. - Al cambiar estado de un protocolo, `fecha_ultimo_avance` se actualiza en Supabase. |

✅ Guardar

---

### TAREA 4.1.2 — Seed de reglas de protocolo por defecto

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 4.1.2 Seed de reglas base para los 10 tipos de protocolo |
| **Historia padre** | HU 4.1 – Reglas de Protocolo y Plazos Normativos |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 3 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `bd`, `seed` |
| **Sprint** | Sprint 4 |
| **Descripción** | Crear el script que carga las reglas de plazo por defecto para todos los tipos de protocolo. Las reglas se basan en los plazos reales indicados por el cliente (5 a 10 días, prorrogables una vez por Dirección). **Subtareas:** (1) Crear `src/utils/seedReglas.js`. (2) El script recupera todos los `tipos_protocolo` existentes del tenant y para cada uno inserta las siguientes 4 reglas: Orden 1 — "Entrevista inicial con las partes involucradas", plazo 2 días, prorrogable false. Orden 2 — "Citación y reunión con apoderados", plazo 5 días, prorrogable true. Orden 3 — "Informe de situación a Dirección", plazo 7 días, prorrogable true. Orden 4 — "Cierre, derivación externa o solicitud de prórroga", plazo 10 días, prorrogable true. (3) Usar upsert para que el script sea idempotente (se pueda correr más de una vez sin duplicar). (4) Agregar el script a `package.json`: `"seed:reglas": "node src/utils/seedReglas.js"`. |
| **Criterios de Aceptación** | - `npm run seed:reglas` ejecuta sin errores. - Supabase muestra 4 reglas × 10 tipos = 40 filas en `reglas_protocolo`. - Ejecutar el script una segunda vez no genera duplicados. - Los plazos en días son correctos según el orden definido. |

✅ Guardar

---

### TAREA 4.1.3 — Función SQL y endpoint `GET /dashboard/acciones-pendientes`

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 4.1.3 Función SQL + endpoint acciones-pendientes |
| **Historia padre** | HU 4.1 – Reglas de Protocolo y Plazos Normativos |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 5 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `bd`, `dashboard` |
| **Sprint** | Sprint 4 |
| **Descripción** | Crear la función PostgreSQL que calcula el estado de cada protocolo abierto contra los plazos configurados, y el endpoint que la expone. **Subtareas:** (1) Crear función RPC en Supabase: `CREATE OR REPLACE FUNCTION calcular_acciones_pendientes() RETURNS TABLE (protocolo_id uuid, estudiante_nombre text, tipo_protocolo text, accion_pendiente text, fecha_limite date, dias_restantes int, estado_semaforo text) AS $$ BEGIN RETURN QUERY SELECT p.id, e.nombre || ' ' || e.apellido, tp.nombre, r.accion, (p.fecha_apertura + (r.plazo_dias || ' days')::interval)::date, EXTRACT(DAY FROM (p.fecha_apertura + (r.plazo_dias || ' days')::interval) - NOW())::int, CASE WHEN (p.fecha_apertura + (r.plazo_dias || ' days')::interval) < NOW() THEN 'vencido' WHEN (p.fecha_apertura + (r.plazo_dias || ' days')::interval) < NOW() + INTERVAL '2 days' THEN 'urgente' ELSE 'ok' END FROM protocolos_rice p JOIN tipos_protocolo tp ON tp.id = p.tipo_protocolo_id JOIN reglas_protocolo r ON r.tipo_protocolo_id = p.tipo_protocolo_id JOIN incidente_estudiantes ie ON ie.incidente_id = p.incidente_id JOIN estudiantes e ON e.id = ie.estudiante_id WHERE p.estado != 'Cerrado' AND p.tenant_id = current_setting('app.tenant_id')::uuid ORDER BY dias_restantes ASC; END; $$ LANGUAGE plpgsql SECURITY DEFINER`. (2) Crear método `getAccionesPendientes()` en `dashboardService.js` llamando a `supabase.rpc('calcular_acciones_pendientes')`. (3) Crear handler `accionesPendientes` en `dashboardController.js`. (4) Agregar ruta en `dashboard.routes.js`: `GET /acciones-pendientes` con `requireRole('Administrador', 'Equipo de Formación', 'Directivo')`. |
| **Criterios de Aceptación** | - Endpoint retorna array con campos: `protocolo_id`, `estudiante_nombre`, `tipo_protocolo`, `accion_pendiente`, `fecha_limite`, `dias_restantes`, `estado_semaforo`. - Semáforo correcto: protocolo con plazo vencido → `"vencido"`, vence en ≤ 2 días → `"urgente"`, resto → `"ok"`. - Lista ordenada de menor a mayor `dias_restantes` (los urgentes primero). - Protocolos cerrados no aparecen en la lista. - Rol Docente o Inspector → 403. - Prueba en Insomnia con al menos 3 protocolos en distintos estados de plazo. |

✅ Guardar

---

## Tareas de HU 4.2 (Score de Riesgo)

---

### TAREA 4.2.1 — Endpoint `GET /dashboard/estudiantes-en-riesgo`

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 4.2.1 Endpoint scoring de riesgo por estudiante |
| **Historia padre** | HU 4.2 – Score de Riesgo de Escalada por Estudiante |
| **Asignado a** | Marcelo Acevedo |
| **Story Points** | 4 |
| **Prioridad** | Alta |
| **Etiquetas** | `backend`, `riesgo`, `dashboard` |
| **Sprint** | Sprint 4 |
| **Descripción** | Desarrollar el endpoint que calcula y retorna los estudiantes cuyo comportamiento reciente supera el umbral de riesgo. **Fórmula de scoring:** `score = (incidentes últimos 30 días × 2) + (incidentes Grave × 3) + (incidentes Gravísima × 5)`. Umbral de activación: score ≥ 6. **Subtareas:** (1) Crear método `getEstudiantesEnRiesgo()` en `dashboardService.js`. El método consulta `estudiantes` con join a `incidente_estudiantes` e `incidentes`, filtra incidentes de los últimos 30 días, aplica el scoring en JavaScript y filtra los que superan el umbral. (2) Retornar por estudiante: `id`, `nombre`, `apellido`, `rut`, `curso`, `score_riesgo`, `total_incidentes_30d`, `total_graves`. (3) Crear handler `estudiantesEnRiesgo` en `dashboardController.js`. (4) Agregar ruta en `dashboard.routes.js`: `GET /estudiantes-en-riesgo` accesible para todos los roles autenticados (confirmado por el cliente). (5) El umbral 6 debe estar en una constante configurable en `dashboardService.js`, no hardcodeado en la lógica. |
| **Criterios de Aceptación** | - Endpoint retorna solo estudiantes con `score_riesgo >= 6`, ordenados de mayor a menor score. - Estudiante con 2 incidentes Grave en los últimos 30 días obtiene score = 10 (2×2 + 2×3) y aparece en la lista. - Estudiante con 1 incidente Leve en 30 días obtiene score = 2 y NO aparece. - Todos los roles autenticados pueden acceder (no retorna 403 para Docente ni Inspector). - Prueba en Insomnia con al menos 3 estudiantes: 1 que supera umbral, 1 que no, 1 en el límite. |

✅ Guardar

---

## Tareas de HU 4.3 (Widgets Frontend)

---

### TAREA 4.3.1 — Widget "Acciones Pendientes" en Dashboard

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 4.3.1 Widget acciones pendientes con semáforo en Dashboard |
| **Historia padre** | HU 4.3 – Widgets de Alerta en Dashboard y Perfil |
| **Asignado a** | Daniel Flores |
| **Story Points** | 5 |
| **Prioridad** | Alta |
| **Etiquetas** | `frontend`, `ui`, `dashboard` |
| **Sprint** | Sprint 4 |
| **Descripción** | Construir el widget de acciones pendientes que aparece en la pantalla principal del Dashboard. **Subtareas:** (1) Crear componente `AccionesPendientesWidget.jsx` en `src/components/dashboard/`. (2) Agregar `getAccionesPendientes()` al `dashboardService.js` del frontend. (3) Incluir la llamada en el `Promise.all` existente de `DashboardPage.jsx` para no agregar tiempo de carga. (4) Cada fila del widget muestra: indicador de color (rojo / amarillo / verde), nombre del estudiante, tipo de protocolo, acción pendiente, días restantes o "VENCIDO". (5) Colores de semáforo: `vencido` → fondo rojo claro `bg-red-50` con texto rojo. `urgente` → fondo amarillo `bg-amber-50` con texto ámbar. `ok` → fondo verde claro `bg-green-50` con texto verde. (6) Máximo 5 filas visibles. Si hay más, mostrar enlace "Ver todos los protocolos" que navega a `/protocolos`. (7) Cada fila es clickeable y navega a `/protocolos/:id`. (8) Si no hay acciones pendientes: mostrar mensaje "Sin acciones pendientes — todo al día ✓". (9) Visible solo para roles Administrador, Equipo de Formación y Directivo (mismos que el endpoint). |
| **Criterios de Aceptación** | - Widget visible en Dashboard al iniciar sesión. - Semáforo muestra el color correcto según `estado_semaforo` recibido del endpoint. - Clic en cualquier fila navega al detalle del protocolo correcto. - Si no hay protocolos abiertos el widget muestra el mensaje de "todo al día". - No degrada el tiempo de carga del Dashboard (carga en paralelo con los otros 4 endpoints). - Vista responsiva desde 360px. |

✅ Guardar

---

### TAREA 4.3.2 — Badge de riesgo en perfil del estudiante

| Campo | Valor |
|-------|-------|
| **Tipo** | Tarea |
| **Resumen** | 4.3.2 Badge de alerta de riesgo en EstudiantePerfilPage |
| **Historia padre** | HU 4.3 – Widgets de Alerta en Dashboard y Perfil |
| **Asignado a** | Daniel Flores |
| **Story Points** | 2 |
| **Prioridad** | Media |
| **Etiquetas** | `frontend`, `ui`, `riesgo` |
| **Sprint** | Sprint 4 |
| **Descripción** | Mostrar una alerta contextual en el perfil del estudiante cuando su score de riesgo supera el umbral. **Subtareas:** (1) En `EstudiantePerfilPage.jsx`, agregar llamada a `GET /dashboard/estudiantes-en-riesgo` al cargar el perfil (o consultar si el `id` del estudiante está en la lista devuelta). (2) Si el estudiante está en la lista mostrar el banner de alerta: `⚠️ Este estudiante acumula múltiples incidentes recientes. Evalúe si corresponde activar o escalar el protocolo vigente.` con estilo `bg-amber-50 border border-amber-200 text-amber-800`. (3) El banner debe aparecer debajo del encabezado del perfil, antes del detalle de datos personales. (4) Visible para todos los roles autenticados (confirmado por el cliente). |
| **Criterios de Aceptación** | - Banner aparece en el perfil de estudiantes con score ≥ 6. - Banner no aparece en perfiles de estudiantes sin incidentes recientes o con score bajo el umbral. - Banner no interfiere con la navegación ni el botón de PDF. - El texto es claro y no alarmista — describe la situación sin calificar al estudiante. |

✅ Guardar

---

## PASO 4 — Ordenar el Sprint 4 en el Backlog

1. Ir a **Backlog**
2. Arrastrar al Sprint 4 todas las tareas en este orden de prioridad:

| Orden | Tarea | Razón |
|-------|-------|-------|
| 1° | **4.1.1** — Tabla `reglas_protocolo` | Desbloquea todas las demás |
| 2° | **4.1.2** — Seed de reglas base | Necesario para probar el endpoint |
| 3° | **4.1.3** — Función SQL + endpoint acciones-pendientes | Núcleo del sprint |
| 4° | **4.2.1** — Endpoint estudiantes-en-riesgo | Independiente, puede ir en paralelo con 4.1.3 |
| 5° | **4.3.1** — Widget Dashboard (Daniel) | Depende de que 4.1.3 esté completo |
| 6° | **4.3.2** — Badge perfil (Daniel) | Depende de que 4.2.1 esté completo |

---

## PASO 5 — Iniciar el Sprint 4

1. Ir a **Backlog**
2. Clic en **Iniciar sprint** en el bloque del Sprint 4
3. Confirmar fechas
4. Confirmar objetivo del sprint
5. Clic en **Iniciar**

---

## Resumen de puntos por persona

| Desarrollador | Tareas | Puntos Sprint 4 |
|---------------|--------|-----------------|
| Marcelo Acevedo | 4.1.1, 4.1.2, 4.1.3, 4.2.1 | 14 pts |
| Daniel Flores | 4.3.1, 4.3.2 | 7 pts |
| **Total comprometido** | **6 tareas** | **21 pts** |

---

## Definición de Terminado (DoD) — Sprint 4

Aplica a todas las tareas, además del DoD de los sprints anteriores:

- [ ] Tabla `reglas_protocolo` con RLS activo y seed ejecutado sin errores
- [ ] Función SQL `calcular_acciones_pendientes()` probada directamente en Supabase SQL Editor antes de integrar
- [ ] Endpoints probados en Insomnia: happy path + mínimo 2 casos de error por endpoint
- [ ] Semáforo validado con protocolos en los 3 estados (vencido, urgente, ok)
- [ ] Score de riesgo validado con al menos 3 estudiantes de prueba distintos
- [ ] Widgets visibles en Dashboard y en perfil de estudiante en ambiente local
- [ ] No hay regresiones en los módulos existentes (incidentes, protocolos, dashboard)