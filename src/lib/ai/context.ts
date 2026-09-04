import type { DashboardData } from "@/lib/data";
import type { SecretaryContext } from "@/lib/ai/types";
import { todayKey } from "@/lib/format";

const NOTE_EXCERPT = 500;
const MAX_NOTES = 5;

/** Construye el contexto que se envía a la IA a partir de los datos del usuario. */
export function buildSecretaryContext(data: DashboardData): SecretaryContext {
  const today = todayKey();
  const subjectNameMap = new Map(data.subjects.map((s) => [s.id, s.name]));

  return {
    date: today,
    tasks: data.tasks
      .filter((t) => t.status !== "done")
      .map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        category: t.category,
        priority: t.priority,
        due_date: t.due_date,
        estimated_minutes: t.estimated_minutes,
        subject_id: t.subject_id,
      })),
    subjects: data.subjects.map((s) => ({ id: s.id, name: s.name })),
    grades: (data.grades || []).map((g) => ({
      id: g.id,
      subject_id: g.subject_id,
      subject_name: subjectNameMap.get(g.subject_id) ?? undefined,
      title: g.title,
      score: g.score,
      max_score: g.max_score,
      weight_percentage: g.weight_percentage,
      date: g.date,
      notes: g.notes,
    })),
    notes: data.notes.slice(0, MAX_NOTES).map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content.slice(0, NOTE_EXCERPT),
    })),
    habits: data.habits.map((h) => ({ name: h.name, emoji: h.emoji })),
    workouts: data.workouts
      .filter((w) => w.date === today)
      .map((w) => ({
        activity_type: w.activity_type,
        duration_minutes: w.duration_minutes,
      })),
    finance: data.finance,
  };
}

/**
 * Convierte el contexto en un bloque de texto compacto (español) que se inyecta
 * en el system prompt del chat para que el Secretario conozca los datos reales.
 */
export function buildContextText(ctx: SecretaryContext): string {
  const subjectName = new Map(ctx.subjects.map((s) => [s.id, s.name]));
  const typeLabel: Record<string, string> = {
    task: "tarea",
    assignment: "entrega",
    exam: "examen",
    study_session: "sesión de estudio",
  };

  const lines: string[] = [];
  lines.push(`Fecha de hoy: ${ctx.date}`);

  if (ctx.subjects.length) {
    lines.push(
      `\nAsignaturas creadas (${ctx.subjects.length}): ${ctx.subjects.map((s) => `${s.name} [id=${s.id}]`).join(", ")}`,
    );
  } else {
    lines.push("\nAsignaturas creadas: ninguna todavía.");
  }

  if (ctx.tasks.length) {
    lines.push("\nTareas y plazos pendientes:");
    for (const t of ctx.tasks) {
      const bits: string[] = [`[prioridad=${t.priority}]`, `tipo=${typeLabel[t.type] ?? t.type}`];
      if (t.subject_id) {
        const name = subjectName.get(t.subject_id);
        if (name) bits.push(`asignatura=${name}`);
      }
      if (t.due_date) bits.push(`vence=${t.due_date}`);
      if (t.estimated_minutes) bits.push(`~${t.estimated_minutes}min`);
      lines.push(`- ${t.title} (${bits.join(", ")})`);
    }
  } else {
    lines.push("\nTareas y plazos pendientes: ninguno.");
  }

  if (ctx.grades && ctx.grades.length > 0) {
    lines.push("\nCalificaciones y notas obtenidas:");
    for (const g of ctx.grades) {
      const subName = g.subject_name || subjectName.get(g.subject_id) || "General";
      const weightInfo =
        g.weight_percentage != null ? `cuenta ${g.weight_percentage}%` : "sin ponderar";
      lines.push(
        `- [${subName}] ${g.title}: nota ${g.score}/${g.max_score ?? 10} (${weightInfo})${g.date ? ` [fecha: ${g.date}]` : ""}`,
      );
    }
  }

  if (ctx.notes.length) {
    lines.push("\nNotas/apuntes del usuario:");
    for (const n of ctx.notes) {
      lines.push(`- ${n.title}: ${n.content}`);
    }
  }

  if (ctx.workouts.length) {
    lines.push("\nEntrenamientos de hoy:");
    for (const w of ctx.workouts) {
      lines.push(`- ${w.activity_type} (${w.duration_minutes} min)`);
    }
  }

  if (ctx.habits.length) {
    lines.push(
      `\nHábitos diarios: ${ctx.habits.map((h) => `${h.emoji} ${h.name}`).join(", ")}`,
    );
  }

  const { finance } = ctx;
  lines.push(
    `\nFinanzas del mes: ingresos=${finance.income}, gastos=${finance.expenses}, balance=${finance.balance}` +
      (finance.budget != null ? `, presupuesto=${finance.budget}` : "") +
      (finance.plannedExpenses > 0
        ? `, gastos_previstos_pendientes=${finance.plannedExpenses}, restante_proyectado=${finance.projectedRemaining}`
        : ""),
  );

  return lines.join("\n");
}

