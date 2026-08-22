import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { envApiKey, envProvider } from "@/lib/env";
import { getProvider } from "@/lib/ai/models";
import type { AiSettings } from "@/lib/ai/settings";

/**
 * Devuelve el modelo de lenguaje activo.
 * - Si `settings` trae una `apiKey`, construye el proveedor con esa clave
 *   (el usuario la escribió en "Ajustes" y se guarda en localStorage).
 * - Si no, usa la factoría por defecto, que lee la clave del entorno del
 *   servidor (.env.local), conservando el modo de configuración por variables.
 */
export function getModel(settings?: AiSettings | null) {
  const providerId = settings?.provider ?? envProvider();
  const apiKey = (settings?.apiKey?.trim() || envApiKey(providerId)) ?? "";
  const modelId = settings?.model?.trim() || getProvider(providerId).defaultModel;

  switch (providerId) {
    case "openai": {
      const openai = apiKey ? createOpenAI({ apiKey }) : createOpenAI();
      return openai.chat(modelId);
    }
    case "google": {
      const google = apiKey
        ? createGoogleGenerativeAI({ apiKey })
        : createGoogleGenerativeAI();
      return google(modelId);
    }
    case "anthropic": {
      const anthropic = apiKey
        ? createAnthropic({ apiKey })
        : createAnthropic();
      return anthropic(modelId);
    }
    case "omniroute": {
      let baseURL =
        settings?.baseURL?.trim() ||
        process.env.OMNIROUTE_BASE_URL ||
        "http://localhost:20128/v1";
      baseURL = baseURL.replace(/\/+$/, "");
      if (!baseURL.endsWith("/v1")) {
        baseURL = `${baseURL}/v1`;
      }
      const finalApiKey =
        apiKey ||
        process.env.OMNIROUTE_AUTH_TOKEN ||
        process.env.OMNIROUTE_API_KEY ||
        "omniroute-local";
      const omniroute = createOpenAI({
        apiKey: finalApiKey,
        baseURL,
      });
      return omniroute.chat(modelId);
    }
    case "custom":
    default: {
      const baseURL = settings?.baseURL?.trim() || "";
      const custom = createOpenAI({ apiKey: apiKey || undefined, baseURL });
      return custom.chat(modelId);
    }
  }
}
