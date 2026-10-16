import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web_push.js";
import { dateKeyInTz, normalizeDate, normalizeTime, zonedDateTime } from "../_shared/reminder-time.js";
import {
  EXAM_DONE_LOCAL_TIME,
  EXAM_DONE_SOURCE,
  EXAM_DONE_XP,
  examDoneMessage,
  examDoneTarget,
  isExamDoneWindow,
  selectExamsToComplete,
} from "../_shared/exam-done.js";
import {
  buildStudyAlert,
  isStudyAlertWindow,
  selectStudyAlertItems,
  studyAlertTarget,
  STUDY_ALERT_HORIZON_DAYS,
} from "../_shared/study-alert.js";
import {
  hasLoggedWorkout,
  isWorkoutCheckWindow,
  schedulesForDay,
  weekdayOfKey,
  workoutCheckEntityId,
  workoutCheckMessage,
  workoutCheckTarget,
  workoutCheckUrl,
} from "../_shared/workout-check.js";
import {
  hasLoggedSleep,
  isSleepCheckWindow,
  isWeekdayKey,
  sleepCheckEntityId,
  sleepCheckMessage,
  sleepCheckTarget,
  sleepCheckUrl,
} from "../_shared/sleep-check.js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@localhost";

// El cron debería ejecutarse cada minuto, pero Supabase puede arrancar una
// ejecución con retraso. Permitimos recuperar avisos atrasados (ventana
// posterior) SIN adelantarlos: la ventana anterior debe ser 0, porque el cron
// se ejecuta en el primer tick dentro de la ventana y cualquier margen previo
// hace que la notificación llegue siempre X minutos antes de lo pedido
// (p. ej. 12 min antes con 10 configurados, 17 con 15).
const TASK_WINDOW_BEFORE_MS = 0;
const TASK_WINDOW_AFTER_MS = 30 * 60 * 1000;

/** Minutos de antelación del aviso "hora de dormir" (módulo de Sueño). */
const SLEEP_REMINDER_MINUTES = 15;

/**
 * Manda el mismo payload a todas las suscripciones del usuario. Devuelve si al
 * menos una lo recibió, para poder decidir si se registra el aviso o se deja
 * pendiente para el siguiente tick del cron.
 */
async function sendPushToSubscriptions(
  subs: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: string,
  logLabel: string,
): Promise<boolean> {
  let sent = false;
  for (const sub of subs) {
    try {
      await sendWebPush(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey },
      );
      sent = true;
    } catch (err) {
      console.error(`[send-reminders] error web push (${logLabel}):`, err);
    }
  }
  return sent;
}

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

/**
 * Candidatos de aviso de sueño: la hora objetivo de acostarse convertida al
 * instante UTC exacto del usuario. Se miran hoy y mañana en su zona horaria
 * porque una hora de dormir después de medianoche (00:30) pertenece al día
 * siguiente.
 */
function collectSleepCandidates(
  settings: { bedtime: string | null; target_hours: number | null; reminder_enabled: boolean | null } | null,
  tz: string,
  now: Date,
): Array<{ dateKey: string; scheduled: Date }> {
  if (!settings?.reminder_enabled || !settings.bedtime) return [];
  const timeStr = normalizeTime(settings.bedtime);
  if (!timeStr) return [];

  const candidates: Array<{ dateKey: string; scheduled: Date }> = [];
  for (const offsetDays of [0, 1]) {
    const dateKey = dateKeyInTz(new Date(now.getTime() + offsetDays * 86400000), tz);
    const scheduled = zonedDateTime(dateKey, timeStr, tz);
    if (scheduled) candidates.push({ dateKey, scheduled });
  }
  return candidates;
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

    // ── Módulo de Sueño: aviso 15 min antes de la hora de acostarse ────────
    const { data: sleepSettings, error: sleepError } = await supabase
      .from("sleep_settings")
      .select("bedtime, target_hours, reminder_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (sleepError) {
      console.error(`[send-reminders] error leyendo sleep_settings de ${userId}:`, sleepError.message);
    }

    if (sleepSettings?.reminder_enabled && sleepSettings.bedtime) {
      const targetHours = sleepSettings.target_hours ?? 8;
      const candidates = collectSleepCandidates(sleepSettings, tz, now);

      for (const candidate of candidates) {
        const remindAt = candidate.scheduled.getTime() - SLEEP_REMINDER_MINUTES * 60000;
        const diff = now.getTime() - remindAt;
        const inWindow = diff >= -TASK_WINDOW_BEFORE_MS && diff <= TASK_WINDOW_AFTER_MS;
        if (!inWindow) continue;

        // sleep_settings no tiene columna reminder_sent: se deduplica con
        // reminder_log (una fila por usuario, noche y momento programado).
        const remindAtIso = new Date(remindAt).toISOString();
        const scheduledIso = candidate.scheduled.toISOString();
        const { data: alreadySent, error: logError } = await supabase
          .from("reminder_log")
          .select("id")
          .eq("user_id", userId)
          .eq("entity_type", "sleep")
          .eq("entity_id", candidate.dateKey)
          .eq("remind_at", scheduledIso)
          .maybeSingle();

        if (logError) {
          console.error(`[send-reminders] error consultando reminder_log (sueño):`, logError.message);
          continue;
        }
        if (alreadySent) continue;

        const minutes = Math.round((candidate.scheduled.getTime() - now.getTime()) / 60000);
        const body = minutes > 0
          ? `En ${minutes} min tienes que dormirte para cumplir tu hábito de sueño (objetivo ${targetHours} h).`
          : `Es la hora de dormirte si quieres cumplir tus ${targetHours} h de sueño.`;
        const payload = JSON.stringify({
          title: "Núcleo 💤",
          body,
          url: "/sueno",
          tag: `sleep-reminder-${candidate.dateKey}`,
        });

        let sleepSent = false;
        for (const sub of userSubs) {
          try {
            await sendWebPush(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
              { subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey },
            );
            sleepSent = true;
          } catch (err) {
            console.error(`[send-reminders] error web push (sueño):`, err);
          }
        }

        if (!sleepSent) continue;

        const { error: insertError } = await supabase.from("reminder_log").insert({
          user_id: userId,
          entity_type: "sleep",
          entity_id: candidate.dateKey,
          remind_at: scheduledIso,
        });
        if (insertError) {
          console.error("[send-reminders] no se pudo registrar el aviso de sueño:", insertError.message);
        }

        sentCount += 1;
        console.log(`[send-reminders] Aviso de sueño enviado (${candidate.dateKey}, ${remindAtIso}).`);
      }
    }

    // ── Sueño: de lunes a viernes a las 07:15, «¿cuánto has dormido?» ───────
    // La pregunta por la noche que acaba de terminar. El aviso abre la app en
    // /sueno con el formulario de la noche ya desplegado, así que se responde en
    // un par de toques. Si esa noche ya está registrada, no se pregunta nada.
    const sleepCheckKey = dateKeyInTz(now, tz);

    if (isWeekdayKey(sleepCheckKey)) {
      const sleepCheckAt = sleepCheckTarget(sleepCheckKey, tz);

      if (sleepCheckAt && isSleepCheckWindow(now, sleepCheckAt)) {
        const remindAtIso = sleepCheckAt.toISOString();
        const { data: loggedNight, error: nightError } = await supabase
          .from("sleep_logs")
          .select("date")
          .eq("user_id", userId)
          .eq("date", sleepCheckKey)
          .maybeSingle();

        if (nightError) {
          console.error(`[send-reminders] error leyendo sleep_logs de ${userId}:`, nightError.message);
        }

        if (hasLoggedSleep(loggedNight ? [loggedNight] : [], sleepCheckKey)) {
          console.log(`[send-reminders] la noche ${sleepCheckKey} ya está registrada: sin pregunta.`);
        } else {
          // Primero se RESERVA el aviso en reminder_log y solo después se envía:
          // el índice único (usuario, tipo, clave, momento) hace que dos ticks
          // solapados del cron no manden la pregunta dos veces. Si el envío no
          // llega a ninguna suscripción, se suelta la reserva y el siguiente
          // tick lo reintenta dentro del margen.
          const { error: claimError } = await supabase.from("reminder_log").insert({
            user_id: userId,
            entity_type: "sleep_check",
            entity_id: sleepCheckEntityId(sleepCheckKey),
            remind_at: remindAtIso,
          });

          if (claimError) {
            // 23505 = ya reservado (el aviso de esta mañana ya salió). Cualquier
            // otro error (p. ej. el check de entity_type sin la migración 00023)
            // se registra y NO se envía: mejor ninguna pregunta que una repetida
            // en cada tick del cron.
            const label = claimError.code === "23505" ? "ya enviada" : "no se pudo reservar";
            console.error(
              `[send-reminders] pregunta de sueño ${label} (${sleepCheckKey}, ${remindAtIso}):`,
              claimError.message,
            );
          } else {
            const payload = JSON.stringify({
              title: "Núcleo ☀️",
              body: sleepCheckMessage(sleepSettings?.target_hours ?? 8),
              url: sleepCheckUrl(sleepCheckKey),
              tag: `sleep-check-${sleepCheckKey}`,
            });
            const sent = await sendPushToSubscriptions(userSubs, payload, "pregunta de sueño");

            if (sent) {
              sentCount += 1;
              console.log(`[send-reminders] Pregunta de sueño enviada (${sleepCheckKey}).`);
            } else {
              const { error: releaseError } = await supabase
                .from("reminder_log")
                .delete()
                .eq("user_id", userId)
                .eq("entity_type", "sleep_check")
                .eq("entity_id", sleepCheckEntityId(sleepCheckKey))
                .eq("remind_at", remindAtIso);
              if (releaseError) {
                console.error("[send-reminders] no se pudo soltar la reserva de sueño:", releaseError.message);
              }
              console.log("[send-reminders] nadie recibió la pregunta de sueño: se reintentará.");
            }
          }
        }
      }
    }

    // ── Exámenes: a las 17:00 locales, el examen del día queda hecho ────────
    // El aviso "Examen completado" tiene que llegar aunque el usuario no abra
    // la app, así que el cierre y la notificación los hace el cron. La app hace
    // lo mismo al abrirse cuando el día ya pasó (src/lib/exam-autoclose.tsx).
    const { dateKey: localDateKey, target: examTarget } = examDoneTarget(now, tz);

    if (isExamDoneWindow(now, examTarget)) {
      const yesterdayKey = dateKeyInTz(new Date(now.getTime() - 86400000), tz);
      const tomorrowKey = dateKeyInTz(new Date(now.getTime() + 86400000), tz);

      const { data: examRows, error: examError } = await supabase
        .from("tasks")
        .select("id, title, type, due_date, start_time, status")
        .eq("user_id", userId)
        .eq("type", "exam")
        .neq("status", "done")
        .gte("due_date", yesterdayKey)
        .lte("due_date", tomorrowKey);

      if (examError) {
        console.error(`[send-reminders] error leyendo exámenes de ${userId}:`, examError.message);
      }

      const examsToClose = selectExamsToComplete(examRows ?? [], localDateKey, now, tz);
      const remindAtIso = examTarget ? examTarget.toISOString() : "";

      for (const exam of examsToClose) {
        // Sin repetir el aviso: una fila por (usuario, examen, momento previsto).
        const { data: alreadyLogged, error: logReadError } = await supabase
          .from("reminder_log")
          .select("id")
          .eq("user_id", userId)
          .eq("entity_type", "exam_done")
          .eq("entity_id", exam.id)
          .eq("remind_at", remindAtIso)
          .maybeSingle();

        if (logReadError) {
          console.error("[send-reminders] error consultando reminder_log (examen):", logReadError.message);
        }
        if (alreadyLogged) continue;

        // 1) El examen queda hecho: deja de aparecer como pendiente. La app
        //    cuenta el día como terminado a las 17:00, no a medianoche.
        const { error: doneError } = await supabase
          .from("tasks")
          .update({ status: "done", updated_at: now.toISOString(), reminder_sent: false })
          .eq("id", exam.id);
        if (doneError) {
          console.error(`[send-reminders] no se pudo completar el examen ${exam.id}:`, doneError.message);
          continue;
        }

        // 2) Su XP, con el mismo RPC idempotente que usa la app. Al dejar el
        //    evento en tree_xp_events, el resto de dispositivos ve el aviso al
        //    abrir la app (es el mismo camino que "tarea completada").
        const { error: xpError } = await supabase.rpc("award_tree_xp", {
          p_source: EXAM_DONE_SOURCE,
          p_source_id: exam.id,
          p_xp: EXAM_DONE_XP,
        });
        if (xpError) {
          console.error(`[send-reminders] no se pudo dar el XP del examen ${exam.id}:`, xpError.message);
        }

        // 3) El aviso al móvil, con el mismo texto que muestra la app.
        const message = examDoneMessage(exam.title);
        const payload = JSON.stringify({
          title: "Examen completado ✅",
          body: `${message}. Ya está marcado como hecho.`,
          url: "/academic",
          tag: `exam-done-${exam.id}`,
        });

        let examSent = false;
        for (const sub of userSubs) {
          try {
            await sendWebPush(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
              { subject: vapidSubject, publicKey: vapidPublicKey, privateKey: vapidPrivateKey },
            );
            examSent = true;
          } catch (err) {
            console.error(`[send-reminders] error web push (examen):`, err);
          }
        }

        const { error: logInsertError } = await supabase.from("reminder_log").insert({
          user_id: userId,
          entity_type: "exam_done",
          entity_id: exam.id,
          remind_at: remindAtIso,
        });
        if (logInsertError) {
          console.error("[send-reminders] no se pudo registrar el cierre del examen:", logInsertError.message);
        }

        if (examSent) sentCount += 1;
        console.log(
          `[send-reminders] Examen ${exam.id} cerrado a las ${EXAM_DONE_LOCAL_TIME} locales (${remindAtIso}); push: ${examSent}.`,
        );
      }
    }

    // ── Estudio: a las 15:00 locales, repaso de exámenes y entregas ─────────
    // El empujón para empezar a estudiar con lo que se acerca. Solo se manda si
    // hay algo pendiente dentro del horizonte; si no hay nada, no se molesta.
    const { dateKey: studyDateKey, target: studyTarget } = studyAlertTarget(now, tz);

    if (studyTarget && isStudyAlertWindow(now, studyTarget)) {
      const horizonKey = dateKeyInTz(
        new Date(now.getTime() + STUDY_ALERT_HORIZON_DAYS * 86400000),
        tz,
      );
      const { data: pendingTasks, error: pendingError } = await supabase
        .from("tasks")
        .select("id, title, type, due_date, status")
        .eq("user_id", userId)
        .neq("status", "done")
        .gte("due_date", studyDateKey)
        .lte("due_date", horizonKey);

      if (pendingError) {
        console.error(`[send-reminders] error leyendo plazos de ${userId}:`, pendingError.message);
      }

      const items = selectStudyAlertItems(pendingTasks ?? [], studyDateKey);
      const message = buildStudyAlert(items);
      const remindAtIso = studyTarget.toISOString();

      if (message) {
        // Un aviso por día: la clave es la propia fecha local.
        const { data: alreadySent, error: logReadError } = await supabase
          .from("reminder_log")
          .select("id")
          .eq("user_id", userId)
          .eq("entity_type", "study_alert")
          .eq("entity_id", studyDateKey)
          .eq("remind_at", remindAtIso)
          .maybeSingle();

        if (logReadError) {
          console.error("[send-reminders] error consultando reminder_log (estudio):", logReadError.message);
        }

        if (!alreadySent) {
          const payload = JSON.stringify({
            title: "Núcleo 📚",
            body: message,
            url: "/academic",
            tag: `study-alert-${studyDateKey}`,
          });
          const sent = await sendPushToSubscriptions(userSubs, payload, "estudio");

          if (sent) {
            const { error: insertError } = await supabase.from("reminder_log").insert({
              user_id: userId,
              entity_type: "study_alert",
              entity_id: studyDateKey,
              remind_at: remindAtIso,
            });
            if (insertError) {
              console.error("[send-reminders] no se pudo registrar el aviso de estudio:", insertError.message);
            }
            sentCount += 1;
            console.log(`[send-reminders] Aviso de estudio enviado (${studyDateKey}): ${message}`);
          }
        }
      }
    }

    // ── Entrenamientos: «Hoy deberías haber ido a X, ¿has ido?» ─────────────
    // Sale cuando el entreno programado para hoy ya ha terminado (hora +
    // duración) y aún no hay un entreno apuntado ese día. La notificación abre
    // la app en el modal de confirmación (WorkoutCheckDialog).
    const { data: scheduleRows, error: scheduleError } = await supabase
      .from("workout_schedule")
      .select("id, weekday, activity_type, title, time, duration_minutes, enabled")
      .eq("user_id", userId);

    if (scheduleError) {
      console.error(`[send-reminders] error leyendo workout_schedule de ${userId}:`, scheduleError.message);
    }

    if (scheduleRows && scheduleRows.length > 0) {
      const localDateKey = dateKeyInTz(now, tz);
      const weekday = weekdayOfKey(localDateKey);
      const todaySchedules = schedulesForDay(scheduleRows, weekday);

      if (todaySchedules.length > 0) {
        const { data: todayWorkouts } = await supabase
          .from("workouts")
          .select("activity_type, title, date")
          .eq("user_id", userId)
          .eq("date", localDateKey);

        for (const schedule of todaySchedules) {
          const target = workoutCheckTarget(schedule, localDateKey, tz);
          if (!isWorkoutCheckWindow(now, target) || !target) continue;

          // Si ya hay un entreno de ese tipo apuntado hoy, no se pregunta.
          if (hasLoggedWorkout(todayWorkouts ?? [], schedule, localDateKey)) {
            console.log(`[send-reminders] entreno ${schedule.id} ya apuntado hoy: sin pregunta.`);
            continue;
          }

          const entityId = workoutCheckEntityId(schedule, localDateKey);
          const remindAtIso = target.toISOString();
          const { data: alreadySent, error: logReadError } = await supabase
            .from("reminder_log")
            .select("id")
            .eq("user_id", userId)
            .eq("entity_type", "workout_check")
            .eq("entity_id", entityId)
            .eq("remind_at", remindAtIso)
            .maybeSingle();

          if (logReadError) {
            console.error("[send-reminders] error consultando reminder_log (entreno):", logReadError.message);
          }
          if (alreadySent) continue;

          const payload = JSON.stringify({
            title: "Núcleo 🏋️",
            body: workoutCheckMessage(schedule),
            url: workoutCheckUrl(schedule, localDateKey),
            tag: `workout-check-${entityId}`,
          });
          const sent = await sendPushToSubscriptions(userSubs, payload, "entreno");

          if (!sent) continue;

          const { error: insertError } = await supabase.from("reminder_log").insert({
            user_id: userId,
            entity_type: "workout_check",
            entity_id: entityId,
            remind_at: remindAtIso,
          });
          if (insertError) {
            console.error("[send-reminders] no se pudo registrar la pregunta del entreno:", insertError.message);
          }
          sentCount += 1;
          console.log(`[send-reminders] Pregunta de entreno enviada (${entityId}).`);
        }
      }
    }
  }

  return new Response(`OK: ${sentCount} recordatorio(s) enviado(s)`, { status: 200 });
});