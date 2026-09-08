# SIGA Escolar — Plan de Pruebas UAT
## Pruebas de Aceptación de Usuario (User Acceptance Testing)

**Proyecto:** Sistema de Gestión y Acompañamiento Escolar  
**Cliente:** Escuela Coeducacional N°1 El Salvador  
**Modalidad:** Remota (coordinador prueba desde la escuela)  
**URL del sistema:** https://siga-frontend-delta-six.vercel.app  
**Responsable técnico:** Marcelo Acevedo Silva  

---

## Credenciales de acceso para el UAT

| Rol | Email | Contraseña |
|-----|-------|-----------|
| Administrador | admin@sigaescolar.cl | Admin1234! |

> ⚠️ **Importante:** Cambiar la contraseña después de las pruebas UAT.

---

## Instrucciones previas al coordinador

1. Abrir el navegador Chrome o Firefox (actualizado)
2. Ir a: **https://siga-frontend-delta-six.vercel.app**
3. Tener a mano este documento para ir marcando los resultados
4. Ante cualquier problema, tomar captura de pantalla y enviar por WhatsApp

---

## CASOS DE PRUEBA

---

### CP-01: Inicio de sesión

**Objetivo:** Verificar que el sistema permite ingresar con credenciales válidas

**Pasos:**
1. Ir a https://siga-frontend-delta-six.vercel.app
2. Ingresar email: `admin@sigaescolar.cl`
3. Ingresar contraseña: `Admin1234!`
4. Hacer clic en "Iniciar sesión"

**Resultado esperado:** El sistema redirige al Dashboard mostrando el nombre del usuario y su rol

| Resultado | Observaciones |
|-----------|--------------|
| ☐ Aprobado | |
| ☐ Fallido | |

---

### CP-02: Visualización del Dashboard

**Objetivo:** Verificar que el dashboard muestra estadísticas del establecimiento

**Pasos:**
1. Desde el Dashboard observar las tarjetas de resumen
2. Verificar que aparecen los gráficos (barras y torta)
3. Verificar que los datos mostrados corresponden al establecimiento

**Resultado esperado:** Dashboard carga en menos de 5 segundos con gráficos visibles

| Resultado | Observaciones |
|-----------|--------------|
| ☐ Aprobado | |
| ☐ Fallido | |

---

### CP-03: Búsqueda de estudiante

**Objetivo:** Verificar que el coordinador puede encontrar a cualquier estudiante

**Pasos:**
1. Hacer clic en "Directorio Estudiantes" en el menú lateral
2. En el buscador escribir el apellido de un estudiante (sin tilde)
3. Verificar que aparece en los resultados
4. Hacer clic en el estudiante para ver su perfil

**Resultado esperado:** El buscador encuentra al estudiante y muestra su perfil con datos personales y curso

| Resultado | Observaciones |
|-----------|--------------|
| ☐ Aprobado | |
| ☐ Fallido | |

---

### CP-04: Registro de incidente

**Objetivo:** Verificar el flujo completo de registro de un incidente

**Pasos:**
1. Hacer clic en "Registro Incidentes" en el menú lateral
2. Hacer clic en "Nuevo Incidente"
3. Completar el formulario:
   - Tipo de abordaje: **Entrevista**
   - Fecha: fecha de hoy
   - Gravedad: **Grave**
   - Buscar y agregar un estudiante en el buscador
   - Relato: escribir una descripción de al menos 20 caracteres
   - Medidas adoptadas: describir las medidas tomadas
4. Hacer clic en "Registrar Incidente"

**Resultado esperado:** El incidente se guarda y aparece una alerta visual indicando que es un incidente grave

| Resultado | Observaciones |
|-----------|--------------|
| ☐ Aprobado | |
| ☐ Fallido | |

---

### CP-05: Cambio de estado del incidente

**Objetivo:** Verificar la trazabilidad de estados

**Pasos:**
1. Desde la lista de incidentes hacer clic en el incidente creado en CP-04
2. En la sección "Cambiar Estado" seleccionar **Derivado**
3. Hacer clic en "Actualizar Estado"
4. Verificar que el estado cambió a "Derivado"
5. Intentar volver el estado a "En Investigación" — debe mostrar error

**Resultado esperado:** El estado avanza a Derivado. No permite retroceder estados.

| Resultado | Observaciones |
|-----------|--------------|
| ☐ Aprobado | |
| ☐ Fallido | |

---

### CP-06: Apertura de Protocolo RICE

**Objetivo:** Verificar la apertura y gestión de protocolos normativos

**Pasos:**
1. Hacer clic en "Protocolos RICE" en el menú lateral
2. Hacer clic en "Nuevo Protocolo"
3. Completar el formulario:
   - Tipo de protocolo: **Maltrato entre estudiantes**
   - Buscar y seleccionar el mismo estudiante del CP-04
   - Seleccionar el incidente creado en CP-04 como incidente relacionado
   - Fecha de apertura: fecha de hoy
   - Observaciones: escribir las observaciones iniciales
4. Hacer clic en "Crear Protocolo"

**Resultado esperado:** El protocolo queda abierto en estado "En Investigación" vinculado al estudiante e incidente

| Resultado | Observaciones |
|-----------|--------------|
| ☐ Aprobado | |
| ☐ Fallido | |

---

### CP-07: Avance de estado del Protocolo RICE

**Objetivo:** Verificar la trazabilidad de estados del protocolo

**Pasos:**
1. Ir al detalle del protocolo creado en CP-06
2. En la sección de cambio de estado seleccionar **Derivado**
3. Ingresar una observación en el campo correspondiente
4. Confirmar el cambio

**Resultado esperado:** El estado avanza a "Derivado" y la observación queda registrada

| Resultado | Observaciones |
|-----------|--------------|
| ☐ Aprobado | |
| ☐ Fallido | |

---

### CP-08: Exportación PDF del historial conductual

**Objetivo:** Verificar la generación del reporte PDF institucional

**Pasos:**
1. Ir al perfil del estudiante del CP-04
2. Hacer clic en el botón **"Descargar historial PDF"** (parte superior derecha del perfil)
3. Esperar que se genere el PDF
4. Abrir el PDF descargado y verificar:
   - ¿Aparece el nombre de la escuela en el encabezado?
   - ¿Aparecen los datos del estudiante?
   - ¿Aparece el incidente registrado en CP-04?
   - ¿Hay espacios para firmas al final?

**Resultado esperado:** PDF descargado con membrete institucional, datos del estudiante, historial de incidentes y espacios de firma

| Resultado | Observaciones |
|-----------|--------------|
| ☐ Aprobado | |
| ☐ Fallido | |

---

### CP-09: Creación de usuario con rol Inspector

**Objetivo:** Verificar la gestión de usuarios del establecimiento

**Pasos:**
1. Ir a "Gestión de Usuarios" en el menú lateral
2. Hacer clic en "Nuevo Usuario"
3. Completar el formulario:
   - Nombre: nombre de un inspector real del establecimiento
   - Email: email institucional del inspector
   - Rol: **Inspector**
   - Contraseña temporal: `Inspector1234!`
4. Guardar el usuario

**Resultado esperado:** El usuario aparece en la lista con el rol Inspector

| Resultado | Observaciones |
|-----------|--------------|
| ☐ Aprobado | |
| ☐ Fallido | |

---

### CP-10: Cierre de sesión

**Objetivo:** Verificar que el sistema cierra la sesión correctamente

**Pasos:**
1. Hacer clic en el ícono de usuario (esquina superior derecha)
2. Seleccionar "Cerrar sesión"
3. Verificar que el sistema redirige a la pantalla de login
4. Intentar acceder a https://siga-frontend-delta-six.vercel.app/dashboard — debe redirigir al login

**Resultado esperado:** La sesión cierra correctamente y no es posible acceder al dashboard sin autenticación

| Resultado | Observaciones |
|-----------|--------------|
| ☐ Aprobado | |
| ☐ Fallido | |

---

## RESUMEN DE RESULTADOS

| CP | Descripción | Resultado | Severidad si falla |
|----|-------------|-----------|-------------------|
| CP-01 | Inicio de sesión | ☐ | Bloqueante |
| CP-02 | Dashboard | ☐ | Mayor |
| CP-03 | Búsqueda de estudiante | ☐ | Bloqueante |
| CP-04 | Registro de incidente | ☐ | Bloqueante |
| CP-05 | Cambio de estado incidente | ☐ | Mayor |
| CP-06 | Apertura Protocolo RICE | ☐ | Bloqueante |
| CP-07 | Avance estado protocolo | ☐ | Mayor |
| CP-08 | Exportación PDF | ☐ | Mayor |
| CP-09 | Creación de usuario | ☐ | Menor |
| CP-10 | Cierre de sesión | ☐ | Menor |

**Total aprobados:** ___/10  
**Observaciones generales:**

_______________________________________________

_______________________________________________

---

## CRITERIO DE APROBACIÓN

El sistema se considera **APROBADO** para producción cuando:
- Los 4 casos **Bloqueantes** (CP-01, CP-03, CP-04, CP-06) están aprobados
- Al menos 7 de 10 casos en total están aprobados
- No existen errores que impidan el flujo principal de trabajo

---

## ACTA DE CONFORMIDAD

Por medio del presente documento, el abajo firmante certifica haber revisado y probado el sistema SIGA Escolar, encontrándolo conforme a los requerimientos establecidos.

**Fecha:** ___________________

**Nombre:** ___________________

**Cargo:** ___________________

**Firma:** ___________________

---

*Documento generado por el equipo de desarrollo SIGA Escolar*  
*Marcelo Acevedo Silva — Líder Backend/PM*  
*Daniel Flores Jaime — Líder Frontend/UI*
