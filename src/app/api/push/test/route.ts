import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/** Envía una notificación de prueba a todas las suscripciones del usuario. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Inicia sesión para probar las notificaciones." }, { status: 401 });
  }

  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", user.id);

  if (subError) {
    return Response.json({ error: subError.message }, { status: 500 });
  }
  if (!subscriptions || subscriptions.length === 0) {
    return Response.json(
      { error: "No tienes suscripciones activas. Activa las notificaciones primero." },
      { status: 400 },
    );
  }

  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@localhost";

  if (!publicKey || !privateKey) {
    return Response.json(
      { error: "Faltan las claves VAPID en el servidor (.env). Ejecuta el script de claves VAPID." },
      { status: 501 },
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: "Núcleo",
          body: "¡Esta es una notificación de prueba! Si la ves, los recordatorios funcionarán.",
          url: "/calendar",
          tag: "push-test",
        }),
        { TTL: 60 },
      );
      sent += 1;
    } catch (err) {
      // 404/410: la suscripción ya no existe (endpoint caducado) → limpiar.
      if (err && typeof err === "object" && "statusCode" in err) {
        const statusCode = (err as { statusCode: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
      console.error("[push/test] error enviando:", err);
    }
  }

  return Response.json({ ok: sent > 0, sent, total: subscriptions.length });
}
