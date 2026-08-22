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
}

export const DEFAULT_SETTINGS: AiSettings = {
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
  baseURL: "",
  assistantName: "Núcleo",
};

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
