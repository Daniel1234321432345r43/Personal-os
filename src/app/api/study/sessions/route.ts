import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Registro de estudio compartido (tabla `study_sessions`).
 *
 * El registro es de SOLO-AÑADIR: el cliente genera el id de cada sesión, así
 * que GET devuelve las sesiones y POST inserta solo las que faltan. Esa
 * propiedad hace la sincronización idempotente: subir dos veces lo mismo (o
 * solapar dos peticiones) no duplica nada.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Tope de sesiones por petición y por consulta. */
const MAX_ROWS = 5000;
/** Ninguna sesión de estudio razonable pasa de un día. */
const MAX_MINUTES = 1440;

interface SessionPayload {
  id: string;
  taskId: string | null;
  minutes: number;
  date: string;
  completedAt: string;
}

function parseSessions(raw: unknown): SessionPayload[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_ROWS) return null;
  const parsed: SessionPayload[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const s = item as Record<string, unknown>;
    const minutes = Number(s.minutes);
    const completedAt = typeof s.completedAt === "string" ? s.completedAt : "";
    if (
      typeof s.id !== "string" ||
      s.id.length === 0 ||
      !Number.isInteger(minutes) ||
      minutes <= 0 ||
      minutes > MAX_MINUTES ||
      typeof s.date !== "string" ||
      !DATE_RE.test(s.date) ||
      Number.isNaN(new Date(completedAt).getTime())
    ) {
      return null;
    }
    parsed.push({
      id: s.id,
      taskId: typeof s.taskId === "string" && s.taskId ? s.taskId : null,
      minutes,
      date: s.date,
      completedAt,
    });
  }
  return parsed;
}

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
    .from("study_sessions")
    .select("id, task_id, minutes, date, completed_at")
    .eq("user_id", user.id)
    .order("completed_at", { ascending: true })
    .limit(MAX_ROWS);
  if (since && !Number.isNaN(new Date(since).getTime())) {
    query = query.gt("completed_at", since);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    sessions: (data ?? []).map((row) => ({
      id: row.id,
      taskId: row.task_id,
      minutes: row.minutes,
      date: row.date,
      completedAt: row.completed_at,
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    sessions?: unknown;
  } | null;
  const sessions = parseSessions(body?.sessions);
  if (!sessions) {
    return NextResponse.json({ error: "Sesiones inválidas" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (sessions.length === 0) return NextResponse.json({ ok: true, saved: 0 });

  const { error } = await supabase.from("study_sessions").upsert(
    sessions.map((s) => ({
      id: s.id,
      user_id: user.id,
      task_id: s.taskId,
      minutes: s.minutes,
      date: s.date,
      completed_at: s.completedAt,
    })),
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, saved: sessions.length });
}

/** Borra todo el registro del usuario (lo usa "Restablecer todo"). */
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { error } = await supabase
    .from("study_sessions")
    .delete()
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
