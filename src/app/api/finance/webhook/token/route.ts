import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createSignedWebhookToken,
  verifySignedWebhookToken,
} from "@/lib/finance/webhook-token";

export const maxDuration = 15;

function resolveOrigin(req: Request): string {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = forwardedProto || "https";
    return `${proto}://${forwardedHost}`;
  }
  const host = req.headers.get("host");
  if (host) {
    const proto = forwardedProto || (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para obtener tu token de webhook." },
        { status: 401 },
      );
    }

    let token = (user.user_metadata?.finance_webhook_token as string) || null;
    let lastUsedAt: string | null = null;
    let createdAt = user.created_at || new Date().toISOString();

    // 1. Intentar consultar si existe registro en la tabla finance_webhooks (si la migración ya se aplicó)
    try {
      const { data: existing } = await supabase
        .from("finance_webhooks")
        .select("token, created_at, last_used_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing?.token) {
        token = existing.token;
        lastUsedAt = existing.last_used_at || null;
        createdAt = existing.created_at || createdAt;
      }
    } catch {
      // Si la tabla no existe en la base de datos remota, continuamos de forma transparente
    }

    // 2. Si no tiene token o el token no es válido para este usuario, generamos uno nuevo firmado
    const validUserId = token ? verifySignedWebhookToken(token) : null;
    if (!token || validUserId !== user.id) {
      token = createSignedWebhookToken(user.id);

      // Guardar en user_metadata (siempre disponible sin necesidad de migraciones de tablas)
      await supabase.auth.updateUser({
        data: { finance_webhook_token: token },
      }).catch((err) => {
        console.warn("[finance/webhook/token] no se pudo actualizar user_metadata:", err);
      });

      // Intentar también guardar en finance_webhooks si la tabla existe
      try {
        await supabase.from("finance_webhooks").upsert({
          user_id: user.id,
          token,
          name: "Apple Wallet / Atajos",
        });
      } catch {
        // Ignorar si la tabla aún no existe
      }
    }

    const origin = resolveOrigin(req);
    const webhookUrl = `${origin}/api/finance/webhook?token=${token}`;

    return NextResponse.json({
      token,
      webhookUrl,
      lastUsedAt,
      createdAt,
    });
  } catch (error) {
    console.error("[finance/webhook/token] error:", error);
    return NextResponse.json({ error: "Error del servidor al obtener el token" }, { status: 500 });
  }
}

/** Regenera el token invalidando el anterior. */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Debes iniciar sesión para regenerar tu token." },
        { status: 401 },
      );
    }

    const newToken = createSignedWebhookToken(user.id);

    // Guardar nuevo token en user_metadata
    await supabase.auth.updateUser({
      data: { finance_webhook_token: newToken },
    }).catch((err) => {
      console.warn("[finance/webhook/token] no se pudo actualizar user_metadata:", err);
    });

    // Actualizar tabla si existe
    try {
      await supabase.from("finance_webhooks").delete().eq("user_id", user.id);
      await supabase.from("finance_webhooks").insert({
        user_id: user.id,
        token: newToken,
        name: "Apple Wallet / Atajos",
      });
    } catch {
      // Ignorar si la tabla no existe
    }

    const origin = resolveOrigin(req);
    const webhookUrl = `${origin}/api/finance/webhook?token=${newToken}`;

    return NextResponse.json({
      token: newToken,
      webhookUrl,
      message: "Token regenerado con éxito",
    });
  } catch (error) {
    console.error("[finance/webhook/token] error regenerando:", error);
    return NextResponse.json({ error: "Error del servidor al regenerar token" }, { status: 500 });
  }
}
