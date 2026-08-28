import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const POSITIONS = ["back", "front", "left", "right"] as const;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { position?: string } | null;
  const position = body?.position;
  if (!position || !POSITIONS.includes(position as (typeof POSITIONS)[number])) {
    return NextResponse.json({ error: "Posición inválida" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data, error } = await supabase.rpc("plant_tree", { p_position: position });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
