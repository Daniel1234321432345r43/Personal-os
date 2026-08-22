import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente con la SERVICE ROLE KEY: ignora RLS. Usar SOLO en el servidor y
 * nunca exponerlo al cliente. Requiere SUPABASE_SERVICE_ROLE_KEY.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
