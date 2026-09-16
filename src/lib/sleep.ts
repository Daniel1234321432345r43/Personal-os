// Utilidades del módulo de Sueño: objetivo por defecto, horas dormidas y
// niveles de cumplimiento (una única fuente para el color de las gráficas y
// para el XP que otorga xp-system).

import type { SleepSettings } from "@/lib/types";

/** Objetivo por defecto cuando el usuario todavía no ha configurado nada. */
export const DEFAULT_SLEEP_SETTINGS: SleepSettings = {
  target_hours: 8,
  bedtime: "23:00",
  wake_time: "07:00",
  reminder_enabled: true,
};

/** Minutos de antelación con los que se avisa antes de la hora de dormir. */
export const SLEEP_REMINDER_MINUTES = 15;

/** Niveles de cumplimiento del objetivo de sueño, de mejor a peor. */
export type SleepLevel = "perfect" | "partial" | "low" | "bad";

/**
 * Clasifica una noche según las horas dormidas y el objetivo del usuario.
 * Los márgenes son tolerantes a propósito, porque nadie se acuesta al minuto:
 *   - perfect: cumple el objetivo (con 15 min de margen) → verde
 *   - partial: hasta 1,5 h por debajo (ej. 7 h con meta de 8 h) → amarillo
 *   - low: hasta 2,5 h por debajo → naranja
 *   - bad: más de 2,5 h por debajo (incumplimiento severo) → rojo
 */
export function sleepLevel(hours: number, target = DEFAULT_SLEEP_SETTINGS.target_hours): SleepLevel {
  const gap = target - hours;
  if (gap <= 0.25) return "perfect";
  if (gap <= 1.5) return "partial";
  if (gap <= 2.5) return "low";
  return "bad";
}

/** Color de relleno (Tailwind) de cada nivel, compartido por barras y heatmap. */
export const SLEEP_LEVEL_CLASS: Record<SleepLevel, string> = {
  perfect: "bg-emerald-500",
  partial: "bg-amber-400",
  low: "bg-orange-500",
  bad: "bg-red-500",
};

/** Etiqueta corta de cada nivel para leyendas y avisos. */
export const SLEEP_LEVEL_LABEL: Record<SleepLevel, string> = {
  perfect: "Objetivo cumplido",
  partial: "Casi (algo por debajo)",
  low: "Insuficiente",
  bad: "Muy insuficiente",
};

/** Mismo color en `stroke` (SVG) que SLEEP_LEVEL_CLASS, para el dial circular. */
export const SLEEP_LEVEL_STROKE: Record<SleepLevel, string> = {
  perfect: "#10b981",
  partial: "#fbbf24",
  low: "#f97316",
  bad: "#ef4444",
};

/** Duración mínima y máxima del arco de sueño (minutos). */
export const SLEEP_MIN_DURATION_MINUTES = 30;
export const SLEEP_MAX_DURATION_MINUTES = 16 * 60;

/** Minutos desde medianoche → "HH:MM" (admite valores fuera de 0-1439). */
export function minutesToTime(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Redondea minutos al paso indicado (5 min por defecto, como Apple Salud). */
export function snapMinutes(minutes: number, step = 5): number {
  return Math.round(minutes / step) * step;
}

/** Diferencia firmada más corta entre dos minutos del día (-720 a 720). */
export function signedMinuteDelta(to: number, from: number): number {
  return ((to - from + 720 + 1440) % 1440) - 720;
}

/** XP que corresponde a cada nivel (debe coincidir con SLEEP_XP de xp-system). */
export const SLEEP_XP_LABEL: Record<SleepLevel, string> = {
  perfect: "+15 XP",
  partial: "+5 XP",
  low: "0 XP",
  bad: "−5 XP",
};

/** Horas entre dos horas "HH:MM" (admite acostarse y despertar en días distintos). */
export function hoursBetween(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  if (![bh, bm, wh, wm].every((n) => Number.isFinite(n))) return 0;
  const from = bh * 60 + bm;
  let to = wh * 60 + wm;
  if (to <= from) to += 24 * 60; // la noche cruza la medianoche
  return Math.round(((to - from) / 60) * 100) / 100;
}

/** Redondea horas a dos decimales (evita 7.499999 en el estado y en la BD). */
export function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

/** "HH:MM" → minutos desde medianoche; null si no es válida. */
export function timeToMinutes(value: string | null | undefined): number | null {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Clave de fecha local (YYYY-MM-DD) de un objeto Date. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Suma (o resta) días a una clave de fecha YYYY-MM-DD. */
export function addDays(dateKeyStr: string, days: number): string {
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dateKey(dt);
}

/** Lunes de la semana (YYYY-MM-DD) a la que pertenece una fecha. */
export function mondayOf(dateKeyStr: string): string {
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const weekday = (dt.getDay() + 6) % 7; // 0 = lunes
  return addDays(dateKeyStr, -weekday);
}

/** Las 7 fechas (lunes → domingo) de la semana de una fecha. */
export function weekKeys(dateKeyStr: string): string[] {
  const monday = mondayOf(dateKeyStr);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
