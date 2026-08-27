import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode } from "@/lib/classroom/client";

/**
 * Callback de OAuth de Google Classroom. Intercambia el código por tokens y
 * los guarda en `public.google_tokens` asociados al usuario autenticado.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/academic?classroom=error", url.origin),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL("/academic?classroom=login", url.origin),
    );
  }

  try {
    const redirectUri =
      process.env.GOOGLE_CLASSROOM_REDIRECT_URI ??
      `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/classroom/oauth/callback`;

    const tokens = await exchangeCode(code, redirectUri);

    const { error: upsertError } = await supabase.from("google_tokens").upsert(
      {
        user_id: user.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (upsertError) throw upsertError;

    return NextResponse.redirect(
      new URL("/academic?classroom=connected", url.origin),
    );
  } catch {
    return NextResponse.redirect(
      new URL("/academic?classroom=error", url.origin),
    );
  }
}
