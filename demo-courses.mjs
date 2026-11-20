const single = (prompt, options, correct) => ({type: 'single', prompt, options, answer: [correct]});
const multiple = (prompt, options, answer) => ({type: 'multiple', prompt, options, answer});
const boolean = (prompt, correct) => ({type: 'boolean', prompt, answer: [correct ? 0 : 1]});
const ordering = (prompt, options, answer) => ({type: 'ordering', prompt, options, answer});

export const demoCourses = [
  {
    title: 'Fundamentos de Protección Civil',
    category: 'Gestión del riesgo',
    description: 'Distingue amenaza, exposición y vulnerabilidad, y elabora un diagnóstico básico de un entorno conocido.',
    lessons: [
      ['Amenaza, exposición y vulnerabilidad', 'Una amenaza es un fenómeno que puede causar daños. La exposición indica quién o qué está en su alcance. La vulnerabilidad describe las condiciones que pueden aumentar el daño. Una quebrada que crece representa una amenaza. Las viviendas cercanas están expuestas y una salida difícil puede aumentar su vulnerabilidad.'],
      ['Capacidades de una comunidad', 'Una comunidad también cuenta con recursos para prepararse: personas organizadas, conocimientos, espacios de reunión y canales de comunicación. En un mapa de práctica, marca esos recursos y registra quién puede confirmar que siguen disponibles.'],
      ['Diagnóstico y priorización', 'Describe un escenario, qué podría verse afectado y qué condiciones agravarían el impacto. Luego identifica una acción realizable, su responsable y la forma de verificar que se completó.'],
    ],
    activity: 'Elige un espacio conocido. Completa: amenaza, personas o bienes expuestos, vulnerabilidad, capacidad disponible, acción prioritaria y responsable.',
    questions: [
      single('¿Qué describe la exposición?', ['La fecha de una actividad', 'Las personas o bienes al alcance de una amenaza', 'El nombre de una brigada'], 1),
      multiple('¿Qué elementos deben registrarse al revisar un riesgo?', ['Amenaza', 'Color del formulario', 'Personas expuestas', 'Vulnerabilidades'], [0, 2, 3]),
      boolean('Una salida difícil puede aumentar la vulnerabilidad.', true),
      single('¿Cuál es un ejemplo de capacidad comunitaria?', ['Una ruta inutilizable', 'Una lista sin verificar', 'Una brigada con roles acordados'], 2),
    ],
  },
  {
    title: 'Plan familiar y evacuación',
    category: 'Prevención comunitaria',
    description: 'Diseña un plan familiar con rutas, punto de encuentro, responsables y una práctica de revisión.',
    lessons: [
      ['Acuerdos del hogar', 'El plan familiar debe ser conocido por todas las personas del hogar. Anota cómo se comunicarán, dónde se reunirán y quién apoyará a quienes necesiten ayuda. Revisa los acuerdos cuando cambien las personas o las condiciones de la vivienda.'],
      ['Rutas y punto de encuentro', 'Dibuja un esquema sencillo con entradas, salidas y un punto de encuentro acordado. En la práctica, revisen si cada persona conoce el recorrido y si existen barreras para usarlo. Registra una ruta alternativa para discutir en familia.'],
      ['Práctica y revisión', 'Antes de ensayar, explica el objetivo y los roles. Al terminar, pregunta qué funcionó y qué causó dudas. Asigna a una persona la actualización del plan y acuerda cuándo volverán a practicarlo.'],
    ],
    activity: 'Dibuja el plano del hogar, marca dos posibles salidas, anota el punto de encuentro y deja espacio para observaciones del ensayo.',
    questions: [
      single('¿Cuándo conviene acordar el punto de encuentro?', ['Al finalizar la emergencia', 'Durante la planificación familiar', 'Solo cuando cambia el domicilio'], 1),
      multiple('¿Qué elementos conviene revisar al planificar?', ['Rutas posibles', 'Punto de encuentro', 'Roles de apoyo', 'Color del papel'], [0, 1, 2]),
      boolean('Si una ruta está bloqueada, el plan sigue siendo válido sin revisarla.', false),
      ordering('Ordena las etapas del ejercicio familiar.', ['Revisar el resultado', 'Practicar el recorrido', 'Acordar el plan'], [2, 1, 0]),
    ],
  },
  {
    title: 'Comunicaciones en emergencias',
    category: 'Coordinación operativa',
    description: 'Practica cómo redactar un reporte claro, confirmar su recepción y registrar novedades.',
    lessons: [
      ['Datos de un reporte inicial', 'En un ejercicio, prepara un reporte con el lugar, el tipo de situación, lo que observaste y un contacto para seguimiento. Usa una referencia que otra persona pueda reconocer. Si algún dato es desconocido, deja constancia de ello.'],
      ['Confirmación y actualización', 'Practica la confirmación de los datos críticos. La persona que recibe puede repetir la ubicación y la novedad principal. Si algo cambia, emite una actualización identificable en vez de repetir como vigente el reporte anterior.'],
      ['Bitácora de novedades', 'En una bitácora de práctica, guarda hora, fuente, información confirmada y acción pendiente. Esta secuencia ayuda al equipo a reconstruir qué se sabía y qué faltaba confirmar en cada momento.'],
    ],
    activity: 'Redacta un reporte ficticio con hora, lugar, referencia, observación, dato por confirmar y acción pendiente.',
    questions: [
      single('¿Qué dato ayuda a ubicar el lugar del incidente?', ['Una referencia reconocible', 'El color del teléfono', 'La opinión de un tercero'], 0),
      boolean('Conviene presentar como confirmada la información que aún no se ha verificado.', false),
      multiple('¿Qué información corresponde a una bitácora?', ['Hora', 'Fuente', 'Acción pendiente', 'Rumores sin identificar'], [0, 1, 2]),
      single('¿Qué debe hacerse cuando cambia un dato importante?', ['Dejar el reporte anterior como vigente', 'Comunicar la actualización de forma identificable', 'Borrar toda la bitácora'], 1),
    ],
  },
  {
    title: 'Diseño de un simulacro comunitario',
    category: 'Preparación y simulacros',
    description: 'Planifica un ejercicio de mesa, asigna responsabilidades y documenta acciones de mejora.',
    lessons: [
      ['Escenario y objetivo', 'Un ejercicio de mesa consiste en conversar sobre cómo actuar ante una situación simulada. Elige un escenario concreto y un objetivo medible, por ejemplo verificar si el equipo sabe a quién informar y quién solicita confirmación.'],
      ['Roles y observación', 'Asigna a una persona la facilitación, a otras los roles del escenario y a otra la observación. Antes de comenzar, acuerden qué registrarán: claridad de los avisos, cumplimiento de los roles y dificultades en la coordinación.'],
      ['Evaluación posterior', 'Al cerrar, compara lo ocurrido con el objetivo. Registra una fortaleza y una brecha con un ejemplo observado. Para cada mejora, acuerda una acción, un responsable y una fecha de revisión.'],
    ],
    activity: 'Ficha de ejercicio: escenario, objetivo, participantes, observaciones, mejora propuesta, responsable y fecha de seguimiento.',
    questions: [
      single('¿Qué objetivo puede evaluarse en un ejercicio de mesa?', ['Hacer todo mejor', 'Verificar si el equipo identifica a quién avisar', 'Tener más asistentes en general'], 1),
      boolean('La persona observadora registra lo que ocurre durante el ejercicio.', true),
      multiple('¿Qué datos convierten una mejora en un compromiso concreto?', ['Acción', 'Responsable', 'Fecha de revisión', 'Un eslogan'], [0, 1, 2]),
      ordering('Ordena las etapas del simulacro.', ['Ejecutar el escenario', 'Acordar el objetivo', 'Evaluar y asignar mejoras'], [1, 0, 2]),
    ],
  },
];
