import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await supabase
    .from("tree_progress")
    .select("xp, level, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { xp: 0, level: 0, updated_at: null });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as { xp?: number; level?: number } | null;
  if (!body || typeof body.xp !== "number" || typeof body.level !== "number" || !Number.isInteger(body.xp) || body.xp < 0 || !Number.isInteger(body.level) || body.level < 0) {
    return NextResponse.json({ error: "Progreso inválido" }, { status: 400 });
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data, error } = await supabase
    .from("tree_progress")
    .upsert({ user_id: user.id, xp: body.xp, level: body.level, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("xp, level, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { source?: string; sourceId?: string; xp?: number } | null;
  const reward = body?.xp;
  if (!body?.source || !body.sourceId || typeof reward !== "number" || !Number.isInteger(reward) || reward <= 0 || reward > 100) {
    return NextResponse.json({ error: "Recompensa inválida" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Compatibilidad con clientes antiguos: el RPC sigue siendo idempotente
  // gracias a tree_xp_events. El cliente actual usa PUT para sincronizar el resumen.
  const { data, error } = await supabase.rpc("award_tree_xp", {
    p_source: body.source,
    p_source_id: body.sourceId,
    p_xp: reward,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
