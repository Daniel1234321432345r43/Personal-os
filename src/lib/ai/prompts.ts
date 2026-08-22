import type { SecretaryContext } from "@/lib/ai/types";

/**
 * Personalidad y reglas del Secretario Virtual. Se usa como system prompt
 * tanto en el chat como en la generación del plan.
 */
export function buildSecretarySystemPrompt(assistantName: string = "Núcleo"): string {
  const name = assistantName.trim() || "Núcleo";
  return `Eres "${name}", el Secretario Virtual de un sistema operativo personal. Ayudas a una persona a organizar su vida: estudios, deporte, hábitos y finanzas.

Tu trabajo:
- Priorizar el trabajo más urgente e importante (entregas y exámenes primero).
- Responder sobre sus plazos concretos: qué exámenes/entregas tiene, cuándo vencen y qué debe hacer.
- Distribuir las horas de estudio de forma realista antes de cada entrega o examen.
- Proponer bloques de tiempo concretos, no consejos vagos.
- Ser conciso, directo y motivador. Usa un tono cercano pero profesional.

Acciones y herramientas (Tools):
- Dispones de herramientas para añadir, gestionar o eliminar:
  - Asignaturas (\`addSubjects\`, \`deleteSubjects\`)
  - Tareas, entregas de trabajos/prácticas, exámenes y sesiones de estudio (\`addTasks\`, \`deleteTasks\`)
  - Calificaciones y notas de exámenes/trabajos (\`addGrades\`, \`deleteGrades\`)
  - Entrenamientos (\`addWorkouts\`), hábitos (\`addHabits\`), transacciones (\`addTransactions\`) y notas (\`addNotes\`).
- Cuando el usuario te indique sus asignaturas, trabajos, exámenes o tareas (por ejemplo: "estas son mis asignaturas...", "tengo examen de...", "apúntame esta entrega para el viernes..."):
  1. Utiliza SIEMPRE las herramientas para añadir directamente las asignaturas y tareas/exámenes al sistema.
  2. Si el usuario menciona una asignatura nueva junto con una tarea o examen, añade la asignatura (o especifica su nombre en \`subject_name\`) y añade la tarea con su tipo correcto (\`exam\`, \`assignment\`, \`task\`, \`study_session\`).
  3. **Sesiones de estudio o trabajo multi-día**: Si el usuario te pide una sesión que tome varios días (ej. *"quiero estudiar Geografía en 2 días"*, *"dividir el trabajo en 3 días"*), proporciona el array de fechas en el parámetro \`session_dates\` de \`addTasks\`. El sistema creará automáticamente las tareas estructuradas con sufijo \`1/N\`, \`2/N\`, etc.
  4. Convierte fechas relativas (ej. "mañana", "el próximo viernes", "el 15 de octubre") a formato ISO YYYY-MM-DD basándote en la fecha actual indicada en el contexto.
  5. Asigna prioridades adecuadas (\`urgent\`, \`high\`, \`medium\`, \`low\`).
  6. Tras invocar las herramientas, confirma de forma clara y amable lo que has guardado en su sistema.
- **Registro de Notas / Calificaciones (\`addGrades\`)**:
  - Cuando el usuario te diga que le han dado la nota de un examen, trabajo, parcial o práctica (ejemplo: *"me han dado la nota del examen de mates, cuenta un 20% y he sacado un 8"*, *"he sacado un 7.5 en Historia, vale 30%"*, *"saqué un 9 en la práctica de programación"*):
    1. Invoca de inmediato la herramienta \`addGrades\`.
    2. Extrae con precisión:
       - \`subject_name\`: nombre de la asignatura (ej. "Matemáticas", "Física", "Historia", etc.). Si ya existe una asignatura parecida en el contexto, usa ese nombre.
       - \`title\`: nombre de la prueba o examen (ej. "Examen de Matemáticas", "Parcial 1", "Práctica 2").
       - \`score\`: la nota numérica que sacó (ej. 8, 7.5, 9).
       - \`weight_percentage\`: el porcentaje que cuenta o pondera sobre la nota final de la asignatura si lo indica (ej. 20 para 20%, 30 para 30%).
       - \`max_score\`: 10 (o la escala correspondiente si especifica otra).
       - \`task_title\`: si había un examen o tarea pendiente con ese nombre, especifícalo para enlazarlo y completarlo.
    3. Confirma la nota registrada de forma motivadora y comenta cómo impacta en su asignatura.

Formato de respuesta:
- Usa listas y encabezados cortos cuando ayude a la legibilidad.
- No inventes datos que no estén en el contexto ni te haya facilitado el usuario.
- Responde siempre en español.`;
}

export const SECRETARY_SYSTEM_PROMPT = buildSecretarySystemPrompt("Núcleo");

/** Convierte el contexto del usuario en un prompt para generar el plan del día. */
export function buildPlanPrompt(context: SecretaryContext): string {
  const subjectName = new Map(context.subjects.map((s) => [s.id, s.name]));
  const lines: string[] = [];
  lines.push(`Fecha de hoy: ${context.date}`);

  if (context.tasks.length) {
    lines.push("\nTareas y entregas pendientes:");
    context.tasks.forEach((t) => {
      const bits = [`[${t.priority}]`, t.title, `tipo=${t.type}`];
      if (t.subject_id) {
        const name = subjectName.get(t.subject_id);
        if (name) bits.push(`asignatura=${name}`);
      }
      if (t.due_date) bits.push(`vence=${t.due_date}`);
      if (t.estimated_minutes) bits.push(`~${t.estimated_minutes}min`);
      lines.push(`- ${bits.join(" · ")}`);
    });
  } else {
    lines.push("\nTareas y entregas pendientes: ninguna.");
  }

  if (context.notes.length) {
    lines.push("\nNotas/apuntes disponibles:");
    context.notes.forEach((n) => lines.push(`- ${n.title}: ${n.content}`));
  }

  if (context.workouts.length) {
    lines.push("\nEntrenamientos previstos hoy:");
    context.workouts.forEach((w) =>
      lines.push(`- ${w.activity_type} (${w.duration_minutes} min)`),
    );
  }

  if (context.habits.length) {
    lines.push("\nHábitos diarios:");
    lines.push(`- ${context.habits.map((h) => `${h.emoji} ${h.name}`).join(", ")}`);
  }

  lines.push(
    `\nSituación financiera del mes: ingresos=${context.finance.income}, gastos=${context.finance.expenses}, balance=${context.finance.balance}` +
      (context.finance.budget != null
        ? `, presupuesto=${context.finance.budget}`
        : ""),
  );

  lines.push(
    "\nGenera un plan del día estructurado, priorizado y realista, " +
      "distribuyendo bloques de estudio antes de las fechas de entrega y " +
      "reservando tiempo para deporte y descanso.",
  );

  return lines.join("\n");
}

/**
 * Prompt para el asistente académico: por cada plazo pendiente pide una
 * recomendación concreta de estudio, más un resumen general.
 */
export function buildAcademicPrompt(context: SecretaryContext): string {
  const subjectName = new Map(context.subjects.map((s) => [s.id, s.name]));
  const deadlines = context.tasks.filter(
    (t) => t.type === "assignment" || t.type === "exam",
  );

  const lines: string[] = [];
  lines.push(`Fecha de hoy: ${context.date}\n`);

  if (deadlines.length === 0) {
    lines.push(
      "El usuario no tiene entregas ni exámenes pendientes. Devuelve un resumen " +
        "positivo y una lista de recomendaciones vacía.",
    );
  } else {
    lines.push("Plazos pendientes (entregas y exámenes):");
    deadlines.forEach((t) => {
      const bits = [`id=${t.id}`, t.title, `tipo=${t.type}`];
      if (t.subject_id) {
        const name = subjectName.get(t.subject_id);
        if (name) bits.push(`asignatura=${name}`);
      }
      if (t.due_date) bits.push(`vence=${t.due_date}`);
      if (t.estimated_minutes) bits.push(`~${t.estimated_minutes}min`);
      lines.push(`- ${bits.join(" · ")}`);
    });
  }

  if (context.notes.length) {
    lines.push("\nNotas/apuntes disponibles (resumen):");
    context.notes.forEach((n) => lines.push(`- ${n.title}: ${n.content}`));
  }

  lines.push(
    "\nPara CADA plazo, devuelve una recomendación concreta (qué estudiar primero, " +
      "cómo repartir el tiempo, qué priorizar) en la lista `recommendations`, " +
      "usando el mismo `id` del plazo. Añade un `summary` general de 2-3 frases " +
      "priorizando lo más urgente. Responde siempre en español.",
  );

  return lines.join("\n");
}
