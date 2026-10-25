import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySignedWebhookToken } from "@/lib/finance/webhook-token";
import { inferExpenseCategory } from "@/lib/finance/categorizer";
import { todayKey } from "@/lib/format";
import webpush from "web-push";

export const maxDuration = 30;

function parseAmount(val: unknown): number | null {
  if (typeof val === "number" && !isNaN(val) && val > 0) {
    return val;
  }
  if (typeof val === "string") {
    // Manejar formatos como "14.50", "14,50", "14.50 €", "14.50 EUR"
    const cleaned = val
      .replace(/[€$£]/g, "")
      .replace(/EUR|USD|GBP/gi, "")
      .trim()
      .replace(",", ".");
    const match = cleaned.match(/[0-9]+(\.[0-9]+)?/);
    if (match) {
      const num = parseFloat(match[0]);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

/**
 * Webhook para Atajos de iOS / Apple Wallet / Automations externas.
 * Recibe un POST con { amount, merchant, date?, category?, type? }
 * autenticado mediante el parámetro de consulta ?token= o el header x-webhook-token.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const token =
      url.searchParams.get("token") ||
      req.headers.get("x-webhook-token") ||
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json(
        { error: "Token de webhook no proporcionado. Añade ?token=... a la URL." },
        { status: 401 },
      );
    }

    let body: Record<string, unknown> = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      body = await req.json().catch(() => ({}));
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData().catch(() => null);
      if (formData) {
        formData.forEach((val, key) => {
          body[key] = val;
        });
      }
    } else {
      // Intentar leer texto como JSON por compatibilidad con atajos de iOS
      const text = await req.text().catch(() => "");
      try {
        body = JSON.parse(text);
      } catch {
        body = {};
      }
    }

    const rawAmount = body.amount ?? body.importe ?? body.value ?? body.total;
    const amount = parseAmount(rawAmount);

    if (!amount) {
      return NextResponse.json(
        {
          error:
            "Importe inválido o ausente. Envía un campo 'amount' numérico (ej. 14.50).",
          received: rawAmount,
        },
        { status: 400 },
      );
    }

    const merchantRaw =
      body.merchant ??
      body.comercio ??
      body.description ??
      body.concepto ??
      body.store ??
      "Compra con tarjeta";
    const merchant = String(merchantRaw).trim() || "Compra con tarjeta";

    const explicitCategory = typeof body.category === "string" ? body.category.trim() : null;
    const category = explicitCategory || inferExpenseCategory(merchant);

    const type = body.type === "income" ? "income" : "expense";
    const date =
      typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date.trim())
        ? body.date.trim()
        : todayKey();

    const supabase = createAdminClient();

    // 1. Validar el token y obtener el userId
    let userId: string | null = verifySignedWebhookToken(token);
    let webhookId: string | null = null;

    if (!userId) {
      // Fallback a consultar en la tabla finance_webhooks
      try {
        const { data: webhook } = await supabase
          .from("finance_webhooks")
          .select("id, user_id")
          .eq("token", token)
          .maybeSingle();

        if (webhook?.user_id) {
          userId = webhook.user_id;
          webhookId = webhook.id;
        }
      } catch {
        // Ignorar si la tabla no existe
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Token de webhook no válido o revocado." },
        { status: 403 },
      );
    }

    // 2. Insertar transacción
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        type,
        amount,
        category,
        description: merchant,
        date,
      })
      .select()
      .single();

    if (txError) {
      console.error("[finance/webhook] error insertando transacción:", txError);
      if (txError.code === "42501") {
        return NextResponse.json(
          {
            error:
              "Permisos insuficientes en la base de datos remota. Añade la variable SUPABASE_SERVICE_ROLE_KEY en el panel de Netlify.",
          },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: "No se pudo registrar la transacción" }, { status: 500 });
    }

    // 3. Actualizar fecha de último uso si existe registro en la tabla
    if (webhookId) {
      void supabase
        .from("finance_webhooks")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", webhookId);
    }

    // 4. Notificación push si el usuario tiene suscripciones Web Push activas
    const publicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
    const privateKey = process.env.VAPID_PRIVATE_KEY || "";
    const subject = process.env.VAPID_SUBJECT || "mailto:admin@localhost";

    if (publicKey && privateKey) {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", userId);

      if (subs && subs.length > 0) {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        const formattedAmount = `${amount.toFixed(2)} €`;
        const pushPayload = JSON.stringify({
          title: "Gasto registrado 💳",
          body: `${formattedAmount} en ${merchant} (${category}).`,
          url: "/finance",
          tag: `tx-${transaction.id}`,
        });

        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              pushPayload,
              { TTL: 120 },
            );
          } catch {
            // Ignorar errores puntuales de push
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Gasto registrado correctamente",
      transaction: {
        id: transaction.id,
        amount,
        merchant,
        category,
        date,
        type,
      },
    });
  } catch (error) {
    console.error("[finance/webhook] error procesando webhook:", error);
    return NextResponse.json(
      { error: "Error interno del servidor", details: error instanceof Error ? error.message : "" },
      { status: 500 },
    );
  }
}
