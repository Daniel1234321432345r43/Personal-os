import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 30;

/**
 * Borra la cuenta del usuario autenticado:
 * 1. Elimina todas sus filas en las tablas (con el admin client, ignora RLS
 *    como salvaguarda por si el resetAll() del cliente falló).
 * 2. Elimina el usuario de Supabase Auth (auth.admin.deleteUser).
 *
 * No acepta userId del body: lo obtiene de la sesión para que un usuario
 * no pueda borrar la cuenta de otro.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: sessionError } = await supabase.auth.getUser();

    if (sessionError || !user) {
      return Response.json(
        { ok: false, error: "No hay sesión activa." },
        { status: 401 },
      );
    }

    const userId = user.id;
    const admin = createAdminClient();

    // 1. Borrar datos del usuario en todas las tablas (salvaguarda).
    const TABLES = [
      "subjects",
      "tasks",
      "notes",
      "workouts",
      "habits",
      "habit_completions",
      "transactions",
      "grades",
      "budgets",
      "tree_progress",
      "tree_xp_events",
    ] as const;

    for (const table of TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", userId);
      if (error) {
        console.error(`[account/delete] borrar ${table}:`, error.message);
      }
    }

    // 2. Eliminar el usuario de Auth.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[account/delete] deleteUser:", deleteError.message);
      return Response.json(
        { ok: false, error: "No se pudo eliminar la cuenta de usuario." },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Error desconocido al borrar la cuenta.";
    console.error("[account/delete] excepción:", message);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
