// =============================================================================
// Pregunta de la mañana: «¿Cuánto has dormido?»
//
// De lunes a viernes a las 07:15 (hora local del usuario) el cron pregunta por
// la noche que acaba de terminar. Al pulsar la notificación se abre la app en
// /sueno con el formulario de «Registrar una noche» ya abierto y la fecha de
// hoy puesta, así que solo hay que escribir las horas.
//
// Aislado en _shared/ para poder probarlo desde Node
// (scripts/test-sleep-check.mjs) sin depender de Deno.
// =============================================================================

import { zonedDateTime } from "./reminder-time.js";
// Misma noción de día de la semana que usa la pregunta del entreno (0 = domingo).
import { weekdayOfKey } from "./workout-check.js";

/** Hora local de la pregunta: el despertar de un día de diario. */
export const SLEEP_CHECK_LOCAL_TIME = "07:15";

/**
 * Margen para recuperar la pregunta si el cron arranca con retraso. Nunca sale
 * antes de las 07:15 (si el tick se adelanta, se espera al siguiente); lo que
 * hace este margen es que un cron que arranca a las 07:40 todavía pregunte.
 */
export const SLEEP_CHECK_WINDOW_AFTER_MS = 60 * 60 * 1000;

/** Días de la semana con pregunta: lunes (1) a viernes (5). */
export const SLEEP_CHECK_WEEKDAYS = [1, 2, 3, 4, 5];

/** ¿Ese día cae de lunes a viernes? Una fecha ilegible no pregunta. */
export function isWeekdayKey(dateKey) {
  const weekday = weekdayOfKey(dateKey);
  return weekday !== null && SLEEP_CHECK_WEEKDAYS.includes(weekday);
}

/**
 * Instante UTC de las 07:15 locales de ese día, o null si la fecha no es una
 * clave YYYY-MM-DD válida (así una fila corrupta no genera un aviso a medias).
 */
export function sleepCheckTarget(dateKey, tz) {
  if (weekdayOfKey(dateKey) === null) return null;
  return zonedDateTime(dateKey, SLEEP_CHECK_LOCAL_TIME, tz);
}

/** ¿Toca ya preguntar? (de 07:15 en adelante, con hora y media de recuperación). */
export function isSleepCheckWindow(now, target) {
  if (!now || !target) return false;
  const diff = now.getTime() - target.getTime();
  return diff >= 0 && diff <= SLEEP_CHECK_WINDOW_AFTER_MS;
}

/** Texto de la notificación, con el objetivo de horas del usuario. */
export function sleepCheckMessage(targetHours) {
  const hours = Number(targetHours);
  const objetivo = Number.isFinite(hours) && hours > 0 ? hours : 8;
  return `¿Cuánto has dormido esta noche? Apunta tus horas y mira si cumples tu objetivo de ${objetivo} h.`;
}

/**
 * URL que abre la app en el registro de esa noche. `fecha` es el día del
 * despertar, que es como se guardan las noches en sleep_logs.
 */
export function sleepCheckUrl(dateKey) {
  const params = new URLSearchParams({ registrar: "1", fecha: dateKey });
  return `/sueno?${params.toString()}`;
}

/** Clave del aviso para no repetirlo: la fecha local de la mañana. */
export function sleepCheckEntityId(dateKey) {
  return dateKey;
}

/**
 * ¿Ya está registrada esa noche? Si el usuario apuntó sus horas antes de las
 * 07:15 (o al acostarse ya dejó la noche cerrada), no se le pregunta nada.
 */
export function hasLoggedSleep(logs, dateKey) {
  return (logs ?? []).some(
    (log) => log && typeof log.date === "string" && log.date.slice(0, 10) === dateKey,
  );
}
