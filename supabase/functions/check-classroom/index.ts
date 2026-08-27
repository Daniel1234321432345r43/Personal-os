import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web_push.js";

/**
 * Revisa Google Classroom de todos los usuarios conectados y notifica por
 * push las novedades: tareas/entregas nuevas y anuncios/materiales nuevos.
 *
 * - SOLO avisa: no importa ni añade tareas a la app.
 * - Todo lo visto se registra en `classroom_seen` para no repetir avisos.
 * - La IA (Gemini, opcional) decide si merece la pena avisar y redacta el
 *   mensaje. Sin clave de IA, se usa una plantilla.
 *
 * Programación: supabase/config.toml ([functions.check-classroom], cada 15 min).
 */

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@localhost";
// IA: se usa OpenRouter si hay clave, si no Gemini, si no plantilla.
const openrouterKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const openrouterModel = Deno.env.get("OPENROUTER_MODEL") ?? "openai/gpt-4o-mini";
const geminiKey = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY") ?? "";
const geminiModel = Deno.env.get("GOOGLE_GENERATIVE_AI_MODEL") ?? "gemini-2.0-flash";

const API_URL = "https://classroom.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;

interface Course {
  id: string;
  name: string;
  section?: string;
}

interface CourseWork {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  creationTime?: string;
  dueDate?: { year: number; month: number; day: number };
}

interface Announcement {
  id: string;
  text?: string;
  creationTime?: string;
  materials?: {
    driveFile?: { driveFile?: { title?: string } };
    link?: { title?: string };
    youtubeVideo?: { title?: string };
  }[];
}

interface NewItem {
  kind: "coursework" | "announcement";
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  due?: string; // YYYY-MM-DD
}

interface AiDecision {
  id: string;
  notify: boolean;
  message: string;
}

async function apiGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Classroom API error (${res.status}): ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: Deno.env.get("GOOGLE_CLASSROOM_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GOOGLE_CLASSROOM_CLIENT_SECRET") ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error("No se pudo refrescar el token de Google Classroom.");
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

/** Devuelve un access_token válido (refrescándolo si expiró). */
async function getAccessToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: row } = await supabase
    .from("google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!row?.access_token) return null;

  const expired =
    row.expires_at && new Date(row.expires_at).getTime() < Date.now();
  if (expired && row.refresh_token) {
    const refreshed = await refreshAccessToken(row.refresh_token);
    await supabase
      .from("google_tokens")
      .update({
        access_token: refreshed.access_token,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      })
      .eq("user_id", userId);
    return refreshed.access_token;
  }
  return row.access_token;
}

function dueDateToISO(due?: { year: number; month: number; day: number }): string | null {
  if (!due) return null;
  const m = String(due.month).padStart(2, "0");
  const d = String(due.day).padStart(2, "0");
  return `${due.year}-${m}-${d}`;
}

function templateMessages(items: NewItem[]): AiDecision[] {
  return items.map((i) => ({
    id: i.id,
    notify: true,
    message:
      i.kind === "coursework"
        ? `📚 Te ha llegado una nueva tarea de ${i.courseName}: ${i.title}${i.due ? ` (para el ${i.due})` : ""}.`
        : `📄 Nuevo material de ${i.courseName}: ${i.title}`,
  }));
}

/** Pide a la IA que decida qué merece aviso y redacte el mensaje. */
async function aiDecide(items: NewItem[]): Promise<AiDecision[]> {
  const aiKey = openrouterKey || geminiKey;
  if (!aiKey) return templateMessages(items);

  const list = items
    .map((i) =>
      `- ${i.kind === "coursework" ? "TAREA" : "MATERIAL"} | id=${i.id} | curso=${i.courseName} | título=${i.title}${i.due ? ` | vence=${i.due}` : ""}`
    )
    .join("\n");

  const prompt = `Eres el asistente personal "Núcleo". Han llegado estos elementos nuevos de Google Classroom de un estudiante:
${list}

Para cada uno decide:
1) notify: true solo si es una tarea/entrega/examen real o un material/apunte útil. Ignora saludos, anuncios sin contenido o cosas irrelevantes.
2) message: un mensaje corto en español (máx. 140 caracteres) para una notificación push que SOLO avisa de que ha llegado algo nuevo (no se añade nada a la app, no sugieras planificarla). Si es una tarea, empieza por "Te ha llegado una nueva tarea de {curso}:". Si es un material/apunte, usa "Nuevo material de {curso}:" o "La profe de {curso} ha subido:". Incluye la fecha si la hay.

Responde SOLO JSON, un array: [{"id":"...","notify":true,"message":"..."}]`;

  try {
    let text = "";

    if (openrouterKey) {
      // OpenRouter (API compatible con OpenAI).
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openrouterKey}`,
        },
        body: JSON.stringify({
          model: openrouterModel,
          messages: [
            { role: "system", content: "Devuelves solo JSON válido, sin texto adicional." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
          max_tokens: 1024,
        }),
      });
      if (!res.ok) throw new Error(`OpenRouter error (${res.status})`);
      const data = await res.json();
      text = data?.choices?.[0]?.message?.content ?? "";
    } else {
      // Gemini.
      const res = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      });
      if (!res.ok) throw new Error(`Gemini error (${res.status})`);
      const data = await res.json();
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    }

    const json = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(json) as AiDecision[];
    if (!Array.isArray(parsed)) throw new Error("AI no devolvió un array");
    return parsed;
  } catch (err) {
    console.error("[check-classroom] error con la IA, usando plantilla:", err);
    return templateMessages(items);
  }
}

Deno.serve(async () => {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error("[check-classroom] faltan claves VAPID.");
    return new Response("VAPID no configurado", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tokenRows, error: tokenError } = await supabase
    .from("google_tokens")
    .select("user_id");

  if (tokenError || !tokenRows || tokenRows.length === 0) {
    console.log("[check-classroom] nadie tiene Classroom conectado.");
    return new Response("OK: sin usuarios conectados", { status: 200 });
  }

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth");

  const subsByUser = new Map<string, typeof subscriptions>();
  for (const sub of subscriptions ?? []) {
    const list = subsByUser.get(sub.user_id) ?? [];
    list.push(sub);
    subsByUser.set(sub.user_id, list);
  }

  let notified = 0;

  for (const { user_id: userId } of tokenRows) {
    const userSubs = subsByUser.get(userId);
    if (!userSubs || userSubs.length === 0) continue;

    try {
      const accessToken = await getAccessToken(supabase, userId);
      if (!accessToken) continue;

      const { courses = [] } = await apiGet<{ courses?: Course[] }>(
        accessToken,
        "/courses?courseStates=ACTIVE",
      );

      // IDs ya conocidos: tareas importadas a mano + ya avisados antes.
      // (Esta función SOLO avisa, no importa tareas a la app.)
      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("classroom_id")
        .eq("user_id", userId)
        .not("classroom_id", "is", null);
      const seenCoursework = new Set(
        (existingTasks ?? []).map((t) => t.classroom_id as string),
      );

      const { data: seenRows } = await supabase
        .from("classroom_seen")
        .select("external_id, kind")
        .eq("user_id", userId);
      const seenAnnouncements = new Set();
      for (const r of seenRows ?? []) {
        if (r.kind === "coursework") seenCoursework.add(r.external_id as string);
        else if (r.kind === "announcement") seenAnnouncements.add(r.external_id as string);
      }

      const newItems: NewItem[] = [];

      for (const course of courses) {
        // 1) Tareas y entregas nuevas
        const { courseWork = [] } = await apiGet<{ courseWork?: CourseWork[] }>(
          accessToken,
          `/courses/${encodeURIComponent(course.id)}/courseWork`,
        );
        for (const cw of courseWork) {
          if (seenCoursework.has(cw.id)) continue;
          // Solo novedades recientes (48 h) para no notificar todo el historial.
          if (cw.creationTime && Date.now() - new Date(cw.creationTime).getTime() > 48 * 3600 * 1000) {
            continue;
          }
          newItems.push({
            kind: "coursework",
            id: cw.id,
            courseId: course.id,
            courseName: course.name,
            title: cw.title,
            due: dueDateToISO(cw.dueDate) ?? undefined,
          });
        }

        // 2) Anuncios/materiales nuevos (requiere scope announcements.readonly;
        //    si falta, la API responde 403 y se ignora con gracia).
        try {
          const { announcements = [] } = await apiGet<{ announcements?: Announcement[] }>(
            accessToken,
            `/courses/${encodeURIComponent(course.id)}/announcements`,
          );
          for (const a of announcements) {
            if (seenAnnouncements.has(a.id)) continue;
            // Solo novedades recientes (48 h).
            if (a.creationTime && Date.now() - new Date(a.creationTime).getTime() > 48 * 3600 * 1000) {
              continue;
            }
            const m = a.materials?.[0];
            const title =
              m?.driveFile?.driveFile?.title ??
              m?.link?.title ??
              m?.youtubeVideo?.title ??
              (a.text ?? "Material nuevo").split("\n")[0].slice(0, 80);
            newItems.push({
              kind: "announcement",
              id: a.id,
              courseId: course.id,
              courseName: course.name,
              title,
            });
          }
        } catch (err) {
          // 403 = falta el scope; el resto de cursos sigue.
          console.warn(
            `[check-classroom] anuncios no disponibles (${course.name}):`,
            (err as Error).message.slice(0, 120),
          );
        }
      }

      if (newItems.length === 0) continue;

      const decisions = await aiDecide(newItems);
      const byId = new Map(decisions.map((d) => [d.id, d]));
      const toNotify = newItems.filter((i) => byId.get(i.id)?.notify);

      for (const item of toNotify) {
        const decision = byId.get(item.id)!;
        const payload = JSON.stringify({
          title: "Núcleo · Classroom",
          body: decision.message,
          url: "/academic",
          tag: `classroom-${item.kind}-${item.id}`,
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
            console.error("[check-classroom] error web push:", err);
          }
        }

        if (sent) notified += 1;
      }

      // Registrar todo lo visto (incluso lo no notificado) para no repetir.
      const seenInserts = newItems.map((i) => ({
        user_id: userId,
        kind: i.kind,
        external_id: i.id,
        title: i.title,
      }));
      if (seenInserts.length > 0) {
        await supabase.from("classroom_seen").upsert(seenInserts, {
          onConflict: "user_id,kind,external_id",
        });
      }
    } catch (err) {
      console.error(`[check-classroom] error procesando usuario ${userId}:`, err);
    }
  }

  return new Response(`OK: ${notified} notificación(es)`, { status: 200 });
});
