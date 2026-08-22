import { convertToModelMessages, isStepCount, streamText } from "ai";
import { getModel } from "@/lib/ai/provider";
import { buildSecretarySystemPrompt } from "@/lib/ai/prompts";
import { buildContextText } from "@/lib/ai/context";
import { isAiConfigured } from "@/lib/env";
import { hasApiKey, type AiSettings } from "@/lib/ai/settings";
import type { SecretaryContext } from "@/lib/ai/types";
import { secretaryTools } from "@/lib/ai/tools";

export const maxDuration = 60;

/**
 * Chat con streaming del Secretario IA usando Vercel AI SDK.
 * El cliente envía `messages` (UIMessages) junto con `context` (datos reales del
 * usuario) y `settings` (proveedor/modelo/clave elegidos en Ajustes).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messages, context, settings } = body ?? {};

    const configured =
      (settings ? hasApiKey(settings as AiSettings) : false) || isAiConfigured();

    if (!configured) {
      return new Response(
        "La IA no está configurada. Ve a Ajustes y añade tu API key.",
        { status: 501 },
      );
    }

    const assistantName = (settings as AiSettings)?.assistantName || "Núcleo";
    const baseSystemPrompt = buildSecretarySystemPrompt(assistantName);
    const contextText = context ? buildContextText(context as SecretaryContext) : "";
    const modelMessages = await convertToModelMessages(messages ?? []);

    const result = streamText({
      model: getModel(settings as AiSettings | undefined),
      system: contextText
        ? `${baseSystemPrompt}\n\n## Contexto actual del usuario\n${contextText}`
        : baseSystemPrompt,
      messages: modelMessages,
      tools: secretaryTools,
      stopWhen: isStepCount(5),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Error en /api/chat:", error);
    const message =
      error instanceof Error ? error.message : "Error inesperado al generar respuesta.";
    return new Response(message, { status: 500 });
  }
}
