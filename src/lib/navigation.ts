/**
 * Fuente única de verdad de las pestañas de la Bottom Navigation Bar (móvil).
 *
 * El gesto de swipe (useSwipeNav) y la barra inferior DEBEN derivarse siempre
 * de esta lista para no desincronizarse. Rutas como /pomodoro y /notes quedan
 * fuera a propósito: solo son accesibles desde la sidebar/sheet, nunca por
 * swipe. El orden es el orden de navegación estricto (izq → derecha).
 */
export const BOTTOM_NAV_ROUTES = [
  "/dashboard", // 1. Hoy
  "/calendar", // 2. Calendario
  "/academic", // 3. Estudios
  "/sport", // 4. Deporte
  "/finance", // 5. Finanzas
  "/settings", // 6. Ajustes
] as const;
