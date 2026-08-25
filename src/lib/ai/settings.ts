// Configuración de IA elegida por el usuario en la página "Ajustes".
// Se guarda en localStorage (el usuario confirmó que prefiere clave local) y se
// envía al backend en cada petición para construir el modelo.

export type AiProviderId =
  | "openai"
  | "google"
  | "anthropic"
  | "omniroute"
  | "custom";

export interface AiSettings {
  provider: AiProviderId;
  apiKey: string;
  model: string;
  baseURL: string;
  assistantName?: string;
  /** Nombre del usuario: saludo personalizado en el dashboard. */
  userName?: string;
  /** Minutos de sesión de trabajo del temporizador Pomodoro. */
  pomodoroWorkMinutes?: number;
  /** Minutos de descanso del temporizador Pomodoro. */
  pomodoroBreakMinutes?: number;
}

export const DEFAULT_SETTINGS: AiSettings = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
  baseURL: "",
  assistantName: "Núcleo",
  userName: "",
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const STORAGE_KEY = "nucleo:ai-settings:v1";

export function loadSettings(): AiSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      assistantName: parsed.assistantName?.trim() || "Núcleo",
      userName:
        typeof parsed.userName === "string" ? parsed.userName.trim() : "",
      pomodoroWorkMinutes: clampInt(parsed.pomodoroWorkMinutes, 1, 120, 25),
      pomodoroBreakMinutes: clampInt(parsed.pomodoroBreakMinutes, 1, 60, 5),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AiSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignorar errores de cuota o serialización.
  }
}

/** Devuelve true si hay una clave para el proveedor elegido (el usuario la escribió). */
export function hasApiKey(settings: AiSettings): boolean {
  if (settings.provider === "omniroute") {
    return Boolean(settings.apiKey.trim() || settings.baseURL.trim());
  }
  return Boolean(settings.apiKey.trim());
}
