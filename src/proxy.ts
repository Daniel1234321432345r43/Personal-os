import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Proxy (antes "middleware") de Next.js 16.
 * Refresca la sesión de Supabase (rotación de cookies).
 *
 * Nota: NO protege rutas a propósito. La app funciona en modo local sin
 * sesión (botón "Hacer más tarde" del onboarding), y la redirección del
 * primer acceso a /login la gestiona OnboardingGate en el cliente. La
 * autorización real la impone Supabase mediante Row Level Security.
 */
export async function proxy(request: NextRequest) {
  // Sin Supabase configurado → modo demo.
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca la sesión si expiró (renueva las cookies de sesión).
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
