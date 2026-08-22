// Comprobaciones de entorno (variables de servidor).
// Permiten que la app arranque en "modo demo" sin claves configuradas y pase a
// producción automáticamente cuando se añaden las variables de entorno.
import type { AiProviderId } from "@/lib/ai/settings";

export const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

/** Devuelve el proveedor de IA activo según la configuración del servidor (.env). */
export function envProvider(): AiProviderId {
  const explicit = process.env.AI_PROVIDER;
  if (
    explicit === "openai" ||
    explicit === "google" ||
    explicit === "anthropic" ||
    explicit === "omniroute"
  ) {
    return explicit;
  }
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return "google";
  if (
    process.env.OMNIROUTE_AUTH_TOKEN ||
    process.env.OMNIROUTE_API_KEY ||
    process.env.OMNIROUTE_BASE_URL
  ) {
    return "omniroute";
  }
  return "openai";
}

/** Devuelve la clave del proveedor desde el entorno del servidor (si existe). */
export function envApiKey(provider: AiProviderId): string | undefined {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "google":
      return process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "omniroute":
      return process.env.OMNIROUTE_AUTH_TOKEN || process.env.OMNIROUTE_API_KEY;
    default:
      return undefined;
  }
}

/** Devuelve true si el servidor tiene alguna clave de IA configurada en .env. */
export const isAiConfigured = () =>
  Boolean(
    process.env.OPENAI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OMNIROUTE_AUTH_TOKEN ||
      process.env.OMNIROUTE_API_KEY ||
      process.env.OMNIROUTE_BASE_URL,
  );
