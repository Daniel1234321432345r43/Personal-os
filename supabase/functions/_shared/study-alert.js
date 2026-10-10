// =============================================================================
// Aviso diario de estudio: a las 15:00 (hora local del usuario) se revisan los
// exámenes y las entregas pendientes y se manda un empujón para empezar a
// estudiar, con los plazos más cercanos: «Tienes un examen pasado mañana y otro
// al día siguiente, deberías empezar a estudiar».
//
// Aislado en _shared/ para poder probarlo desde Node (scripts/test-study-alert.mjs)
// sin depender de Deno. El envío lo hace el cron de send-reminders.
// =============================================================================

import {
  dateKeyInTz,
  normalizeDate,
  zonedDateTime,
} from "./reminder-time.js";

/** Hora local del aviso diario de estudio: 3 de la tarde. */
export const STUDY_ALERT_LOCAL_TIME = "15:00";

/** Margen para recuperar el aviso si el cron arranca con retraso. */
export const STUDY_ALERT_WINDOW_AFTER_MS = 30 * 60 * 1000;

/** Hasta cuántos días vista se mira al armar el aviso. */
export const STUDY_ALERT_HORIZON_DAYS = 7;

/** Nombre con el que se menciona cada tipo de elemento. */
const TYPE_LABELS = {
  exam: ["examen", "exámenes"],
  assignment: ["entrega", "entregas"],
  task: ["tarea", "tareas"],
  study_session: ["sesión de estudio", "sesiones de estudio"],
};

/** Artículo indefinido de cada tipo (una entrega, un examen…). */
const TYPE_ARTICLES = {
  exam: "un",
  assignment: "una",
  task: "una",
  study_session: "una",
};

/** Día local del usuario y el instante UTC en el que toca el aviso. */
export function studyAlertTarget(now, tz) {
  const dateKey = dateKeyInTz(now, tz);
  const target = zonedDateTime(dateKey, STUDY_ALERT_LOCAL_TIME, tz);
  return { dateKey, target: target ?? null };
}

/** ¿Toca ya mandar el aviso de estudio? (desde las 15:00 locales, con margen). */
export function isStudyAlertWindow(now, target) {
  if (!now || !target) return false;
  const diff = now.getTime() - target.getTime();
  return diff >= 0 && diff <= STUDY_ALERT_WINDOW_AFTER_MS;
}

/** Días entre dos claves de fecha (YYYY-MM-DD). Nunca lanza. */
export function daysBetweenKeys(fromKey, toKey) {
  const from = Date.parse(`${fromKey}T00:00:00Z`);
  const to = Date.parse(`${toKey}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

/** «hoy», «mañana», «pasado mañana» o «en N días». */
export function relativeDayLabel(days) {
  if (days <= 0) return "hoy";
  if (days === 1) return "mañana";
  if (days === 2) return "pasado mañana";
  return `en ${days} días`;
}

/**
 * Elementos que entran en el aviso: pendientes, con fecha de hoy en adelante y
 * dentro del horizonte. Se ordenan por fecha y nunca lanzan (una fila ilegible
 * se descarta).
 */
export function selectStudyAlertItems(tasks, todayKey, horizonDays = STUDY_ALERT_HORIZON_DAYS) {
  const items = [];
  for (const task of tasks ?? []) {
    try {
      if (!task || task.status === "done") continue;
      if (!TYPE_LABELS[task.type]) continue;
      const dueDate = normalizeDate(task.due_date);
      if (!dueDate) continue;
      const days = daysBetweenKeys(todayKey, dueDate);
      if (days == null || days < 0 || days > horizonDays) continue;
      items.push({
        title: typeof task.title === "string" ? task.title.trim() : "",
        type: task.type,
        due_date: dueDate,
        days,
      });
    } catch {
      // Fila ilegible: lo único seguro es no usarla.
    }
  }
  items.sort((a, b) => a.days - b.days || a.title.localeCompare(b.title));
  return items;
}

function label(type, count) {
  const [one, many] = TYPE_LABELS[type] ?? ["tarea", "tareas"];
  return count === 1 ? one : many;
}

function article(type) {
  return TYPE_ARTICLES[type] ?? "una";
}

function shortTitle(title) {
  if (!title) return "";
  return title.length > 40 ? `${title.slice(0, 39)}…` : title;
}

/** «Física (pasado mañana)» o, si no hay título, «examen (pasado mañana)». */
function detail(item) {
  const title = shortTitle(item.title) || label(item.type, 1);
  return `${title} (${relativeDayLabel(item.days)})`;
}

/** Lista natural de grupos por tipo: «un examen y 2 entregas». */
function describeGroups(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item.type, (counts.get(item.type) ?? 0) + 1);
  }
  const parts = [];
  for (const [type, count] of counts) {
    parts.push(
      count === 1
        ? `${article(type)} ${label(type, 1)}`
        : `${count} ${label(type, count)}`,
    );
  }
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

/**
 * Texto del aviso. Devuelve `null` cuando no hay nada próximo que recordar
 * (mejor no molestar que mandar un aviso vacío).
 */
export function buildStudyAlert(items) {
  const list = items ?? [];
  if (list.length === 0) return null;

  const closing = list.length === 1
    ? "Deberías ir empezando a estudiar."
    : "Deberías empezar a estudiar.";

  // Un único elemento: se nombra con su plazo, sin listas.
  if (list.length === 1) {
    const item = list[0];
    return `Tienes ${article(item.type)} ${label(item.type, 1)} ${relativeDayLabel(item.days)} (${shortTitle(item.title) || label(item.type, 1)}). ${closing}`;
  }

  // Dos exámenes: el caso típico de «uno pasado mañana y otro al día siguiente».
  const exams = list.filter((item) => item.type === "exam");
  if (list.length === 2 && exams.length === 2) {
    return `Tienes ${article("exam")} examen ${relativeDayLabel(exams[0].days)} (${shortTitle(exams[0].title) || "examen"}) y otro ${relativeDayLabel(exams[1].days)} (${shortTitle(exams[1].title) || "examen"}). ${closing}`;
  }

  const withinWeek = list[list.length - 1].days <= 7;
  const intro = `Tienes ${describeGroups(list)}${withinWeek ? " esta semana" : ""}`;
  const details = list
    .slice(0, 3)
    .map((item) => detail(item))
    .join(", ");
  return `${intro}: ${details}. ${closing}`;
}
