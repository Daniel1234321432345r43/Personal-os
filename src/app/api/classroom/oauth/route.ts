import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/classroom/client";

/**
 * Inicia el flujo OAuth de Google Classroom.
 * El botón "Conectar Google Classroom" apunta a esta ruta.
 */
export async function GET() {
  const redirectUri =
    process.env.GOOGLE_CLASSROOM_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/classroom/oauth/callback`;

  // En producción, valida este `state` en el callback para evitar CSRF.
  const state = crypto.randomUUID();

  const authUrl = buildAuthUrl(redirectUri, state);
  return NextResponse.redirect(authUrl);
}
