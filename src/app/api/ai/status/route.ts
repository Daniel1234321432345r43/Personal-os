import { envProvider, isAiConfigured } from "@/lib/env";

/** Informa al cliente si el servidor tiene una clave de IA en .env (fallback). */
export async function GET() {
  return Response.json({
    configured: isAiConfigured(),
    provider: envProvider(),
  });
}
