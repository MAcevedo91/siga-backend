# SIGA Escolar — Definition of Done y Plan de Pruebas UAT

**Proyecto:** Sistema de Gestión y Acompañamiento Escolar (SIGA Escolar)
**Cliente:** Escuela Coeducacional N°1 El Salvador
**Equipo:** Marcelo Acevedo Silva (Backend/PM) | Daniel Flores Jaime (Frontend/UI)

---

## 1. Definition of Done (DoD)

El DoD es el conjunto de criterios que **toda tarea debe cumplir** antes de ser marcada como LISTO en Jira. Su propósito es garantizar calidad uniforme en todas las entregas del equipo.

### 1.1 DoD a nivel de Tarea

Una tarea se considera **Done** cuando cumple TODOS los siguientes criterios:

#### Código
- [ ] Código committeado en rama `develop` con mensaje descriptivo siguiendo convención (`feat:`, `fix:`, `chore:`, `docs:`)
- [ ] Pull Request creado y aprobado por el otro miembro del equipo antes del merge
- [ ] Sin errores en consola del servidor ni warnings críticos en el frontend
- [ ] Variables sensibles en `.env` — nunca hardcodeadas ni en el repositorio
- [ ] Sin `console.log` de debug en el código productivo

#### Seguridad
- [ ] Ningún endpoint retorna el campo `password` de usuarios
- [ ] Rutas privadas protegidas con `authenticateToken` y `requireRole` según la matriz de permisos
- [ ] Validación de datos de entrada con Zod en todos los endpoints que reciben body

#### Base de datos
- [ ] Operaciones que afectan más de una tabla usan transacciones o rollback manual
- [ ] `tenant_id` presente en todas las queries — aislamiento multi-tenant verificado

#### Pruebas manuales
- [ ] Happy path verificado manualmente en Insomnia/Postman
- [ ] Al menos 2 casos de error verificados por endpoint (campo faltante, rol incorrecto, recurso inexistente)
- [ ] Colección Insomnia actualizada con los nuevos endpoints

---

### 1.2 DoD a nivel de Historia de Usuario

Una historia se considera **Done** cuando:
- [ ] Todas sus tareas hijas están en estado LISTO
- [ ] Los criterios de aceptación de la historia están verificados de forma integrada (frontend + backend funcionando juntos)
- [ ] La funcionalidad es accesible y operable desde la URL de producción

---

### 1.3 DoD a nivel de Sprint

Un sprint se considera **Done** cuando:
- [ ] Todas las historias comprometidas en el sprint están en estado LISTO
- [ ] El código de `develop` fue mergeado a `main`
- [ ] El deploy en Render y Vercel refleja los últimos cambios
- [ ] La aplicación en producción responde sin errores en el flujo E2E principal
- [ ] Se realizó la retrospectiva del sprint

---

### 1.4 DoD adicional — Sprint 3 (Entrega Final)

Para el sprint final se agregan estos criterios:
- [ ] Ambas URLs de producción accesibles con HTTPS sin advertencias de seguridad
- [ ] Dashboard carga en menos de 3 segundos en producción (RNF-07)
- [ ] PDF generado correctamente con membrete y espacios de firma
- [ ] Datos reales del establecimiento cargados en producción
- [ ] Pruebas UAT ejecutadas y aprobadas por el cliente
- [ ] Acta de conformidad firmada
- [ ] Documentación técnica de cierre entregada

---

## 2. Plan de Pruebas UAT

Las pruebas UAT (User Acceptance Testing) son pruebas de **caja negra** realizadas por el cliente — en este caso el Coordinador de Convivencia de la Escuela El Salvador — para validar que el sistema cumple con los requerimientos antes de la entrega formal.

### 2.1 Ambiente de pruebas

| Elemento | Valor |
|----------|-------|
| **URL Frontend** | https://siga-frontend-delta-six.vercel.app |
| **URL Backend** | https://siga-backend.onrender.com |
| **Fecha planificada UAT** | 2 julio 2026 |
| **Responsable de coordinar** | Marcelo Acevedo |
| **Participantes** | Coordinador de Convivencia + equipo de desarrollo |

---

### 2.2 Casos de prueba UAT

---

#### CU-01: Autenticación y control de acceso

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Verificar que cada rol accede solo a las funciones que le corresponden |
| **Precondición** | Usuarios creados con todos los roles del establecimiento |
| **Pasos** | 1. Ingresar con credenciales de Administrador → verificar acceso a Usuarios. 2. Ingresar con credenciales de Inspector → verificar que NO ve el módulo Usuarios. 3. Ingresar con credenciales de Docente → verificar que NO puede crear incidentes. 4. Intentar acceder a `/usuarios` con rol Inspector → debe redirigir a "No autorizado". |
| **Resultado esperado** | Cada rol ve y puede hacer exactamente lo que le corresponde según la matriz de permisos |
| **Criterio de aprobación** | ✅ Aprobado si ningún rol accede a funciones que no le corresponden |

---

#### CU-02: Búsqueda y perfil de estudiante

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Verificar que el coordinador puede encontrar a cualquier estudiante del establecimiento |
| **Precondición** | Los 483 estudiantes están cargados en producción |
| **Pasos** | 1. Ir a módulo Estudiantes. 2. Buscar un estudiante por nombre sin tilde (ej: "perez"). 3. Verificar que aparece en los resultados. 4. Hacer clic en el estudiante → verificar que carga su perfil con datos personales y curso. 5. Si tiene incidentes, verificar que aparecen en el historial cronológico. |
| **Resultado esperado** | El buscador encuentra al estudiante sin importar tildes. El perfil muestra todos sus datos. |
| **Criterio de aprobación** | ✅ Aprobado si el buscador funciona correctamente y el perfil carga completo |

---

#### CU-03: Registro de incidente con notificación

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Verificar el flujo completo de registro de un incidente grave |
| **Precondición** | Usuario Inspector autenticado |
| **Pasos** | 1. Ir a Incidentes → Registrar Nuevo Incidente. 2. Seleccionar tipo de abordaje, fecha, gravedad **Gravísima**. 3. Buscar y agregar al menos un estudiante involucrado. 4. Escribir un relato de mínimo 20 caracteres. 5. Ingresar medidas adoptadas. 6. Guardar el incidente. 7. Verificar que aparece alerta visual de incidente gravísimo. 8. Verificar que el coordinador/administrador recibió la notificación. |
| **Resultado esperado** | El incidente queda registrado. La alerta visual aparece. La notificación queda en la BD. |
| **Criterio de aprobación** | ✅ Aprobado si el incidente se guarda y la notificación se genera automáticamente |

---

#### CU-04: Trazabilidad de estados del incidente

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Verificar que el flujo de estados funciona correctamente |
| **Precondición** | Incidente creado en estado "En Investigación" |
| **Pasos** | 1. Ir al detalle del incidente creado en CU-03. 2. Cambiar estado a **Derivado**. 3. Verificar que el estado se actualiza en la vista. 4. Intentar volver el estado a "En Investigación" → debe mostrar error. 5. Cambiar estado a **Cerrado**. 6. Verificar que el estado queda como Cerrado. |
| **Resultado esperado** | Los estados avanzan correctamente. No se puede retroceder un estado. |
| **Criterio de aprobación** | ✅ Aprobado si la trazabilidad de estados funciona sin permitir retrocesos |

---

#### CU-05: Apertura y seguimiento de protocolo RICE

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Verificar el flujo completo de un protocolo normativo |
| **Precondición** | Incidente registrado. Usuario Coordinador autenticado. |
| **Pasos** | 1. Ir a Protocolos → Nuevo Protocolo. 2. Seleccionar tipo de protocolo (ej: Maltrato entre estudiantes). 3. Buscar y seleccionar el estudiante del CU-03. 4. Vincular al incidente creado en CU-03. 5. Ingresar fecha de apertura y observaciones. 6. Guardar el protocolo. 7. Ir al detalle → cambiar estado a **Derivado** con observación. 8. Verificar que la fecha de cierre se establece al cerrar. |
| **Resultado esperado** | El protocolo queda abierto vinculado al estudiante e incidente. Los estados avanzan correctamente. |
| **Criterio de aprobación** | ✅ Aprobado si el protocolo se crea y el flujo de estados funciona |

---

#### CU-06: Dashboard analítico

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Verificar que el directivo puede ver las estadísticas del establecimiento |
| **Precondición** | Al menos 5 incidentes registrados con distintas gravedades. Usuario Directivo autenticado. |
| **Pasos** | 1. Ingresar al Dashboard. 2. Verificar que cargan los 3 gráficos: barras por curso, torta por gravedad, líneas por mes. 3. Verificar que las tarjetas de resumen muestran números correctos. 4. Verificar que carga en menos de 3 segundos. 5. Intentar acceder al dashboard con rol Docente → debe retornar error 403. |
| **Resultado esperado** | El dashboard muestra datos reales y carga en tiempo aceptable. |
| **Criterio de aprobación** | ✅ Aprobado si los 3 gráficos muestran datos correctos y el tiempo de carga es menor a 3 segundos |

---

#### CU-07: Exportación PDF del historial conductual

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Verificar la generación del reporte PDF institucional (RF-11) |
| **Precondición** | Estudiante con al menos 1 incidente registrado |
| **Pasos** | 1. Ir al perfil del estudiante del CU-03. 2. Hacer clic en "Descargar historial PDF". 3. Verificar que el archivo se descarga. 4. Abrir el PDF y verificar: membrete con nombre del establecimiento, datos del estudiante, listado de incidentes, espacios de firma. |
| **Resultado esperado** | El PDF se descarga con el formato institucional correcto. |
| **Criterio de aprobación** | ✅ Aprobado si el PDF contiene todos los elementos requeridos |

---

#### CU-08: Importación masiva de estudiantes

| Campo | Detalle |
|-------|---------|
| **Objetivo** | Verificar que el administrador puede cargar la nómina completa |
| **Precondición** | Archivo CSV con la nómina real del establecimiento preparado |
| **Pasos** | 1. Ir a Estudiantes → Importar. 2. Cargar el archivo CSV con la nómina real. 3. Verificar el resumen: importados, actualizados, errores. 4. Buscar un estudiante recién importado por nombre. 5. Verificar que aparece en la lista. |
| **Resultado esperado** | La importación procesa correctamente. Los estudiantes aparecen en el sistema. |
| **Criterio de aprobación** | ✅ Aprobado si la importación completa sin errores bloqueantes y los estudiantes son buscables |

---

### 2.3 Criterios de aprobación del UAT

El UAT se considera **aprobado** cuando:

- Al menos **7 de 8 casos de prueba** retornan resultado ✅ Aprobado
- Ningún caso de prueba crítico falla (CU-01, CU-03, CU-05 son críticos)
- Los errores encontrados son clasificados como **menores** (no bloquean el flujo principal)

---

### 2.4 Clasificación de errores encontrados

| Severidad | Descripción | Acción |
|-----------|-------------|--------|
| **Bloqueante** | Impide completar un flujo principal (ej: no se puede registrar un incidente) | Se corrige antes de firmar el acta |
| **Mayor** | Funcionalidad incorrecta pero con workaround (ej: gráfico muestra datos erróneos) | Se corrige en hotfix post-entrega |
| **Menor** | Problema de UI/UX sin impacto en datos (ej: texto mal alineado) | Se registra para versión futura |

---

### 2.5 Acta de conformidad

Al finalizar las pruebas UAT sin errores bloqueantes, el cliente firma el **Acta de Conformidad** que certifica:

- El sistema cumple con los requerimientos funcionales acordados
- El equipo de desarrollo entrega las credenciales de acceso
- Se entrega la documentación técnica del sistema
- El cliente acepta formalmente el sistema para uso en producción

---

## 3. Checklist de cierre del proyecto

### Técnico
- [ ] Código en `main` de ambos repositorios sin cambios pendientes
- [ ] Variables de entorno configuradas en Render y Vercel
- [ ] SSL/HTTPS activo en ambas URLs
- [ ] Base de datos con datos reales del establecimiento
- [ ] Función `unaccent` activa en Supabase para búsqueda sin tildes

### Documentación
- [ ] `README.md` actualizado en ambos repos
- [ ] `api-contract.md` con URLs de producción
- [ ] Modelo ER (`schema.sql` y diagrama en `/docs`)
- [ ] Matriz de permisos documentada en README del backend
- [ ] Este documento DoD/UAT

### Entrega al cliente
- [ ] Credenciales de administrador entregadas de forma segura (Bitwarden o entrega presencial)
- [ ] URL de producción entregada
- [ ] Manual básico de usuario (opcional para MVP)
- [ ] Acta de conformidad firmada
