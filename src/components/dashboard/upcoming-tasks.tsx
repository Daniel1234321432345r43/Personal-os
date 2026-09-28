"use client";

import Link from "next/link";
import { CalendarClock, Check, GraduationCap, ListTodo, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useData } from "@/components/providers/data-provider";
import type { DashboardData } from "@/lib/data";
import type { Task, TaskPriority } from "@/lib/types";

const priorityBadge: Record<TaskPriority, string> = {
  urgent: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  medium: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  low: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

const priorityLabel: Record<TaskPriority, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export type UpcomingKind = "exams" | "tasks";

/** Días naturales que faltan hasta una fecha `YYYY-MM-DD`. */
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/** Etiqueta corta de cuenta atrás: «hoy», «mañana» o «6 d». */
function countdown(iso: string): string {
  const days = daysUntil(iso);
  if (days <= 0) return "hoy";
  if (days === 1) return "mañana";
  return `${days} d`;
}

/** Para un examen, lo urgente es cuánto queda: el propio badge lo colorea. */
function examBadge(iso: string): string {
  const days = daysUntil(iso);
  if (days <= 1) return "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400";
  if (days <= 3) return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400";
}

const kindMeta: Record<
  UpcomingKind,
  { title: string; empty: string; limit: number; icon: typeof ListTodo }
> = {
  exams: {
    title: "Exámenes",
    empty: "No tienes exámenes próximos.",
    limit: 5,
    icon: GraduationCap,
  },
  tasks: {
    title: "Tareas y entregas",
    empty: "No tienes tareas ni entregas pendientes. 🎉",
    limit: 5,
    icon: ListTodo,
  },
};

/**
 * Plazos próximos del panel. Los exámenes viven en su propia tarjeta
 * (`kind: "exams"`) y el resto —entregas, tareas y sesiones de estudio— en la
 * suya (`kind: "tasks"`). Antes era una única lista mezclada: con diez exámenes
 * en el horizonte las tareas quedaban enterradas y había que buscarlas para
 * marcarlas como hechas.
 */
export function UpcomingTasks({
  data,
  kind,
}: {
  data: DashboardData;
  kind: UpcomingKind;
}) {
  const { actions } = useData();
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  const { title, empty, limit, icon: Icon } = kindMeta[kind];
  const isExam = (t: Task) => t.type === "exam";

  const all = data.tasks
    .filter((t) => t.status !== "done" && t.due_date)
    .filter((t) => (kind === "exams" ? isExam(t) : !isExam(t)))
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const upcoming = all.slice(0, limit);
  const hidden = all.length - upcoming.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{title}</span>
        </h3>
        <Link
          href="/academic"
          className="shrink-0 text-xs font-medium text-primary"
        >
          Ver todas
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {upcoming.map((task) => {
            const subject = task.subject_id
              ? subjectById.get(task.subject_id)
              : null;
            return (
              <li
                key={task.id}
                className="flex items-center gap-2.5 rounded-lg border bg-card p-2.5 transition-colors motion-safe:hover:bg-muted/50"
              >
                <span
                  className="h-8 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: subject?.color ?? "#888" }}
                />
                {/* Una sola pista por línea: subtítulo «materia · fecha» y en
                    el badge el dato que de verdad decide —cuánto queda para un
                    examen, la prioridad en el resto—. Con fecha y prioridad
                    apiladas a la derecha el título quedaba en «Examen de…». */}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">
                    {task.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subject?.name ?? "General"}
                    {task.due_date && (
                      <>
                        {" · "}
                        <CalendarClock className="inline h-3 w-3 -translate-y-px" />
                        {formatDate(task.due_date)}
                      </>
                    )}
                  </p>
                </div>
                {kind === "exams" && task.due_date ? (
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${examBadge(task.due_date)}`}
                    title={`Examen ${countdown(task.due_date)}`}
                  >
                    {countdown(task.due_date)}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${priorityBadge[task.priority]}`}
                  >
                    {priorityLabel[task.priority]}
                  </Badge>
                )}
                {/* Acciones en el propio widget: sin esto había tareas que solo
                    se veían aquí y no se podían ni completar ni borrar. */}
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                    onClick={() => actions.toggleTaskDone(task.id)}
                    title="Marcar como hecha"
                  >
                    <Check className="h-4 w-4" />
                    <span className="sr-only">Completar {task.title}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => actions.deleteTask(task.id)}
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Eliminar {task.title}</span>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hidden > 0 && (
        <Link
          href="/academic"
          className="block pl-1 text-xs text-muted-foreground hover:text-foreground"
        >
          +{hidden} más en Estudios
        </Link>
      )}
    </div>
  );
}
