import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateLong, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DayCell, DayEvents } from "./types";
import type { Subject } from "@/lib/types";
import { Check, Dumbbell } from "lucide-react";

interface AgendaDayItem {
  cell: DayCell;
  events: DayEvents;
}

interface AgendaViewProps {
  agendaDays: AgendaDayItem[];
  selectedDate: string;
  today: string;
  currentMonthName: string;
  currentYear: number;
  subjectById: Map<string, Subject>;
  onSelectDate: (key: string) => void;
  onToggleTaskDone: (id: string) => void;
}

export function AgendaView({
  agendaDays,
  selectedDate,
  today,
  currentMonthName,
  currentYear,
  subjectById,
  onSelectDate,
  onToggleTaskDone,
}: AgendaViewProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Agenda de {currentMonthName} {currentYear}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {agendaDays.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay eventos registrados en este mes con el filtro seleccionado.
          </p>
        ) : (
          agendaDays.map(({ cell, events }) => (
            <div
              key={cell.key}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                cell.key === selectedDate && "border-primary bg-primary/5",
                cell.key === today && "border-primary/40",
              )}
            >
              <div className="flex items-center justify-between border-b pb-2">
                <button
                  type="button"
                  onClick={() => onSelectDate(cell.key)}
                  className="flex items-center gap-2 text-sm font-semibold hover:underline"
                >
                  <span>{formatDateLong(cell.key)}</span>
                  {cell.key === today && (
                    <Badge variant="secondary" className="text-[10px]">
                      Hoy
                    </Badge>
                  )}
                </button>
              </div>

              <div className="mt-2.5 space-y-2">
                {/* Exámenes y entregas */}
                {[
                  ...events.exams,
                  ...events.assignments,
                  ...events.tasks,
                  ...events.studySessions,
                ].map((t) => {
                  const sub = t.subject_id ? subjectById.get(t.subject_id) : null;
                  const isDone = t.status === "done";
                  return (
                    <div
                      key={t.id}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleTaskDone(t.id)}
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            isDone
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-input",
                          )}
                        >
                          {isDone && (
                            <motion.span
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 26 }}
                              className="flex"
                            >
                              <Check className="h-3 w-3" />
                            </motion.span>
                          )}
                        </button>
                        <span
                          className={cn(
                            "min-w-0",
                            isDone && "line-through text-muted-foreground font-normal",
                            "font-medium",
                          )}
                        >
                          {t.title}
                        </span>
                        {sub && (
                          <span
                            className="shrink-0 rounded px-1.5 py-0.2 text-[10px]"
                            style={{ backgroundColor: `${sub.color}22`, color: sub.color }}
                          >
                            {sub.name}
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {t.type === "exam"
                          ? "Examen"
                          : t.type === "assignment"
                            ? "Entrega"
                            : "Tarea"}
                      </Badge>
                    </div>
                  );
                })}

                {/* Finanzas */}
                {[...events.incomes, ...events.expenses].map((tx) => (
                  <div
                    key={tx.id}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-xs"
                  >
                    <span className="min-w-0 font-medium">
                      {tx.category} {tx.description ? `· ${tx.description}` : ""}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-semibold",
                        tx.type === "income" ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatCurrency(Number(tx.amount))}
                    </span>
                  </div>
                ))}

                {/* Entrenamientos */}
                {events.workouts.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-md bg-purple-500/10 p-2 text-xs text-purple-900 dark:text-purple-200"
                  >
                    <span className="flex items-center gap-1 font-medium">
                      <Dumbbell className="h-3.5 w-3.5" />
                      {w.activity_type}
                    </span>
                    <span>{formatDuration(w.duration_minutes)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
