// Flujo de primer acceso: la primera vez que se abre la app se muestra la
// pantalla de inicio de sesión / registro con un botón "Omitir". Solo después
// de ese paso (o de omitirlo) se pide el nombre del usuario.
// El flag vive en localStorage porque el login es opcional (modo local).

const ONBOARDING_KEY = "nucleo:onboarding-done:v1";

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingComplete(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // Ignorar errores de cuota o almacenamiento deshabilitado.
  }
}
