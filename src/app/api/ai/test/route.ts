import { generateText } from "ai";
import { getModel } from "@/lib/ai/provider";
import type { AiSettings } from "@/lib/ai/settings";

export const maxDuration = 60;

/**
 * "Probar conexión": usa los ajustes elegidos para hacer una generación mínima
 * y devuelve si funcionó. Sirve para validar clave, modelo y baseURL.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const settings = body?.settings as AiSettings | undefined;

  try {
    const { text } = await generateText({
      model: getModel(settings),
      prompt: "Responde únicamente con la palabra: ok",
    });
    return Response.json({
      ok: true,
      message: `Conexión correcta con "${settings?.model ?? "modelo"}".`,
      reply: text.trim(),
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error desconocido al probar la conexión.";
    return Response.json({ ok: false, message });
  }
}
