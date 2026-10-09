/**
 * Nombres y resumen del tiempo de estudio (Pomodoros).
 *
 * De aquí sale lo que ves en el panel cuando haces un Pomodoro: a qué se ha
 * dedicado el tiempo HOY ("Estudiar para el examen de Dibujo Técnico",
 * "Trabajar en Práctica 3 de Redes") y cuántos minutos llevas en total, no solo
 * ese día. El total es lo que aparece al desplegar el trabajo.
 *
 * Sin dependencias a propósito (ni React ni el store ni alias `@/`): así se
 * prueba directamente con Node desde `scripts/test-study-summary.mjs`.
 */

/** Sesión mínima que necesita el resumen (`StudySession` la cumple). */
export interface StudyEntry {
  /** Tarea a la que se dedicó el tiempo, o null si fue estudio sin tarea. */
  taskId: string | null;
  minutes: number;
  /** Día local en el que se completó (YYYY-MM-DD). */
  date: string;
}

/** Tarea mínima para nombrar el trabajo. */
export interface StudyTaskLike {
  id: string;
  title: string;
  type?: string | null;
}

/** Un día con los minutos dedicados a un trabajo. */
export interface StudyWorkDay {
  date: string;
  minutes: number;
}

export interface StudyWorkItem {
  /** Clave estable del trabajo: `task:<id>` o `general:`. */
  key: string;
  /** Tarea asociada, o null si fue estudio sin tarea (o de una tarea borrada). */
  taskId: string | null;
  /** Título mostrado: "Estudiar para el examen de X", "Trabajar en Y"… */
  title: string;
  /** Minutos dedicados hoy. */
  minutesToday: number;
  /** Minutos dedicados en total, todos los días. */
  totalMinutes: number;
  /** Minutos por día, del más reciente al más antiguo. */
  byDate: StudyWorkDay[];
}

/** Palabras que ya dicen por sí solas que el elemento es un examen. */
const EXAM_WORD = /^(examen|ex[aá]menes|control|parcial|recuperaci[oó]n|test|prueba)\b/i;

/** Títulos que ya están escritos como un trabajo: no se les añade prefijo. */
const WORK_PHRASE = /^(estudiar|trabajar|repasar|preparar|hacer|practicar)\b/i;

/** Título del trabajo cuando la sesión no tiene tarea (o su tarea se borró). */
export const GENERAL_STUDY_TITLE = "Estudio general";

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/**
 * Título del trabajo tal y como se muestra en el resumen:
 *   examen   → "Estudiar para el examen de Dibujo Técnico"
 *   entrega  → "Trabajar en Práctica 3 de Redes"
 *   el resto → el propio título de la tarea
 * Si el título ya dice que es un examen ("Examen de Dibujo Técnico") no se
 * repite la palabra.
 */
export function studyWorkTitle(task: StudyTaskLike | null | undefined): string {
  const title = task?.title.trim() ?? "";
  if (!task || !title) return GENERAL_STUDY_TITLE;
  // Un título ya escrito como trabajo ("Estudiar para el examen de X") se deja
  // tal cual: encadenar prefijos daba "Estudiar para el examen de Estudiar…".
  if (WORK_PHRASE.test(title)) return title;

  if (task.type === "exam") {
    return EXAM_WORD.test(title)
      ? `Estudiar para el ${lowerFirst(title)}`
      : `Estudiar para el examen de ${title}`;
  }
  if (task.type === "assignment") return `Trabajar en ${title}`;
  return title;
}

/**
 * Título de la tarea de trabajo que crea el Pomodoro cuando empiezas algo que
 * todavía no estaba en la lista: "dibujo técnico" + "examen" → "Estudiar para
 * el examen de dibujo técnico".
 *
 * `kind` es el tipo de tarea (`exam`, `assignment` o `study_session`). Si el
 * usuario ya escribe la frase como un trabajo ("estudiar mates"), se respeta.
 */
export function composeWorkTitle(kind: string, name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return "";
  if (WORK_PHRASE.test(clean)) return clean;

  if (kind === "exam") {
    return EXAM_WORD.test(clean)
      ? `Estudiar para el ${lowerFirst(clean)}`
      : `Estudiar para el examen de ${clean}`;
  }
  if (kind === "assignment") return `Trabajar en ${clean}`;
  return `Estudiar ${clean}`;
}

/**
 * Aviso al completarse solo un examen que ya ha pasado su día. Evita el
 * "examen de Examen de…" cuando el título ya lo dice.
 */
export function examCompletedMessage(title: string): string {
  const clean = title.trim() || "tu examen";
  return EXAM_WORD.test(clean)
    ? `Has completado el ${lowerFirst(clean)}`
    : `Has completado el examen de ${clean}`;
}

/**
 * Agrupa las sesiones de estudio por trabajo y calcula los minutos de hoy y el
 * total. Ordena primero lo que has trabajado hoy y, después, lo que más tiempo
 * lleva acumulado.
 *
 * Una sesión cuya tarea ya no existe (borrada) cae en "Estudio general", así
 * que su tiempo sigue contando en los totales y nunca desaparece.
 */
export function summarizeStudy(
  entries: readonly StudyEntry[],
  tasks: readonly StudyTaskLike[],
  today: string,
): StudyWorkItem[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const grouped = new Map<
    string,
    { taskId: string | null; title: string; byDate: Map<string, number> }
  >();

  for (const entry of entries) {
    if (!entry || !Number.isFinite(entry.minutes) || entry.minutes <= 0) continue;
    const task = entry.taskId ? taskById.get(entry.taskId) : undefined;
    const key = task ? `task:${task.id}` : "general:";
    const item =
      grouped.get(key) ?? {
        taskId: task ? task.id : null,
        title: studyWorkTitle(task),
        byDate: new Map<string, number>(),
      };
    item.byDate.set(entry.date, (item.byDate.get(entry.date) ?? 0) + entry.minutes);
    grouped.set(key, item);
  }

  return [...grouped.entries()]
    .map(([key, item]) => {
      const byDate = [...item.byDate.entries()]
        .map(([date, minutes]) => ({ date, minutes }))
        .sort((a, b) => b.date.localeCompare(a.date));
      return {
        key,
        taskId: item.taskId,
        title: item.title,
        minutesToday: item.byDate.get(today) ?? 0,
        totalMinutes: byDate.reduce((acc, day) => acc + day.minutes, 0),
        byDate,
      };
    })
    .sort(
      (a, b) =>
        b.minutesToday - a.minutesToday ||
        b.totalMinutes - a.totalMinutes ||
        a.title.localeCompare(b.title),
    );
}
