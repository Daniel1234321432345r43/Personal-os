/** Límite diario de XP por defecto. */
export const DAILY_CAP = 120;

const XP_CAP_KEY = "nucleo:xp-cap-disabled";

/** true si el usuario desactivó el límite diario de XP (para probar el bosque). */
export function isXpCapDisabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(XP_CAP_KEY) === "1";
  } catch {
    /* Almacenamiento no disponible. */
  }
  return false;
}

/** Activa o desactiva el límite diario de XP. */
export function setXpCapDisabled(disabled: boolean): void {
  try {
    if (disabled) localStorage.setItem(XP_CAP_KEY, "1");
    else localStorage.removeItem(XP_CAP_KEY);
  } catch {
    /* Almacenamiento no disponible. */
  }
}

/** Tope efectivo del día: sin límite si el usuario lo desactivó. */
export function effectiveXpCap(): number {
  return isXpCapDisabled() ? Number.MAX_SAFE_INTEGER : DAILY_CAP;
}
