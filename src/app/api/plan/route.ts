import { generateObject, jsonSchema } from "ai";
import { getModel } from "@/lib/ai/provider";
import { buildPlanPrompt } from "@/lib/ai/prompts";
import { isAiConfigured } from "@/lib/env";
import type { DayPlan, SecretaryContext } from "@/lib/ai/types";
import { hasApiKey, type AiSettings } from "@/lib/ai/settings";

export const maxDuration = 60;

const planSchema = jsonSchema<DayPlan>({
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "Resumen de una frase que describa el plan del día.",
    },
    blocks: {
      type: "array",
      description: "Bloques horarios del plan, ordenados cronológicamente.",
      items: {
        type: "object",
        properties: {
          time: { type: "string", description: "Hora de inicio, p.ej. '09:00'" },
          title: { type: "string", description: "Título corto del bloque" },
          detail: { type: "string", description: "Detalle opcional" },
          category: {
            type: "string",
            enum: ["academic", "sport", "finance", "personal", "break"],
          },
          priority: { type: "number", enum: [1, 2, 3] },
        },
        required: ["time", "title", "category", "priority"],
      },
    },
  },
  required: ["summary", "blocks"],
});

/**
 * Genera un "Plan del Día" estructurado y priorizado a partir del contexto
 * del usuario (tareas, notas, hábitos, entrenamientos y finanzas).
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
    schemaName: "plan_del_dia",
    schemaDescription:
      "Plan del día estructurado y priorizado, con bloques horarios.",
    schema: planSchema,
    prompt: buildPlanPrompt(context as SecretaryContext),
  });

  return Response.json(object);
}
