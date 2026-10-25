import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export const maxDuration = 15;

function generateSecureToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para obtener tu token de webhook." },
        { status: 401 },
      );
    }

    const admin = createAdminClient();

    // Buscar si ya tiene un token
    const { data: existing, error: findError } = await admin
      .from("finance_webhooks")
      .select("token, created_at, last_used_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (findError) {
      console.error("[finance/webhook/token] error buscando token:", findError);
      return NextResponse.json({ error: "Error de base de datos" }, { status: 500 });
    }

    let token = existing?.token;

    // Si no tiene, crear uno nuevo
    if (!token) {
      token = generateSecureToken();
      const { error: insertError } = await admin.from("finance_webhooks").insert({
        user_id: user.id,
        token,
        name: "Apple Wallet / Atajos",
      });

      if (insertError) {
        console.error("[finance/webhook/token] error creando token:", insertError);
        return NextResponse.json({ error: "No se pudo generar el token" }, { status: 500 });
      }
    }

    const origin = new URL(req.url).origin;
    const webhookUrl = `${origin}/api/finance/webhook?token=${token}`;

    return NextResponse.json({
      token,
      webhookUrl,
      lastUsedAt: existing?.last_used_at || null,
      createdAt: existing?.created_at || new Date().toISOString(),
    });
  } catch (error) {
    console.error("[finance/webhook/token] error:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

/** Regenera el token invalidando el anterior. */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para regenerar tu token." },
        { status: 401 },
      );
    }

    const admin = createAdminClient();
    const newToken = generateSecureToken();

    // Eliminar o actualizar los anteriores
    await admin.from("finance_webhooks").delete().eq("user_id", user.id);

    const { error: insertError } = await admin.from("finance_webhooks").insert({
      user_id: user.id,
      token: newToken,
      name: "Apple Wallet / Atajos",
    });

    if (insertError) {
      console.error("[finance/webhook/token] error regenerando token:", insertError);
      return NextResponse.json({ error: "No se pudo regenerar el token" }, { status: 500 });
    }

    const origin = new URL(req.url).origin;
    const webhookUrl = `${origin}/api/finance/webhook?token=${newToken}`;

    return NextResponse.json({
      token: newToken,
      webhookUrl,
      message: "Token regenerado con éxito",
    });
  } catch (error) {
    console.error("[finance/webhook/token] error regenerando:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
