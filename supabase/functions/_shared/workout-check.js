// =============================================================================
// Seguimiento de entrenamientos: si hoy tocaba entrenar y ya ha pasado la hora,
// se pregunta «Hoy deberías haber ido a X, ¿has ido?». Al pulsar la
// notificación, la app abre el modal con «Entreno X 60 minutos» y los botones
// «Sí lo he hecho» / «No lo he hecho».
//
// Aislado en _shared/ para poder probarlo desde Node
// (scripts/test-workout-check.mjs) sin depender de Deno.
// =============================================================================

import { normalizeTime, zonedDateTime } from "./reminder-time.js";

/**
 * Margen para recuperar el aviso si el cron arranca con retraso. El aviso sale
 * cuando el entreno ya ha terminado (hora de inicio + duración), no antes.
 */
export const WORKOUT_CHECK_WINDOW_AFTER_MS = 60 * 60 * 1000;

/** Día de la semana (0 = domingo) de una clave de fecha YYYY-MM-DD. */
export function weekdayOfKey(dateKey) {
  const parsed = Date.parse(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).getUTCDay();
}

/** Entrenos programados que tocan ese día de la semana y están activos. */
export function schedulesForDay(schedules, weekday) {
  return (schedules ?? []).filter(
    (s) => s && s.enabled !== false && Number(s.weekday) === weekday,
  );
}

/** Nombre visible de un entreno programado: su título o su actividad. */
export function scheduleName(schedule) {
  const title = typeof schedule?.title === "string" ? schedule.title.trim() : "";
  const activity =
    typeof schedule?.activity_type === "string" ? schedule.activity_type.trim() : "";
  return title || activity || "el entrenamiento";
}

/** Minutos del entreno programado (60 por defecto, como en la app). */
export function scheduleMinutes(schedule) {
  const raw = Number(schedule?.duration_minutes);
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 60;
}

/**
 * Instante UTC en el que el entreno de ese día ya ha terminado (hora + duración).
 * `null` si la fecha, la hora o la zona no permiten calcularlo.
 */
export function workoutCheckTarget(schedule, dateKey, tz) {
  const time = normalizeTime(schedule?.time);
  if (!time) return null;
  const start = zonedDateTime(dateKey, time, tz);
  if (!start) return null;
  return new Date(start.getTime() + scheduleMinutes(schedule) * 60000);
}

/** ¿Toca ya preguntar por el entreno? (ha terminado, con margen de recuperación). */
export function isWorkoutCheckWindow(now, target) {
  if (!now || !target) return false;
  const diff = now.getTime() - target.getTime();
  return diff >= 0 && diff <= WORKOUT_CHECK_WINDOW_AFTER_MS;
}

/** Texto de la notificación. */
export function workoutCheckMessage(schedule) {
  return `Hoy deberías haber ido a ${scheduleName(schedule)}, ¿has ido?`;
}

/**
 * URL que abre la app con el modal de confirmación. Lleva los datos del entreno
 * para que el modal funcione aunque el plan haya cambiado después del aviso.
 */
export function workoutCheckUrl(schedule, dateKey) {
  const params = new URLSearchParams({
    entreno: "1",
    nombre: scheduleName(schedule),
    min: String(scheduleMinutes(schedule)),
    fecha: dateKey,
  });
  if (schedule?.id) params.set("plan", String(schedule.id));
  return `/dashboard?${params.toString()}`;
}

/** Clave del aviso para no repetirlo (una pregunta por plan y día). */
export function workoutCheckEntityId(schedule, dateKey) {
  return `${schedule?.id ?? scheduleName(schedule)}:${dateKey}`;
}

/**
 * ¿Ya hay un entreno apuntado ese día que corresponde a este plan? Evita
 * preguntar por algo que el usuario ya registró por su cuenta.
 */
export function hasLoggedWorkout(workouts, schedule, dateKey) {
  // Se compara tanto la actividad como el título del plan: el usuario puede
  // haber apuntado el entreno como «Gimnasio» aunque el plan se llame «Pierna».
  const candidates = [schedule?.activity_type, schedule?.title]
    .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
    .filter(Boolean);
  if (candidates.length === 0) return false;

  return (workouts ?? []).some((w) => {
    if (!w || w.date !== dateKey) return false;
    const logged = [w.activity_type, w.title]
      .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
      .filter(Boolean);
    if (logged.length === 0) return false;
    return candidates.some((c) =>
      logged.some((l) => l === c || l.includes(c) || c.includes(l)),
    );
  });
}
