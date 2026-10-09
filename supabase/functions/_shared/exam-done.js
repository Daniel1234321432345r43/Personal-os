// =============================================================================
// Cierre automático de exámenes: el examen del día se da por hecho a las 17:00
// (hora local del usuario) y se avisa con "Examen completado".
//
// Aislado en _shared/ para poder probarlo desde Node (scripts/test-exam-done.mjs)
// y sin depender de Deno ni del alias `@/`.
//
// El cliente hace lo mismo cuando la app se abre y el examen ya pasó de día
// (src/lib/exam-autoclose.tsx), pero eso no sirve si nadie abre la app: el
// aviso a las 17:00 lo manda esta función desde el cron de send-reminders.
// =============================================================================

import {
  dateKeyInTz,
  normalizeDate,
  normalizeTime,
  zonedDateTime,
} from "./reminder-time.js";

/** Hora local a la que se cierra el examen del día: 5 de la tarde. */
export const EXAM_DONE_LOCAL_TIME = "17:00";

/**
 * Margen para recuperar el aviso si el cron se retrasa (Supabase puede arrancar
 * una ejecución tarde). Dentro de esta ventana se puede cerrar el examen; fuera,
 * se deja para el día siguiente o para el cliente al abrir la app.
 */
export const EXAM_DONE_WINDOW_AFTER_MS = 30 * 60 * 1000;

/** XP que da completar una tarea (XP_REWARDS.task en src/lib/xp-system.tsx). */
export const EXAM_DONE_XP = 20;

/** Origen del evento de XP compartido (TASK_SOURCE en /api/xp/events). */
export const EXAM_DONE_SOURCE = "task_completed";

/** Palabras que ya dicen por sí solas que el elemento es un examen. */
const EXAM_WORD = /^(examen|ex[aá]menes|control|parcial|recuperaci[oó]n|test|prueba)\b/i;

/**
 * Artículo de cada palabra de examen. «Recuperación» y «prueba» son femeninas:
 * con un "el" fijo salía «Has completado el recuperación de mates».
 */
const EXAM_ARTICLES = {
  "recuperación": "la",
  recuperacion: "la",
  prueba: "la",
};

function lowerFirst(value) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

/**
 * Mensaje del aviso al completarse un examen. Mismo texto que
 * `examCompletedMessage` de src/lib/study-summary.ts: el usuario ve lo mismo
 * tanto si lo cierra el servidor como si lo cierra la app.
 */
export function examDoneMessage(title) {
  const clean = typeof title === "string" ? title.trim() : "";
  if (!clean) return "Has completado el examen";
  const match = clean.match(EXAM_WORD);
  if (!match) return `Has completado el examen de ${clean}`;
  const article = EXAM_ARTICLES[match[1].toLowerCase()] ?? "el";
  return `Has completado ${article} ${lowerFirst(clean)}`;
}

/**
 * Día local del usuario y el instante UTC en el que toca cerrar sus exámenes.
 * Devuelve `target: null` si la zona horaria no permite calcular la hora.
 */
export function examDoneTarget(now, tz) {
  const dateKey = dateKeyInTz(now, tz);
  const target = zonedDateTime(dateKey, EXAM_DONE_LOCAL_TIME, tz);
  return { dateKey, target: target ?? null };
}

/** ¿Toca ya cerrar los exámenes? (a partir de las 17:00 locales, con margen). */
export function isExamDoneWindow(now, target) {
  if (!now || !target) return false;
  const diff = now.getTime() - target.getTime();
  return diff >= 0 && diff <= EXAM_DONE_WINDOW_AFTER_MS;
}

/**
 * ¿El examen ya ha empezado cuando llegamos a las 17:00?
 *
 * Un examen sin hora se da por hecho a las 17:00 (es lo normal: se apunta con su
 * día). Uno con hora posterior —a las 18:00— todavía no ha ocurrido, así que no
 * se cierra: de eso se encarga la app cuando el día haya terminado.
 */
export function examAlreadyStarted(exam, now, tz) {
  const startTime = normalizeTime(exam?.start_time);
  if (!startTime) return true;

  const dateStr = normalizeDate(exam?.due_date);
  if (!dateStr) return true;

  const scheduled = zonedDateTime(dateStr, startTime, tz);
  if (!scheduled) return true;

  return scheduled.getTime() <= now.getTime();
}

/**
 * Exámenes del día que hay que cerrar: pendientes, de hoy (en la zona del
 * usuario) y que ya hayan empezado. Nunca lanza: una fila corrupta se descarta.
 */
export function selectExamsToComplete(exams, dateKey, now, tz) {
  const selected = [];
  for (const exam of exams ?? []) {
    try {
      if (!exam || exam.type !== "exam") continue;
      if (exam.status === "done") continue;
      if (normalizeDate(exam.due_date) !== dateKey) continue;
      if (!examAlreadyStarted(exam, now, tz)) continue;
      selected.push(exam);
    } catch {
      // Fila ilegible: lo único seguro es no tocarla.
    }
  }
  return selected;
}
