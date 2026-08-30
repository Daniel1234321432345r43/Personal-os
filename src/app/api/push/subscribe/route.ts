import { createClient } from "@/lib/supabase/server";

/** Guarda (o actualiza) la suscripción push del usuario autenticado. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Inicia sesión para activar las notificaciones." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const subscription = body?.subscription;
  if (
    !subscription ||
    typeof subscription.endpoint !== "string" ||
    !subscription.keys ||
    typeof subscription.keys.p256dh !== "string" ||
    typeof subscription.keys.auth !== "string"
  ) {
    return Response.json({ error: "Suscripción incompleta." }, { status: 400 });
  }

  console.info("[push/subscribe] guardando suscripción", {
    userId: user.id,
    endpoint: subscription.endpoint.slice(0, 80),
  });

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) {
    console.error("[push/subscribe] error guardando suscripción:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  console.info("[push/subscribe] suscripción guardada correctamente", { userId: user.id });
  return Response.json({ ok: true });
}
