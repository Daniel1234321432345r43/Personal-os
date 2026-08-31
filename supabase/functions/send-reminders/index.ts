import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web_push.js";
import { dateKeyInTz, normalizeDate, normalizeTime, zonedDateTime } from "../_shared/reminder-time.js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@localhost";

// El cron debería ejecutarse cada minuto, pero Supabase puede arrancar una
// ejecución con retraso. Permitimos recuperar avisos atrasados sin enviarlos
// con demasiada antelación.
const TASK_WINDOW_BEFORE_MS = 2 * 60 * 1000;
const TASK_WINDOW_AFTER_MS = 30 * 60 * 1000;

interface ReminderItem {
  entityType: "task" | "workout";
  entityId: string;
  scheduled: Date;
  remindBeforeMinutes: number;
  message: (minutes: number) => string;
}

const TASK_LABELS: Record<string, { article: string; verb: string }> = {
  study_session: { article: "tu sesión de estudio", verb: "empieza" },
  exam: { article: "tu examen", verb: "tienes" },
  assignment: { article: "tu entrega", verb: "tienes" },
  task: { article: "tu tarea", verb: "tienes" },
};

async function collectUpcoming(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  tz: string,
  now: Date,
): Promise<ReminderItem[]> {
  const yesterday = dateKeyInTz(new Date(now.getTime() - 86400000), tz);
  const tomorrow = dateKeyInTz(new Date(now.getTime() + 86400000), tz);
  const items: ReminderItem[] = [];

  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id, title, type, due_date, start_time, status, remind_before_minutes, reminder_sent")
    .not("start_time", "is", null)
    .eq("reminder_sent", false)
    .neq("status", "done")
    .gte("due_date", yesterday)
    .lte("due_date", tomorrow);

  if (tasksError) {
    console.error("[send-reminders] error leyendo tareas:", tasksError.message);
  }

  for (const task of tasks ?? []) {
    try {
      if (!task.due_date || !task.start_time) continue;
      const dateStr = normalizeDate(task.due_date);
      const timeStr = normalizeTime(task.start_time);
      if (!dateStr || !timeStr) continue;

      const scheduled = zonedDateTime(dateStr, timeStr, tz);
      if (!scheduled) continue;

      const label = TASK_LABELS[task.type as string] ?? TASK_LABELS.task;
      items.push({
        entityType: "task",
        entityId: task.id,
        scheduled,
        remindBeforeMinutes: task.remind_before_minutes ?? 10,
        message: (minutes) =>
          `En ${minutes} min ${label.verb} ${label.article}: ${task.title}`,
      });
    } catch (err) {
      console.warn(`[send-reminders] error procesando tarea ${task.id}:`, err);
    }
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

  if (subError || !subscriptions || subscriptions.length === 0) {
    console.log("[send-reminders] Sin suscripciones push activas.");
    return new Response("OK: sin suscripciones", { status: 200 });
  }

  const userIds = [...new Set(subscriptions.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from("users")
    .select("id, timezone")
    .in("id", userIds);

  const tzById = new Map((profiles ?? []).map((p) => [p.id, p.timezone || "UTC"]));
  let sentCount = 0;

  for (const userId of userIds) {
    const tz = tzById.get(userId) || "UTC";
    const userSubs = subscriptions.filter((s) => s.user_id === userId);

    let items: ReminderItem[] = [];
    try {
      items = await collectUpcoming(supabase, userId, tz, now);
    } catch (err) {
      console.error(`[send-reminders] error procesando usuario ${userId}:`, err);
      continue;
    }

    // AHORA SÍ: Vuelves a ver en los logs cuántas tareas pendientes evalúa
    console.log(`[send-reminders] Usuario ${userId} (tz=${tz}): ${items.length} tarea(s) pendientes de evaluar.`);

    for (const item of items) {
      const nowMs = now.getTime();
      const target = item.scheduled.getTime() - item.remindBeforeMinutes * 60000;
      const diff = nowMs - target;
      const inWindow = diff >= -TASK_WINDOW_BEFORE_MS && diff <= TASK_WINDOW_AFTER_MS;
      console.log("[send-reminders] tarea evaluada", {
        userId,
        entityId: item.entityId,
        scheduled: item.scheduled.toISOString(),
        remindBeforeMinutes: item.remindBeforeMinutes,
        target: new Date(target).toISOString(),
        diffMs: diff,
        inWindow,
        subscriptions: userSubs.length,
      });

      if (!inWindow) {
        console.log("[send-reminders] tarea fuera de ventana", {
          entityId: item.entityId,
          scheduled: item.scheduled.toISOString(),
          target: new Date(target).toISOString(),
          diffMs: diff,
        });
        continue;
      }

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
          console.error(`[send-reminders] error web push:`, err);
        }
      }

      if (sent) {
        const { error: markError } = await supabase
          .from("tasks")
          .update({ reminder_sent: true })
          .eq("id", item.entityId);
        if (markError) {
          console.error("[send-reminders] no se pudo marcar reminder_sent:", markError.message);
        }

        sentCount += 1;
        console.log(`[send-reminders] ¡Notificación enviada con éxito para la tarea ${item.entityId}!`);
      }
    }
  }

  return new Response(`OK: ${sentCount} recordatorio(s) enviado(s)`, { status: 200 });
});