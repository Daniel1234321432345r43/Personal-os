// =============================================================================
// Utilidades de fecha/hora para los recordatorios (Edge Functions de Supabase).
// Aisladas en _shared/ para poder probarlas desde Node (scripts/...).
// Son defensivas: nunca lanzan excepciones por valores inválidos, devuelven
// null o un respaldo seguro (evita el error 500 "Invalid time value").
// =============================================================================

/** Normaliza una fecha a "YYYY-MM-DD" o null si no es válida. */
export function normalizeDate(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const d = new Date(`${match[0]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : match[0];
}

/** Normaliza una hora ("14:30", "14:30:00"...) a "HH:MM" o null si no es válida. */
export function normalizeTime(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${match[2]}`;
}

/** Clave de fecha (YYYY-MM-DD) en la zona horaria dada. Respaldo: UTC. */
export function dateKeyInTz(date, tz) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    // Zona horaria inválida en el perfil: respaldo a UTC.
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Convierte (fecha YYYY-MM-DD, hora HH:MM) al Date UTC cuya hora local en la
 * zona del usuario coincide con la deseada. Devuelve null si la entrada no es
 * válida y nunca lanza (respaldo final: interpretar la hora como UTC).
 */
export function zonedDateTime(dateStr, timeStr, tz) {
  if (typeof dateStr !== "string" || typeof timeStr !== "string") return null;
  const target = `${dateStr}T${timeStr.slice(0, 5)}:00`;
  const guess = new Date(`${target}Z`).getTime();
  if (!Number.isFinite(guess)) return null;

  // Busca el timestamp UTC cuya hora local en tz coincide con la deseada.
  for (let delta = -86400000; delta <= 86400000; delta += 3600000) {
    const d = new Date(guess + delta);
    if (Number.isNaN(d.getTime())) continue;
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(d);
      const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
      if (`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}` === target) {
        return d;
      }
    } catch {
      // Zona horaria inválida u otro problema de formateo: probar el siguiente offset.
      continue;
    }
  }
  return new Date(target); // Respaldo: interpretar la hora como UTC.
}
