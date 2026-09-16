// Utilidades de formato (moneda y fechas) en español.

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/**
 * Convierte una fecha a `Date` respetando el día que el usuario ve.
 * Las claves de fecha (YYYY-MM-DD) se interpretan como fecha LOCAL: si se
 * pasaran a `new Date(iso)` se leerían como medianoche UTC y en zonas al oeste
 * de Greenwich se mostrarían con un día menos.
 */
function toDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
  }).format(toDate(iso));
}

export function formatDateLong(iso: string): string {
  const formatted = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(toDate(iso));
  // El día de la semana va en mayúscula inicial: "Lunes, 25 de agosto".
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Fecha de hoy en clave local (YYYY-MM-DD), respetando la zona horaria. */
export function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Convierte un instante ISO (UTC) a la clave del día LOCAL (YYYY-MM-DD).
 *  Útil para atribuir `updated_at` (que viaja en UTC) al día que el usuario
 *  ve en su navegador, igual que hace `todayKey()`. */
export function localDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
