import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DayCell, DayEvents, FilterType } from "./types";
import { WEEKDAYS } from "./types";
import {
  GraduationCap,
  FileText,
  BookOpen,
  CheckSquare,
  ArrowDownRight,
  ArrowUpRight,
  Dumbbell,
} from "lucide-react";

interface MonthGridProps {
  matrix: DayCell[];
  eventsByDate: Map<string, DayEvents>;
  selectedDate: string;
  today: string;
  filter: FilterType;
  onSelectDate: (key: string) => void;
}

export function MonthGrid({
  matrix,
  eventsByDate,
  selectedDate,
  today,
  filter,
  onSelectDate,
}: MonthGridProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-2 sm:p-4">
        {/* Cabecera de días de la semana */}
        <div className="grid grid-cols-7 gap-1 border-b pb-2 text-center text-xs font-semibold text-muted-foreground">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Cuadrícula de días */}
        <div className="grid grid-cols-7 gap-1 pt-2">
          {matrix.map((cell) => {
            const isToday = cell.key === today;
            const isSelected = cell.key === selectedDate;
            const ev = eventsByDate.get(cell.key);

            // Filtrar elementos según el filtro activo
            const showExams = filter === "all" || filter === "academic";
            const showAssignments = filter === "all" || filter === "academic";
            const showStudy =
              filter === "all" || filter === "academic" || filter === "tasks";
            const showTasks = filter === "all" || filter === "tasks";
            const showFinance = filter === "all" || filter === "finance";
            const showSport = filter === "all" || filter === "sport";

            const examsList = showExams ? ev?.exams || [] : [];
            const assignmentsList = showAssignments ? ev?.assignments || [] : [];
            const studySessionsList = showStudy ? ev?.studySessions || [] : [];
            const tasksList = showTasks ? ev?.tasks || [] : [];
            const incomesList = showFinance ? ev?.incomes || [] : [];
            const expensesList = showFinance ? ev?.expenses || [] : [];
            const workoutsList = showSport ? ev?.workouts || [] : [];

            const totalBadges =
              examsList.length +
              assignmentsList.length +
              studySessionsList.length +
              tasksList.length +
              incomesList.length +
              expensesList.length +
              workoutsList.length;

            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => onSelectDate(cell.key)}
                className={cn(
                  "group relative flex min-h-[56px] flex-col rounded-lg border p-1 text-left transition-all md:min-h-[84px] md:p-1.5 lg:min-h-[66px]",
                  cell.isCurrentMonth
                    ? "bg-card hover:bg-muted/40"
                    : "bg-muted/20 text-muted-foreground/60 opacity-60",
                  isSelected && "ring-2 ring-primary border-primary",
                  isToday && !isSelected && "border-primary/50 bg-primary/5",
                )}
              >
                {/* Cabecera del día */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground group-hover:text-primary",
                    )}
                  >
                    {cell.dayNumber}
                  </span>

                  {totalBadges > 0 && (
                    <span className="hidden sm:inline-block text-[10px] font-medium text-muted-foreground">
                      {totalBadges} {totalBadges === 1 ? "evento" : "eventos"}
                    </span>
                  )}
                </div>

                {/* Eventos dentro de la celda */}
                <div className="mt-1 flex flex-1 flex-col gap-0.5 overflow-hidden">
                  {/* Exámenes */}
                  {examsList.slice(0, 2).map((exam) => (
                    <div
                      key={exam.id}
                      className="flex items-center gap-1 truncate rounded bg-red-500/15 px-1 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300 border border-red-500/20"
                      title={`Examen: ${exam.title}`}
                    >
                      <GraduationCap className="h-3 w-3 shrink-0" />
                      <span className="truncate">{exam.title}</span>
                    </div>
                  ))}

                  {/* Entregas */}
                  {assignmentsList.slice(0, 2).map((assign) => (
                    <div
                      key={assign.id}
                      className="flex items-center gap-1 truncate rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 border border-amber-500/20"
                      title={`Entrega: ${assign.title}`}
                    >
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{assign.title}</span>
                    </div>
                  ))}

                  {/* Sesiones de estudio (1/N, 2/N) */}
                  {studySessionsList.slice(0, 2).map((study) => (
                    <div
                      key={study.id}
                      className="flex items-center gap-1 truncate rounded bg-indigo-500/15 px-1 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300 border border-indigo-500/20"
                      title={`Sesión de estudio: ${study.title}`}
                    >
                      <BookOpen className="h-3 w-3 shrink-0" />
                      <span className="truncate">{study.title}</span>
                    </div>
                  ))}

                  {/* Tareas */}
                  {tasksList.slice(0, 1).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-1 truncate rounded bg-blue-500/15 px-1 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-500/20"
                      title={`Tarea: ${t.title}`}
                    >
                      <CheckSquare className="h-3 w-3 shrink-0" />
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}

                  {/* Gastos / Ingresos */}
                  {expensesList.length > 0 && (
                    <div className="flex items-center gap-1 truncate rounded bg-rose-500/15 px-1 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
                      <ArrowDownRight className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        -{formatCurrency(expensesList.reduce((a, b) => a + Number(b.amount), 0))}
                      </span>
                    </div>
                  )}

                  {incomesList.length > 0 && (
                    <div className="flex items-center gap-1 truncate rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      <ArrowUpRight className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        +{formatCurrency(incomesList.reduce((a, b) => a + Number(b.amount), 0))}
                      </span>
                    </div>
                  )}

                  {/* Entrenamientos */}
                  {workoutsList.slice(0, 1).map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center gap-1 truncate rounded bg-purple-500/15 px-1 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300"
                      title={`Entrenamiento: ${w.activity_type}`}
                    >
                      <Dumbbell className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {w.activity_type} ({formatDuration(w.duration_minutes)})
                      </span>
                    </div>
                  ))}

                  {/* Indicador de más eventos */}
                  {totalBadges > 3 && (
                    <div className="text-[9px] font-semibold text-muted-foreground text-center pt-0.5">
                      +{totalBadges - 3} más
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
