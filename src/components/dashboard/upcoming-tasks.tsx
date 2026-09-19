"use client";

import { CalendarClock, Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { useData } from "@/components/providers/data-provider";
import type { DashboardData } from "@/lib/data";
import type { TaskPriority } from "@/lib/types";

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

const typeLabel: Record<string, string> = {
  exam: "Examen",
  assignment: "Entrega",
  study_session: "Estudio",
  task: "Tarea",
};

export function UpcomingTasks({ data }: { data: DashboardData }) {
  const { actions } = useData();
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));

  const upcoming = data.tasks
    .filter((t) => t.status !== "done" && t.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Próximas tareas y plazos</h3>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tienes tareas ni plazos pendientes. 🎉
        </p>
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subject?.name ?? "General"} · {typeLabel[task.type] ?? task.type}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge
                    variant="outline"
                    className={priorityBadge[task.priority]}
                  >
                    {priorityLabel[task.priority]}
                  </Badge>
                  {task.due_date && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" />
                      {formatDate(task.due_date)}
                    </span>
                  )}
                </div>
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
    </div>
  );
}
