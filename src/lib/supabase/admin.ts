import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Indica si el servidor tiene configurada la SERVICE ROLE KEY.
 */
export function hasAdminClient(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Cliente con la SERVICE ROLE KEY: ignora RLS. Usar SOLO en el servidor y
 * nunca exponerlo al cliente. Si no está configurada, utiliza la ANON KEY como
 * respaldo seguro en lugar de romper el servidor con una excepción.
 */
export function createAdminClient() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
