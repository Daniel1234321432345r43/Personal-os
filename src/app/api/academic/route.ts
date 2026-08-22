import { generateObject, jsonSchema } from "ai";
import { getModel } from "@/lib/ai/provider";
import { buildAcademicPrompt } from "@/lib/ai/prompts";
import { isAiConfigured } from "@/lib/env";
import type { AcademicAdvice, SecretaryContext } from "@/lib/ai/types";
import { hasApiKey, type AiSettings } from "@/lib/ai/settings";

export const maxDuration = 60;

const adviceSchema = jsonSchema<AcademicAdvice>({
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Resumen general de 2-3 frases priorizando lo más urgente.",
    },
    recommendations: {
      type: "array",
      description: "Una recomendación concreta por cada plazo pendiente.",
      items: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "El mismo id de la tarea del plazo.",
          },
          advice: {
            type: "string",
            description: "Qué estudiar primero y cómo repartir el tiempo.",
          },
        },
        required: ["id", "advice"],
      },
    },
  },
  required: ["summary", "recommendations"],
});

/**
 * Asistente académico: por cada entrega/examen pendiente devuelve una
 * recomendación de estudio concreta y un resumen priorizado.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { context, settings } = body ?? {};

  const configured =
    (settings ? hasApiKey(settings as AiSettings) : false) || isAiConfigured();

  if (!configured) {
    return new Response(
      "La IA no está configurada. Ve a Ajustes y añade tu API key.",
      { status: 501 },
    );
  }

  const { object } = await generateObject({
    model: getModel(settings as AiSettings | undefined),
    schemaName: "recomendaciones_academicas",
    schemaDescription:
      "Recomendaciones de estudio por plazo, con resumen priorizado.",
    schema: adviceSchema,
    prompt: buildAcademicPrompt(context as SecretaryContext),
  });

  return Response.json(object);
}
