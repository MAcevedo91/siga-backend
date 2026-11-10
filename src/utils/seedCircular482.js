require('dotenv').config()

const { supabase } = require('./db')
const { generarEmbeddingTexto } = require('../services/riceIngestaService')
const logger = require('./logger')

/**
 * Protocolos Oficiales Obligatorios de la Circular N° 482 de la Superintendencia de Educación (Chile).
 * Resolución Exenta N° 482 (28 de julio de 2018).
 * Rigen de forma supletoria y obligatoria para todos los establecimientos educacionales reconocidos por el Estado.
 */
const PROTOCOLOS_CIRCULAR_482 = [
  {
    seccion: 'CIRCULAR N° 482 — TÍTULO I: PROTOCOLOS OBLIGATORIOS',
    articulo: 'Protocolo 1: Acoso Escolar, Maltrato entre Pares y Ciberacoso / Violencia Digital',
    contenido: `PROTOCOLO ANTE MALTRATO ENTRE PARES, ACOSO ESCOLAR Y CIBERACOSO (LEY N° 20.536):
1. Definición y Alcance: Se entiende por acoso escolar (bullying) toda acción u omisión constitutiva de agresión u hostigamiento reiterado, realizada dentro o fuera del establecimiento por estudiantes, que cause daño, discriminación o temor justificado. El ciberacoso comprende agresiones a través de medios digitales, redes sociales, mensajería instantánea o videojuegos, inclusive ocurridas fuera del horario escolar pero con impacto en la convivencia.
2. Acción Inmediata y Contención: Ante la detección o denuncia de una agresión digital o física, cualquier funcionario debe interrumpir la conducta, brindar contención emocional inmediata a la víctima en un espacio confidencial y derivar el caso a Inspectoría General o al Encargado/a de Convivencia Escolar. Se preservará la evidencia digital (capturas de pantalla, enlaces, registros de chats) sin vulnerar la intimidad de los estudiantes.
3. Notificación a Apoderados (Plazo Máximo 24 Horas): El Encargado de Convivencia o Profesor Jefe debe citar e informar por separado a los apoderados del estudiante afectado y del presunto agresor dentro de las 24 horas siguientes a la toma de conocimiento del hecho.
4. Procedimiento de Investigación Formativa y Debido Proceso: Se realizarán entrevistas individuales y separadas garantizando el derecho a ser escuchado (descargos). Se prohíbe confrontar cara a cara a la víctima con el agresor en fases iniciales.
5. Medidas de Protección y Formativas: Aplicar de inmediato medidas de protección (supervisión en recreos, resguardo en aula, derivación a Dupla Psicosocial). Las sanciones disciplinarias deben ser proporcionales a la edad y gradualidad de la falta, priorizando medidas reparatorias y formativas.`
  },
  {
    seccion: 'CIRCULAR N° 482 — TÍTULO I: PROTOCOLOS OBLIGATORIOS',
    articulo: 'Protocolo 2: Agresiones o Maltrato de Adultos a Estudiantes (Vulneración de Derechos)',
    contenido: `PROTOCOLO ANTE MALTRATO O AGRESIONES DE ADULTOS HACIA ESTUDIANTES:
1. Resguardo Inmediato: Todo funcionario que presencie o reciba denuncia de maltrato físico, psicológico o vulneración cometida por un docente, directivo o asistente de la educación debe garantizar la indemnidad inmediata del estudiante, apartándolo de la presencia del presunto agresor y comunicándolo a la Dirección.
2. Separación Preventiva de Funciones: La Dirección Escolar dispondrá de inmediato la separación temporal del funcionario de cualquier labor de aula o contacto directo con el menor involucrado mientras se instruye la investigación interna.
3. Notificación a Padres y Redes: Se notificará a los apoderados en un plazo máximo de 24 horas en reunión reservada. Si se presume vulneración de derechos grave, se derivará a la Oficina Local de la Niñez (OLN) o Tribunal de Familia competente.
4. Denuncia Penal Obligatoria (Art. 175 letra e CPP): Si los hechos revisten carácter de delito (lesiones corporales, maltrato relevante Ley N° 21.013), el Director está legalmente obligado a efectuar la denuncia dentro de las 24 horas ante el Ministerio Público, Carabineros o Policía de Investigaciones (PDI).`
  },
  {
    seccion: 'CIRCULAR N° 482 — TÍTULO I: PROTOCOLOS OBLIGATORIOS',
    articulo: 'Protocolo 3: Agresiones Sexuales y Hechos de Connotación Sexual',
    contenido: `PROTOCOLO DE ACTUACIÓN FRENTE A SITUACIONES DE CONNOTACIÓN SEXUAL O AGRESIONES SEXUALES:
1. Contención y Cero Revictimización: Acoger a la víctima en un entorno seguro y con personal de confianza (Dupla Psicosocial). Queda estrictamente prohibido interrogar a la víctima en detalle, cuestionar su relato o exigirle que repita lo sucedido ante terceros.
2. Denuncia Penal Ineludible en 24 Horas: Conforme al Art. 175 letra e del Código Procesal Penal, directores, inspectores y profesores deben denunciar inmediatamente y a más tardar dentro de 24 horas cualquier hecho de connotación sexual ante Carabineros, PDI o Fiscalía. El incumplimiento acarrea responsabilidad penal funcionaria.
3. Notificación a la Familia: Se informará inmediatamente a los apoderados, salvo que existan sospechas fundadas de que el presunto agresor pertenece al núcleo familiar del menor, caso en el cual se actuará bajo reserva priorizando la intervención del Ministerio Público y el Tribunal de Familia.
4. Medidas Cautelares Institucionales: Apartar de inmediato y de forma absoluta al imputado del contacto con estudiantes si es funcionario, o implementar tutoría y turnos diferenciados de patio si el imputado es otro estudiante.`
  },
  {
    seccion: 'CIRCULAR N° 482 — TÍTULO I: PROTOCOLOS OBLIGATORIOS',
    articulo: 'Protocolo 4: Afectación de Salud Mental, Ideación o Conducta Suicida y Desregulaciones Severas',
    contenido: `PROTOCOLO FRENTE A DESREGULACIONES EMOCIONALES, AFECTACIÓN DE SALUD MENTAL E IDEACIÓN SUICIDA (ORD. N° 0852):
1. Detección y Acompañamiento Continuo: Frente a verbalizaciones de autolesión, ideación suicida o llanto desregulado, el estudiante NUNCA debe quedarse solo. Debe ser acompañado por un profesional psicosocial o docente en un ambiente tranquilo y desprovisto de estímulos invasivos.
2. Contención y Retiro Asistido: Contactar de urgencia a los apoderados vía telefónica y presencial. Se suscribirá un compromiso de retiro asistido y derivación inmediata al centro de salud de urgencia (CESFAM, SAPU o Servicio de Urgencia Hospitalario).
3. Red de Apoyo de Salud: En casos de crisis inminente sin presencia inmediata de apoderados, el establecimiento trasladará al estudiante al centro asistencial más cercano con resguardo de un funcionario del equipo de convivencia.
4. Plan de Retorno y Reincorporación: Al regreso del estudiante, la Dupla Psicosocial y UTP elaborarán un Plan de Acompañamiento Escolar con adaptaciones curriculares y de evaluación formativa recomendadas por su médico tratante.`
  },
  {
    seccion: 'CIRCULAR N° 482 — TÍTULO I: PROTOCOLOS OBLIGATORIOS',
    articulo: 'Protocolo 5: Presencia, Consumo, Porte o Microtráfico de Drogas y Alcohol (Ley N° 20.000)',
    contenido: `PROTOCOLO ANTE PRESENCIA, PORTE, CONSUMO O TRÁFICO DE DROGAS Y BEBIDAS ALCOHÓLICAS:
1. Resguardo de la Salud: Si un estudiante presenta intoxicación o pérdida de conciencia por ingesta de alcohol o sustancias estupefacientes, la prioridad es su atención médica urgente (SAMU o traslado a urgencia) notificando de inmediato a su apoderado.
2. Hallazgo de Sustancias: Ante el hallazgo o incautación de sustancias ilícitas, estas deben ser puestas en sobre cerrado bajo custodia exclusiva de Dirección o Inspectoría General, evitando manipulación directa innecesaria.
3. Denuncia en 24 Horas: El porte y tráfico constituyen delito tipificado en la Ley N° 20.000, por lo que el Director tiene la obligación legal de denunciar el hecho ante Carabineros o PDI en el plazo máximo de 24 horas.
4. Abordaje Formativo y Preventivo: El estudiante no será marginado automáticamente; se activará un plan de apoyo psicosocial con derivación al programa SENDA Previene y redes comunales de rehabilitación.`
  },
  {
    seccion: 'CIRCULAR N° 482 — TÍTULO I: PROTOCOLOS OBLIGATORIOS',
    articulo: 'Protocolo 6: Porte o Tenencia de Armas u Objetos Peligrosos (Ley N° 21.128 Aula Segura)',
    contenido: `PROTOCOLO ANTE PORTE DE ARMAS DE FUEGO, BLANCAS O ARTEFACTOS EXPLOSIVOS (LEY AULA SEGURA):
1. Aislamiento y No Confrontación: Ante el avistamiento o sospecha de armas, el personal no debe forcejear físicamente. Se debe despejar el aula o patio, aislar el sector y priorizar la evacuación y resguardo seguro de los demás estudiantes.
2. Intervención Policial Inmediata: Comunicarse de urgencia al 133 de Carabineros de Chile o Plan Cuadrante para la incautación segura del elemento peligroso y la denuncia penal correspondiente en plazo de 24 horas.
3. Notificación a Apoderados: Citar a los apoderados del estudiante de manera urgente para informar la situación y medidas cautelares adoptadas.
4. Medida Cautelar de Suspensión: Conforme a la Ley N° 21.128 (Aula Segura), el Director podrá aplicar como medida cautelar la suspensión de clases del estudiante mientras dure el procedimiento sancionatorio, asegurando el debido proceso y la remisión del caso al Ministerio de Educación para su reubicación.`
  },
  {
    seccion: 'CIRCULAR N° 482 — TÍTULO I: PROTOCOLOS OBLIGATORIOS',
    articulo: 'Protocolo 7: Accidentes Escolares y Urgencias Médicas (D.S. N° 313)',
    contenido: `PROTOCOLO FRENTE A ACCIDENTES ESCOLARES Y EMERGENCIAS DE SALUD (D.S. N° 313):
1. Primeros Auxilios y Categorización: Brindar atención primaria de primeros auxilios por personal capacitado de Inspectoría o Enfermería escolar. Si el accidente es de mediana o alta gravedad, no mover al lesionado y solicitar ambulancia SAMU (131).
2. Declaración Individual de Accidente Escolar (DIAE): Emitir la DIAE correspondiente al Seguro de Accidentes Escolares (Ley N° 16.744) para garantizar la gratuidad total en el hospital o centro asistencial público de la red asistencial.
3. Comunicación Inmediata con el Apoderado: Notificar de forma urgente al apoderado titular y suplente informando el centro de salud al que fue derivado el alumno y el diagnóstico preliminar.
4. Registro de Novedades: Ingresar el informe detallado en el libro de novedades y sistema digital de convivencia registrando hora, lugar, testigos y medidas adoptadas.`
  },
  {
    seccion: 'CIRCULAR N° 482 — TÍTULO I: PROTOCOLOS OBLIGATORIOS',
    articulo: 'Protocolo 8: Retención y Apoyo a Estudiantes Embarazadas, Madres y Padres Adolescentes',
    contenido: `PROTOCOLO DE RETENCIÓN ESCOLAR DE ESTUDIANTES EMBARAZADAS, MADRES Y PADRES ADOLESCENTES:
1. Derecho a la Educación y No Discriminación: Está terminantemente prohibida cualquier medida que condicione la matrícula, promueva el cambio de jornada forzoso o excluya a la alumna de ceremonias o actividades académicas regulares.
2. Flexibilidad Horaria y Permisos de Lactancia: Se otorgarán facilidades para el ingreso y salida del establecimiento, permisos para controles prenatales y un tiempo mínimo diario de al menos 1 hora para amamantamiento o alimentación del lactante.
3. Calendario Académico Especial: La Unidad Técnica Pedagógica (UTP) elaborará un calendario flexible de evaluaciones y tutorías pedagógicas durante los períodos de pre y post natal.
4. Acompañamiento Psicosocial: Vinculación con los centros de salud familiar (CESFAM) para el control del niño sano y apoyo en la continuidad de sus trayectorias educativas.`
  },
  {
    seccion: 'CIRCULAR N° 482 — TÍTULO I: PROTOCOLOS OBLIGATORIOS',
    articulo: 'Protocolo 9: Identidad de Género de Estudiantes Trans (Circular N° 812)',
    contenido: `PROTOCOLO PARA GARANTIZAR LOS DERECHOS DE ESTUDIANTES TRANS (CIRCULAR N° 812 SUPERINTENDENCIA):
1. Respeto al Nombre Social: Obligación de utilizar el nombre social del estudiante en todos los registros cotidianos escolares (listas de asistencia, comunicaciones a apoderados, libros de clases, ceremonias públicas), independientemente de que no cuente aún con rectificación registral de la partida de nacimiento.
2. Uso de Servicios Higiénicos y Vestidores: Se garantizará el uso de servicios higiénicos que correspondan a su identidad de género o, en su defecto, acceso a baños individuales de uso mixto que garanticen su comodidad y privacidad, en acuerdo con la familia.
3. Uniforme y Presentación Personal: El estudiante podrá utilizar el uniforme escolar que resulte acorde a su identidad de género manifestada.
4. Prevención de la Discriminación: El Encargado de Convivencia promoverá talleres y jornadas de sensibilización docente y estudiantil contra la discriminación por identidad o expresión de género.`
  },
  {
    seccion: 'CIRCULAR N° 482 — TÍTULO I: PROTOCOLOS OBLIGATORIOS',
    articulo: 'Protocolo 10: Medidas Disciplinarias, Gradualidad, Debido Proceso y Enfoque Formativo',
    contenido: `PROTOCOLO DE MEDIDAS DISCIPLINARIAS, GRADUALIDAD Y DEBIDO PROCESO:
1. Principio de Legalidad y Tipificación: Ningún estudiante puede ser sancionado por conductas que no hayan sido previa, expresa y taxativamente descritas como faltas leves, graves o gravísimas en el RICE.
2. Debido Proceso Escolar: Todo procedimiento disciplinario exige:
   a) Comunicación formal y clara de los hechos imputados al estudiante y a su apoderado.
   b) Derecho a ser escuchado y a presentar descargos en un plazo razonable no inferior a 48 horas.
   c) Presunción de inocencia y ponderación de atenuantes (edad, conducta anterior, reconocimiento voluntario).
   d) Derecho a apelar la resolución ante la Dirección o Consejo Escolar en un plazo fijado de 5 días hábiles.
3. Gradualidad y Proporcionalidad: Las medidas formativas, pedagógicas y restaurativas (diálogo reflexivo, servicio comunitario escolar, mediación entre pares) deben anteceder a medidas punitivas severas. La expulsión o cancelación de matrícula sólo procede como última ratio en faltas gravísimas que amenacen la integridad de la comunidad.`
  }
]

/**
 * Ejecuta el seed oficial de la Circular N° 482 en Supabase.
 */
const seedCircular482 = async () => {
  logger.info('[SEED CIRCULAR 482] Iniciando registro de normativa nacional obligatoria...')

  try {
    // 1. Verificar si ya existe el documento oficial en rice_documentos (tenant_id IS NULL)
    const { data: docExistente, error: errBusqueda } = await supabase
      .from('rice_documentos')
      .select('id, nombre_archivo, total_chunks, estado')
      .is('tenant_id', null)
      .eq('estado', 'activo')
      .maybeSingle()

    if (errBusqueda) {
      logger.error('[SEED CIRCULAR 482] Error al consultar documento nacional en Supabase:', errBusqueda.message)
      throw errBusqueda
    }

    let documentoId = null

    if (docExistente) {
      logger.info(`[SEED CIRCULAR 482] ✓ Documento oficial ya registrado: ${docExistente.id} (${docExistente.total_chunks} chunks)`)
      documentoId = docExistente.id

      // Eliminar chunks existentes para reindexar de forma limpia
      const { error: errBorrarChunks } = await supabase
        .from('rice_chunks')
        .delete()
        .eq('documento_id', documentoId)

      if (errBorrarChunks) {
        logger.warn('[SEED CIRCULAR 482] Advertencia al limpiar chunks antiguos:', errBorrarChunks.message)
      }
    } else {
      // 2. Insertar nuevo documento oficial de alcance nacional
      const { data: docNuevo, error: errInsertDoc } = await supabase
        .from('rice_documentos')
        .insert({
          tenant_id: null,
          subido_por: null,
          nombre_archivo: 'Circular N° 482 — Superintendencia de Educación',
          formato: 'md',
          anio_vigencia: 2026,
          estado: 'activo',
          total_chunks: PROTOCOLOS_CIRCULAR_482.length,
          metadata: {
            organismo_emisor: 'Superintendencia de Educación de Chile',
            resolucion: 'Resolución Exenta N° 482 (28-JUL-2018)',
            descripcion: 'Circular que imparte instrucciones sobre reglamentos internos de los establecimientos educacionales de enseñanza parvularia, básica y media',
            es_normativa_nacional: true,
          },
        })
        .select('*')
        .single()

      if (errInsertDoc) {
        logger.error('[SEED CIRCULAR 482] Error al insertar documento oficial en rice_documentos:', errInsertDoc.message)
        throw errInsertDoc
      }

      documentoId = docNuevo.id
      logger.info(`[SEED CIRCULAR 482] ✓ Documento oficial creado exitosamente: ${documentoId}`)
    }

    // 3. Generar embeddings y persistir chunks de los 10 protocolos
    logger.info(`[SEED CIRCULAR 482] Generando embeddings para ${PROTOCOLOS_CIRCULAR_482.length} protocolos normativos...`)
    const chunksParaInsertar = []

    for (let i = 0; i < PROTOCOLOS_CIRCULAR_482.length; i++) {
      const p = PROTOCOLOS_CIRCULAR_482[i]
      const textoParaEmbedding = `${p.seccion}\n${p.articulo}\n${p.contenido}`
      const vector = await generarEmbeddingTexto(textoParaEmbedding)

      chunksParaInsertar.push({
        tenant_id: null,
        documento_id: documentoId,
        numero_chunk: i + 1,
        seccion: p.seccion,
        articulo: p.articulo,
        contenido: p.contenido,
        embedding: vector,
      })
    }

    const { error: errInsertChunks } = await supabase
      .from('rice_chunks')
      .insert(chunksParaInsertar)

    if (errInsertChunks) {
      logger.error('[SEED CIRCULAR 482] Error al insertar fragmentos vectoriales en rice_chunks:', errInsertChunks.message)
      throw errInsertChunks
    }

    logger.info(`[SEED CIRCULAR 482] ✓ Se insertaron exitosamente ${chunksParaInsertar.length} protocolos de la Circular N° 482.`)
    return {
      status: 'success',
      documentoId,
      totalProtocolos: chunksParaInsertar.length,
    }
  } catch (err) {
    logger.error('[SEED CIRCULAR 482] Error fatal en ejecución de seed:', err)
    throw err
  }
}

if (require.main === module) {
  seedCircular482()
    .then((res) => {
      console.log('✓ Proceso de seed de Circular N° 482 finalizado con éxito:', res)
      process.exit(0)
    })
    .catch((err) => {
      console.error('✗ Falló la ejecución del seed de Circular N° 482:', err.message)
      process.exit(1)
    })
}

module.exports = {
  seedCircular482,
  PROTOCOLOS_CIRCULAR_482,
}
