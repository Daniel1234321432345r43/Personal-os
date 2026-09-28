import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Avisos compartidos de tareas completadas.
 *
 * Cuando una tarea se marca como hecha, el dispositivo que la completa deja
 * constancia aquí. Los demás dispositivos de la cuenta leen lo nuevo al abrir
 * la app y muestran el mensaje de "tarea completada" (con su XP), así que
 * completar algo en el ordenador también se ve en el móvil.
 *
 * Se guarda en `tree_xp_events` (migración 00012): ya tiene exactamente la
 * forma que hace falta —usuario, origen, id del evento y XP— y una clave única
 * (user_id, source, source_id) que garantiza UN aviso por tarea aunque se
 * reintente. Ojo: aquí NO se toca `tree_progress.xp`; el total de XP viaja
 * aparte (PUT /api/tree/progress, por deltas), así que insertar un evento no
 * suma XP: solo deja la nota para avisar a los otros dispositivos.
 */

/** Origen de los eventos de tarea completada. */
const TASK_SOURCE = "task_completed";
const MAX_ROWS = 200;
const MAX_XP = 100;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const since = new URL(request.url).searchParams.get("since");
  let query = supabase
    .from("tree_xp_events")
    .select("source_id, xp, created_at")
    .eq("user_id", user.id)
    .eq("source", TASK_SOURCE)
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS);
  if (since && !Number.isNaN(new Date(since).getTime())) {
    query = query.gt("created_at", since);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    events: (data ?? []).map((row) => ({
      taskId: row.source_id,
      xp: row.xp,
      createdAt: row.created_at,
    })),
    // Reloj del servidor: los clientes lo usan como punto de partida la primera
    // vez que consultan (si no hay eventos todavía) para no quedarse sin
    // marcar el cursor y no perderse el primer aviso.
    now: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    taskId?: unknown;
    xp?: unknown;
  } | null;
  const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";
  const xp = Number(body?.xp);
  if (!taskId || !Number.isInteger(xp) || xp <= 0 || xp > MAX_XP) {
    return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { error } = await supabase.from("tree_xp_events").upsert(
    { user_id: user.id, source: TASK_SOURCE, source_id: taskId, xp },
    { onConflict: "user_id,source,source_id", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
