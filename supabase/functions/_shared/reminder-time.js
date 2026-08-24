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
  // target SOLO con HH:MM (sin segundos): el match del bucle compara contra él.
  const target = `${dateStr}T${timeStr.slice(0, 5)}`;
  // guess SIEMPRE con Z explícito: sin él, "YYYY-MM-DDTHH:MM" se parsea como
  // hora LOCAL del runtime (Europe/Madrid en local, UTC en Deno Deploy) y el
  // resultado depende de dónde se ejecute.
  const guess = new Date(`${target}:00Z`).getTime();
  if (!Number.isFinite(guess)) return null;

  // Busca el timestamp UTC cuya hora local en tz coincide con la deseada.
  // Causa raíz del bug de recordatorios 2 h tarde: target incluía ":00"
  // (segundos) pero el string del match no → la comparación nunca era igual →
  // SIEMPRE caía al respaldo, que además usaba new Date(sin Z) y por tanto se
  // parseaba como hora LOCAL del runtime (correcto por casualidad en una
  // máquina Madrid, 2 h tarde en el runtime UTC de Deno Deploy).
  // hour12:true + dayPeriod se usa por portabilidad con cualquier ICU.
  for (let delta = -86400000; delta <= 86400000; delta += 3600000) {
    const d = new Date(guess + delta);
    if (Number.isNaN(d.getTime())) continue;
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).formatToParts(d);
      const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
      let hour = Number(get("hour"));
      if (Number.isNaN(hour)) continue;
      // Normalizar a 24 h a partir de AM/PM. Si el runtime ignora hour12 y ya
      // devuelve 0-23, la normalización no cambia nada (dayPeriod vacío).
      const period = get("dayPeriod");
      if (period === "PM" && hour < 12) hour += 12;
      else if (period === "AM" && hour === 12) hour = 0;
      const hh = String(hour).padStart(2, "0");
      const mm = get("minute");
      if (`${get("year")}-${get("month")}-${get("day")}T${hh}:${mm}` === target) {
        return d;
      }
    } catch {
      // Zona horaria inválida u otro problema de formateo: probar el siguiente offset.
      continue;
    }
  }
  return new Date(`${target}:00Z`); // Respaldo determinista: interpretar la hora como UTC.
}
