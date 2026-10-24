/**
 * Reglas de integridad del Secretario IA.
 *
 * El asistente NO puede rellenar huecos con datos que el usuario no ha dado:
 * nunca asigna una fecha por defecto. Cuando falta la fecha, la herramienta se
 * bloquea y devuelve la pregunta exacta que el modelo debe formular antes de
 * volver a intentarlo.
 *
 * La ASIGNATURA ya no bloquea nada: si el usuario no la ha dicho, la tarea se
 * guarda igualmente como estudio general (sin asignatura) y el asistente deja de
 * hacer preguntas que sobran. Antes se pedía la asignatura incluso cuando el
 * usuario ya la había mencionado ("apúntame una tarea de mates") porque el
 * modelo prefería preguntar antes que emparejar "mates" con "Matemáticas".
 *
 * Lo que NUNCA se exige aquí: la hora de inicio (`start_time`), la duración, la
 * prioridad o la descripción.
 *
 * Estas comprobaciones viven aquí (sin dependencias de cliente ni de servidor)
 * para que las apliquen los DOS lados:
 *  1. `src/lib/ai/tools.ts` → la herramienta no devuelve éxito y el modelo ve
 *     las preguntas pendientes.
 *  2. `src/components/dashboard/secretary-chat.tsx` → aunque el modelo insista,
 *     el cliente descarta la llamada bloqueada y no crea tareas fantasma.
 */

import { todayKey } from "@/lib/format";

/**
 * Normaliza fechas relativas en español o cadenas con fecha ("2026-10-27 (martes)",
 * "la semana que viene el martes", "próximo martes", "mañana", "hoy") a formato ISO
 * YYYY-MM-DD para evitar discrepancias de cálculo en los modelos de IA.
 */
export function normalizeRelativeDate(
  val?: string | null,
  referenceDateStr?: string,
): string | null {
  if (!val || typeof val !== "string") return val ?? null;
  const trimmed = val.trim();
  if (!trimmed) return null;

  // 1) Si contiene una fecha ISO YYYY-MM-DD válida, la extraemos directamente
  const isoMatch = trimmed.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (isoMatch) return isoMatch[0];

  const todayStr =
    referenceDateStr && /^\d{4}-\d{2}-\d{2}$/.test(referenceDateStr)
      ? referenceDateStr
      : todayKey();

  const lower = trimmed.toLowerCase();
  const [y, m, d] = todayStr.split("-").map(Number);
  const today = new Date(y, m - 1, d);
  const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // 1 = Lunes ... 7 = Domingo
  const mondayThisWeek = new Date(today);
  mondayThisWeek.setDate(today.getDate() - (dayOfWeek - 1));

  const dayMap: Record<string, number> = {
    lunes: 0,
    martes: 1,
    miercoles: 2,
    miércoles: 2,
    jueves: 3,
    viernes: 4,
    sabado: 5,
    sábado: 5,
    domingo: 6,
  };

  const formatIso = (date: Date): string => {
    const dy = date.getFullYear();
    const dm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${dy}-${dm}-${dd}`;
  };

  if (lower === "hoy") return todayStr;
  if (lower === "mañana" || lower === "manana") {
    const dt = new Date(today);
    dt.setDate(today.getDate() + 1);
    return formatIso(dt);
  }
  if (lower === "pasado mañana" || lower === "pasado manana") {
    const dt = new Date(today);
    dt.setDate(today.getDate() + 2);
    return formatIso(dt);
  }

  for (const [dayName, idx] of Object.entries(dayMap)) {
    if (lower.includes(dayName)) {
      if (
        lower.includes("semana que viene") ||
        lower.includes("proxima semana") ||
        lower.includes("próxima semana") ||
        lower.includes("que viene") ||
        lower.includes("proximo") ||
        lower.includes("próximo") ||
        lower.includes("siguiente")
      ) {
        const target = new Date(mondayThisWeek);
        target.setDate(mondayThisWeek.getDate() + 7 + idx);
        return formatIso(target);
      }
      if (lower.includes("este") || lower.includes("esta")) {
        const target = new Date(mondayThisWeek);
        target.setDate(mondayThisWeek.getDate() + idx);
        return formatIso(target);
      }
      // Sin calificador: si el día ya pasó esta semana, se entiende el de la semana que viene; si no, el de esta semana
      if (idx + 1 < dayOfWeek) {
        const target = new Date(mondayThisWeek);
        target.setDate(mondayThisWeek.getDate() + 7 + idx);
        return formatIso(target);
      } else {
        const target = new Date(mondayThisWeek);
        target.setDate(mondayThisWeek.getDate() + idx);
        return formatIso(target);
      }
    }
  }

  return trimmed;
}

/** Datos mínimos de una tarea que entran en la validación. */
export interface TaskGuardItem {
  title: string;
  type?: string | null;
  due_date?: string | null;
  start_time?: string | null;
  session_dates?: string[] | null;
  subject_id?: string | null;
  subject_name?: string | null;
  /**
   * `true` SOLO cuando el usuario ha dicho explícitamente que no tiene fecha
   * ("no tiene fecha", "cuando pueda", "algún día"). Nunca se infiere.
   */
  date_unspecified?: boolean | null;
}

export type TaskGuardIssue = "missing_date";

export interface TaskGuardViolation {
  issue: TaskGuardIssue;
  title: string;
}

export interface TaskGuardResult {
  ok: boolean;
  violations: TaskGuardViolation[];
  /** Preguntas literales que el Secretario debe hacer al usuario. */
  questions: string[];
  /** Mensaje para el modelo (no para el usuario). */
  error?: string;
}

/** Tipos académicos que siempre deben tener una fecha o sesiones concretas. */
const TYPES_REQUIRING_DATE = new Set(["task", "assignment", "exam", "study_session"]);

function clean(value?: string | null): string {
  return (value ?? "").trim();
}

function hasScheduledDate(task: TaskGuardItem): boolean {
  if (clean(task.due_date)) return true;
  const sessions = (task.session_dates ?? []).filter((d) => clean(d));
  return sessions.length > 0;
}

function requiresDate(task: TaskGuardItem): boolean {
  if (!task.type) return true;
  return TYPES_REQUIRING_DATE.has(task.type);
}

/** Nombres de las tareas a las que les falta algo. */
export function titlesFor(
  violations: TaskGuardViolation[],
  issue: TaskGuardIssue,
): string[] {
  return violations.filter((v) => v.issue === issue).map((v) => v.title);
}

/** Construye las preguntas literales que el asistente debe hacer. */
export function buildGuardQuestions(
  violations: TaskGuardViolation[],
): string[] {
  const questions: string[] = [];
  const missingDate = titlesFor(violations, "missing_date");

  if (missingDate.length > 0) {
    questions.push(
      missingDate.length === 1
        ? `¿Para cuándo es "${missingDate[0]}"? ¿Qué día tienes que entregarlo o examinarte, y cuándo vas a ponerte con ello?`
        : `¿Para cuándo son estos elementos (${missingDate.join(", ")})? ¿Qué día hay que entregarlos o examinarse, y cuándo vas a ponerte con cada uno?`,
    );
  }

  return questions;
}

/**
 * Valida un lote de tareas antes de guardarlo. Devuelve `ok: false` con las
 * preguntas pendientes cuando el usuario no ha dado la fecha.
 */
export function checkTaskInputs(tasks: TaskGuardItem[]): TaskGuardResult {
  const violations: TaskGuardViolation[] = [];

  for (const task of tasks) {
    if (requiresDate(task) && task.date_unspecified !== true && !hasScheduledDate(task)) {
      violations.push({ issue: "missing_date", title: clean(task.title) || "(sin título)" });
    }
  }

  if (violations.length === 0) return { ok: true, violations, questions: [] };

  const questions = buildGuardQuestions(violations);
  return {
    ok: false,
    violations,
    questions,
    error:
      "NO se ha guardado nada: falta la fecha de alguno de los elementos, que el usuario no ha proporcionado. " +
      "Está prohibido inventar fechas (hoy, mañana o cualquier día por defecto). " +
      "Pregunta al usuario exactamente esto y espera su respuesta: " +
      questions.map((q) => `«${q}»`).join(" ") +
      " No vuelvas a llamar a la herramienta hasta que responda. " +
      "No preguntes por la asignatura ni por la hora: ni una cosa ni la otra bloquean el guardado.",
  };
}
