import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import { TaskForm } from "@/components/forms/task-form";
import { TransactionForm } from "@/components/forms/transaction-form";
import { WorkoutForm } from "@/components/forms/workout-form";
import { formatCurrency, formatDateLong, formatDuration } from "@/lib/format";
import { studyMinutesForTask } from "@/lib/study-summary";
import { cn } from "@/lib/utils";
import type { DayEvents } from "./types";
import type { Subject, Task } from "@/lib/types";
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Check,
  Dumbbell,
  Clock,
  BookOpen,
} from "lucide-react";

interface DayDetailPanelProps {
  selectedDate: string;
  today: string;
  selectedDayEvents: DayEvents;
  subjectById: Map<string, Subject>;
  studyByTask: ReadonlyMap<string, number>;
  allTasks: Task[];
  activeModal: "task" | "transaction" | "workout" | null;
  onSetActiveModal: (modal: "task" | "transaction" | "workout" | null) => void;
  onToggleTaskDone: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDeleteTransaction: (id: string) => void;
  onDeleteWorkout: (id: string) => void;
}

export function DayDetailPanel({
  selectedDate,
  today,
  selectedDayEvents,
  subjectById,
  studyByTask,
  allTasks,
  activeModal,
  onSetActiveModal,
  onToggleTaskDone,
  onDeleteTask,
  onDeleteTransaction,
  onDeleteWorkout,
}: DayDetailPanelProps) {
  const selectedDayHasEvents =
    selectedDayEvents.exams.length > 0 ||
    selectedDayEvents.assignments.length > 0 ||
    selectedDayEvents.tasks.length > 0 ||
    selectedDayEvents.studySessions.length > 0 ||
    selectedDayEvents.incomes.length > 0 ||
    selectedDayEvents.expenses.length > 0 ||
    selectedDayEvents.workouts.length > 0;

  const dayTotalIncome = selectedDayEvents.incomes.reduce(
    (acc, i) => acc + Number(i.amount),
    0,
  );
  const dayTotalExpenses = selectedDayEvents.expenses.reduce(
    (acc, e) => acc + Number(e.amount),
    0,
  );
  const dayNet = dayTotalIncome - dayTotalExpenses;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Detalle del día</CardTitle>
          <p className="text-xs text-muted-foreground">
            {formatDateLong(selectedDate)}
          </p>
        </div>
        {selectedDate === today && (
          <Badge
            variant="outline"
            className="border-primary/40 bg-primary/10 text-primary"
          >
            Hoy
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Botones de acción rápida para añadir al día seleccionado */}
        <div className="flex flex-wrap gap-1.5 border-b pb-3">
          <Button
            size="sm"
            variant="outline"
            className="h-11 text-xs md:h-7"
            onClick={() =>
              onSetActiveModal(activeModal === "task" ? null : "task")
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Tarea / Examen
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-11 text-xs md:h-7"
            onClick={() =>
              onSetActiveModal(activeModal === "transaction" ? null : "transaction")
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Transacción
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-11 text-xs md:h-7"
            onClick={() =>
              onSetActiveModal(activeModal === "workout" ? null : "workout")
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Deporte
          </Button>
        </div>

        {/* Formularios desplegables (escritorio: inline; móvil: bottom sheet) */}
        {activeModal === "task" && (
          <div className="hidden rounded-lg border bg-muted/40 p-3 md:block">
            <p className="mb-2 text-xs font-semibold">
              Nueva tarea / examen para {selectedDate}:
            </p>
            <TaskForm
              initialDueDate={selectedDate}
              onDone={() => onSetActiveModal(null)}
            />
          </div>
        )}
        <ResponsiveFormSheet
          open={activeModal === "task"}
          onOpenChange={(open) => !open && onSetActiveModal(null)}
          title={`Nueva tarea para ${formatDateLong(selectedDate)}`}
        >
          <TaskForm
            initialDueDate={selectedDate}
            onDone={() => onSetActiveModal(null)}
          />
        </ResponsiveFormSheet>

        {activeModal === "transaction" && (
          <div className="hidden rounded-lg border bg-muted/40 p-3 md:block">
            <p className="mb-2 text-xs font-semibold">
              Nueva transacción para {selectedDate}:
            </p>
            <TransactionForm
              initialDate={selectedDate}
              onDone={() => onSetActiveModal(null)}
            />
          </div>
        )}
        <ResponsiveFormSheet
          open={activeModal === "transaction"}
          onOpenChange={(open) => !open && onSetActiveModal(null)}
          title={`Nueva transacción para ${formatDateLong(selectedDate)}`}
        >
          <TransactionForm
            initialDate={selectedDate}
            onDone={() => onSetActiveModal(null)}
          />
        </ResponsiveFormSheet>

        {activeModal === "workout" && (
          <div className="hidden rounded-lg border bg-muted/40 p-3 md:block">
            <p className="mb-2 text-xs font-semibold">
              Nuevo entrenamiento para {selectedDate}:
            </p>
            <WorkoutForm
              initialDate={selectedDate}
              onDone={() => onSetActiveModal(null)}
            />
          </div>
        )}
        <ResponsiveFormSheet
          open={activeModal === "workout"}
          onOpenChange={(open) => !open && onSetActiveModal(null)}
          title={`Nuevo entrenamiento para ${formatDateLong(selectedDate)}`}
        >
          <WorkoutForm
            initialDate={selectedDate}
            onDone={() => onSetActiveModal(null)}
          />
        </ResponsiveFormSheet>

        {/* Lista de eventos del día (con animación al cambiar de día) */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selectedDate}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <motion.div
              key={`${selectedDate}-vacio`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className={cn(
                "py-8 text-center text-sm text-muted-foreground",
                selectedDayHasEvents && "hidden",
              )}
            >
              <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
              No hay eventos registrados para este día.
            </motion.div>

            <div className="space-y-4 divide-y">
              {/* Exámenes y entregas */}
              <div
                className={cn(
                  "space-y-2 pt-2 first:pt-0",
                  selectedDayEvents.exams.length === 0 &&
                    selectedDayEvents.assignments.length === 0 &&
                    selectedDayEvents.tasks.length === 0 &&
                    selectedDayEvents.studySessions.length === 0 &&
                    "hidden",
                )}
              >
                <motion.p
                  key={`${selectedDate}-estudios`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Estudios y tareas
                </motion.p>
                <ul className="space-y-2">
                  <AnimatePresence initial={true}>
                    {[
                      ...selectedDayEvents.exams,
                      ...selectedDayEvents.assignments,
                      ...selectedDayEvents.tasks,
                      ...selectedDayEvents.studySessions,
                    ].map((t) => {
                      const sub = t.subject_id
                        ? subjectById.get(t.subject_id)
                        : null;
                      const isDone = t.status === "done";
                      // Las horas de un examen incluyen los bloques de estudio
                      // del día («Estudiar para el examen de X»).
                      const studiedMinutes = studyMinutesForTask(
                        studyByTask,
                        t,
                        allTasks,
                      );
                      return (
                        <motion.li
                          key={t.id}
                          layout
                          initial={{ opacity: 0, y: -16, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{
                            opacity: 0,
                            x: 40,
                            transition: { duration: 0.55, ease: "easeInOut" },
                          }}
                          transition={{ duration: 0.55, ease: "easeOut" }}
                          className="flex items-start justify-between gap-2 rounded-lg border bg-card p-2.5 text-xs"
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => onToggleTaskDone(t.id)}
                              className={cn(
                                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                isDone
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-input hover:border-primary",
                              )}
                              title="Marcar como hecha"
                            >
                              {isDone && (
                                <motion.span
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 26,
                                  }}
                                  className="flex"
                                >
                                  <Check className="h-3 w-3" />
                                </motion.span>
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p
                                className={cn(
                                  "font-medium truncate",
                                  isDone && "line-through text-muted-foreground",
                                )}
                              >
                                {t.title}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {t.type === "exam"
                                    ? "Examen"
                                    : t.type === "assignment"
                                      ? "Entrega"
                                      : t.type === "study_session"
                                        ? "Estudio"
                                        : "Tarea"}
                                </Badge>
                                {t.session_index && t.total_sessions && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] py-0 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
                                  >
                                    Parte {t.session_index}/{t.total_sessions}
                                  </Badge>
                                )}
                                {sub && (
                                  <span
                                    className="rounded px-1.5 py-0.2 font-medium"
                                    style={{
                                      backgroundColor: `${sub.color}22`,
                                      color: sub.color,
                                    }}
                                  >
                                    {sub.name}
                                  </span>
                                )}
                                {t.estimated_minutes && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> {t.estimated_minutes} min
                                  </span>
                                )}
                                {studiedMinutes > 0 && (
                                  <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                                    <BookOpen className="h-3 w-3" />
                                    {formatDuration(studiedMinutes)} dedicados
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => onDeleteTask(t.id)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              </div>

              {/* Finanzas */}
              <div
                className={cn(
                  "space-y-2 pt-3",
                  selectedDayEvents.incomes.length === 0 &&
                    selectedDayEvents.expenses.length === 0 &&
                    "hidden",
                )}
              >
                <motion.div
                  key={`${selectedDate}-finanzas`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.12 }}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-muted-foreground">
                    Finanzas del día
                  </span>
                  <span
                    className={cn(
                      "font-bold",
                      dayNet >= 0 ? "text-emerald-600" : "text-rose-600",
                    )}
                  >
                    Balance: {dayNet >= 0 ? "+" : ""}
                    {formatCurrency(dayNet)}
                  </span>
                </motion.div>
                <ul className="space-y-1.5">
                  <AnimatePresence initial={true}>
                    {[...selectedDayEvents.incomes, ...selectedDayEvents.expenses].map(
                      (tx) => (
                        <motion.li
                          key={tx.id}
                          layout
                          initial={{ opacity: 0, y: -16, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{
                            opacity: 0,
                            x: 40,
                            transition: { duration: 0.55, ease: "easeInOut" },
                          }}
                          transition={{ duration: 0.55, ease: "easeOut" }}
                          className="flex items-center justify-between rounded-lg border bg-card p-2 text-xs"
                        >
                          <div>
                            <p className="font-medium">{tx.category}</p>
                            {tx.description && (
                              <p className="text-[11px] text-muted-foreground">
                                {tx.description}
                              </p>
                            )}
                          </div>
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn(
                                "font-semibold",
                                tx.type === "income"
                                  ? "text-emerald-600"
                                  : "text-rose-600",
                              )}
                            >
                              {tx.type === "income" ? "+" : "-"}
                              {formatCurrency(Number(tx.amount))}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => onDeleteTransaction(tx.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </motion.li>
                      ),
                    )}
                  </AnimatePresence>
                </ul>
              </div>

              {/* Entrenamientos */}
              <div
                className={cn(
                  "space-y-2 pt-3",
                  selectedDayEvents.workouts.length === 0 && "hidden",
                )}
              >
                <motion.p
                  key={`${selectedDate}-deporte`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.19 }}
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Deporte y entrenamiento
                </motion.p>
                <ul className="space-y-1.5">
                  <AnimatePresence initial={true}>
                    {selectedDayEvents.workouts.map((w) => (
                      <motion.li
                        key={w.id}
                        layout
                        initial={{ opacity: 0, y: -16, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{
                          opacity: 0,
                          x: 40,
                          transition: { duration: 0.55, ease: "easeInOut" },
                        }}
                        transition={{ duration: 0.55, ease: "easeOut" }}
                        className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-purple-500/5 p-2 text-xs text-purple-900 dark:text-purple-200"
                      >
                        <div>
                          <p className="font-medium flex items-center gap-1">
                            <Dumbbell className="h-3.5 w-3.5" />
                            {w.activity_type} {w.title ? `· ${w.title}` : ""}
                          </p>
                          {w.notes && (
                            <p className="text-[11px] opacity-80">{w.notes}</p>
                          )}
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="font-semibold">
                            {formatDuration(w.duration_minutes)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => onDeleteWorkout(w.id)}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
