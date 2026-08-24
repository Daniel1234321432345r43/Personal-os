// =============================================================================
// Núcleo — Edge Function de recordatorios push
// -----------------------------------------------------------------------------
// Consulta las tareas (sesiones de estudio, exámenes, entregas) y entrenamientos
// con hora de inicio (start_time) y envía una notificación push unos minutos
// antes de que empiecen, aunque la app esté cerrada.
//
// Despliegue (cron cada 5 minutos):
//   supabase functions deploy send-reminders --no-verify-jwt --schedule "*/5 * * * *"
//
// Secretos requeridos (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web_push.js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@localhost";

// Entrenamientos: comportamiento original, avisar entre 20 minutos antes y
// 3 minutos después de la hora de inicio.
const WORKOUT_REMIND_BEFORE_MS = 20 * 60 * 1000;
const WORKOUT_GRACE_AFTER_MS = 3 * 60 * 1000;

// Tareas: el aviso es exacto (5/10/15 min antes, columna remind_before_minutes).
// El cron corre cada 5 minutos, así que la ventana cubre ~un periodo completo
// alrededor del momento objetivo para no perderse ningún tick.
const TASK_WINDOW_BEFORE_MS = 2 * 60 * 1000;
const TASK_WINDOW_AFTER_MS = 3 * 60 * 1000;

interface ReminderItem {
  entityType: "task" | "workout";
  entityId: string;
  scheduled: Date;
  /** Antelación configurada (min). Las tareas la leen de remind_before_minutes. */
  remindBeforeMinutes: number;
  message: (minutes: number) => string;
}

const TASK_LABELS: Record<string, { article: string; verb: string }> = {
  study_session: { article: "tu sesión de estudio", verb: "empieza" },
  exam: { article: "tu examen", verb: "tienes" },
  assignment: { article: "tu entrega", verb: "tienes" },
  task: { article: "tu tarea", verb: "tienes" },
};

function dateKeyInTz(date: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function zonedDateTime(dateStr: string, timeStr: string, tz: string): Date {
  const target = `${dateStr}T${timeStr.slice(0, 5)}:00`;
  const guess = new Date(`${target}Z`).getTime();
  // Busca el timestamp UTC cuya hora local en tz coincide con la deseada.
  for (let delta = -86400000; delta <= 86400000; delta += 3600000) {
    const d = new Date(guess + delta);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    if (`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}` === target) {
      return d;
    }
  }
  return new Date(target);
}

async function collectUpcoming(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tz: string,
  now: Date,
): Promise<ReminderItem[]> {
  const yesterday = dateKeyInTz(new Date(now.getTime() - 86400000), tz);
  const tomorrow = dateKeyInTz(new Date(now.getTime() + 86400000), tz);
  const items: ReminderItem[] = [];

  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, title, type, due_date, start_time, status, remind_before_minutes")
    .not("start_time", "is", null)
    .gte("due_date", yesterday)
    .lte("due_date", tomorrow);

  for (const task of tasks ?? []) {
    if (!task.due_date || !task.start_time || task.status === "done") continue;
    const scheduled = zonedDateTime(task.due_date, task.start_time, tz);
    const label = TASK_LABELS[task.type as string] ?? TASK_LABELS.task;
    items.push({
      entityType: "task",
      entityId: task.id,
      scheduled,
      remindBeforeMinutes: task.remind_before_minutes ?? 10,
      message: (minutes) =>
        `En ${minutes} min ${label.verb} ${label.article}: ${task.title}`,
    });
  }

  const { data: workouts } = await supabase
    .from("workouts")
    .select("id, activity_type, title, date, start_time")
    .not("start_time", "is", null)
    .gte("date", yesterday)
    .lte("date", tomorrow);

  for (const workout of workouts ?? []) {
    if (!workout.date || !workout.start_time) continue;
    const scheduled = zonedDateTime(workout.date, workout.start_time, tz);
    const name = workout.title || workout.activity_type;
    items.push({
      entityType: "workout",
      entityId: workout.id,
      scheduled,
      remindBeforeMinutes: 20,
      message: (minutes) => `En ${minutes} min empieza tu entrenamiento: ${name}`,
    });
  }

  return items;
}

Deno.serve(async () => {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en los secretos.");
    return new Response("VAPID no configurado", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const now = new Date();

  const { data: subscriptions, error: subError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");

  if (subError) {
    console.error("Error leyendo suscripciones:", subError.message);
    return new Response(subError.message, { status: 500 });
  }
  if (!subscriptions || subscriptions.length === 0) {
    return new Response("OK: sin suscripciones", { status: 200 });
  }

  const userIds = [...new Set(subscriptions.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, timezone")
    .in("id", userIds);
  const tzById = new Map((profiles ?? []).map((p) => [p.id, p.timezone || "UTC"]));

  let sentCount = 0;

  for (const userId of userIds) {
    const tz = tzById.get(userId) || "UTC";
    const userSubs = subscriptions.filter((s) => s.user_id === userId);
    const items = await collectUpcoming(supabase, userId, tz, now);

    for (const item of items) {
      const nowMs = now.getTime();
      let remindAt: Date;
      let inWindow: boolean;

      if (item.entityType === "workout") {
        // Comportamiento original: avisar en cualquier momento dentro de la
        // ventana de 20 min antes / 3 min después de la hora de inicio.
        const diff = item.scheduled.getTime() - nowMs;
        inWindow = diff >= -WORKOUT_GRACE_AFTER_MS && diff <= WORKOUT_REMIND_BEFORE_MS;
        remindAt = item.scheduled;
      } else {
        // Tarea: avisar exactamente remind_before_minutes antes (5/10/15).
        // La ventana alrededor del momento objetivo cubre el periodo del cron.
        const target = item.scheduled.getTime() - item.remindBeforeMinutes * 60000;
        const diff = nowMs - target;
        inWindow = diff >= -TASK_WINDOW_BEFORE_MS && diff <= TASK_WINDOW_AFTER_MS;
        remindAt = new Date(target);
      }
      if (!inWindow) continue;

      const minutes = Math.max(1, Math.round((item.scheduled.getTime() - nowMs) / 60000));
      const payload = JSON.stringify({
        title: "Núcleo",
        body: item.message(minutes),
        url: "/calendar",
        tag: `reminder-${item.entityType}-${item.entityId}`,
      });

      let sent = false;
      for (const sub of userSubs) {
        try {
          await sendWebPush(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
            { subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey },
          );
          sent = true;
        } catch (err) {
          if (err && typeof err === "object" && "statusCode" in err) {
            const statusCode = (err as { statusCode: number }).statusCode;
            if (statusCode === 404 || statusCode === 410) {
              await supabase.from("push_subscriptions").delete().eq("id", sub.id);
            }
          }
          console.error(`[send-reminders] error web push (${item.entityType}):`, err);
        }
      }

      if (sent) {
        const { error: logError } = await supabase
          .from("reminder_log")
          .upsert(
            {
              user_id: userId,
              entity_type: item.entityType,
              entity_id: item.entityId,
              remind_at: remindAt.toISOString(),
            },
            { onConflict: "user_id,entity_type,entity_id,remind_at", ignoreDuplicates: true },
          );
        if (logError) {
          console.error("[send-reminders] error en reminder_log:", logError.message);
        } else {
          sentCount += 1;
        }
      }
    }
  }

  return new Response(`OK: ${sentCount} recordatorio(s) enviado(s)`, { status: 200 });
});
