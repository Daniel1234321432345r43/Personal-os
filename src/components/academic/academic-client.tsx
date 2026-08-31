"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useData } from "@/components/providers/data-provider";
import { computeSubjectGradeStats } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import { formatDate } from "@/lib/format";
import { useIsDesktop } from "@/lib/use-is-mobile";
import { SubjectForm } from "@/components/forms/subject-form";
import { TaskForm } from "@/components/forms/task-form";
import { ClassroomConnect } from "./classroom-connect";
import { AiAssistant } from "./ai-assistant";
import { SubjectGradesSheet } from "./subject-grades-sheet";
import { Check, Plus, Trash2, Award, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskType, Subject, Task } from "@/lib/types";

const typeLabel: Record<TaskType, string> = {
  task: "Tarea",
  assignment: "Entrega",
  exam: "Examen",
  study_session: "Sesión de estudio",
};

const priorityClass: Record<TaskPriority, string> = {
  urgent: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  medium: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  low: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

/**
 * Fila de una tarea académica. Se reutiliza tanto en la lista de pendientes
 * como en el acordeón de tareas ya completadas.
 */
function TaskItem({
  task,
  subjectById,
  actions,
}: {
  task: Task;
  subjectById: Map<string, Subject>;
  actions: {
    toggleTaskDone: (id: string) => void;
    deleteTask: (id: string) => void;
  };
}) {
  const subject = task.subject_id ? subjectById.get(task.subject_id) : null;
  const done = task.status === "done";
  return (
    <motion.li
      layout
      variants={{
        hidden: { opacity: 0, x: -22 },
        visible: {
          opacity: 1,
          x: 0,
          transition: { duration: 0.55, ease: "easeOut" },
        },
      }}
      exit={{
        opacity: 0,
        x: 40,
        transition: { duration: 0.55, ease: "easeInOut" },
      }}
      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
    >
      <button
        type="button"
        onClick={() => actions.toggleTaskDone(task.id)}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors md:h-5 md:w-5",
          done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input hover:border-primary",
        )}
        aria-pressed={done}
        aria-label={`Completar ${task.title}`}
      >
        {done && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 26 }}
            className="flex"
          >
            <Check className="h-3.5 w-3.5" />
          </motion.span>
        )}
      </button>

      <span
        className="h-6 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: subject?.color ?? "#888" }}
      />

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {subject?.name ?? "General"}
          {task.due_date ? ` · ${formatDate(task.due_date)}` : ""}
        </p>
      </div>

      <Badge variant="outline" className={priorityClass[task.priority]}>
        {typeLabel[task.type]}
      </Badge>

      <Button
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive md:h-8 md:w-8"
        onClick={() => actions.deleteTask(task.id)}
        title="Eliminar"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </motion.li>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

export function AcademicClient() {
  const { data, hydrated, actions } = useData();
  const [showSubject, setShowSubject] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const isDesktop = useIsDesktop();

  if (!hydrated) return <LoadingState />;

  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  // Derivar el subject actual desde el estado vivo (no el snapshot stale de useState).
  const currentSubject = selectedSubject ? subjectById.get(selectedSubject.id) ?? selectedSubject : null;

  const academicTasks = data.tasks
    .filter((t) => t.subject_id || t.category === "academic")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  // Pendientes siempre visibles; completadas ocultas detrás del acordeón.
  const pendingTasks = academicTasks.filter((t) => t.status !== "done");
  const completedTasks = academicTasks.filter((t) => t.status === "done");

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Estudios</h1>
        <p className="text-sm text-muted-foreground">
          Tus asignaturas, notas, ponderaciones, entregas y exámenes.
        </p>
      </header>

      {/* Asignaturas (en móvil va debajo de Tareas y colapsada) */}
      <Card className="order-2 lg:order-1">
        <CardHeader className="pb-3">
          <div className="hidden lg:block">
            <CardTitle className="text-base">Asignaturas</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Haz clic en cualquier asignatura para ver sus notas, exámenes y ponderaciones
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubjectsOpen((v) => !v)}
            aria-expanded={subjectsOpen}
            className="flex w-full min-w-0 items-center gap-2 text-left lg:hidden"
          >
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">Asignaturas</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Haz clic en cualquier asignatura para ver sus notas, exámenes y ponderaciones
              </p>
            </div>
            <motion.span
              animate={{ rotate: subjectsOpen ? 180 : 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="shrink-0 text-muted-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </button>
        </CardHeader>

        <CardContent>
          <AnimatePresence initial={false}>
            {(isDesktop || subjectsOpen) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
                  opacity: { duration: 0.3 },
                }}
                className="overflow-hidden"
              >
          {/* Gestión de asignaturas: el botón solo aparece al expandir (o en escritorio, siempre visible porque la sección no se colapsa) */}
          <div className="mb-4 flex justify-end">
            <Button size="sm" onClick={() => setShowSubject((v) => !v)}>
              <Plus className="h-4 w-4" />
              Nueva asignatura
            </Button>
          </div>
          {/* Escritorio: formulario inline (como antes) */}
          <div className="mb-4 hidden rounded-lg border bg-muted/30 p-4 md:block">
            {showSubject && <SubjectForm onDone={() => setShowSubject(false)} />}
          </div>
          {/* Móvil: bottom sheet */}
          <ResponsiveFormSheet
            open={showSubject}
            onOpenChange={setShowSubject}
            title="Nueva asignatura"
          >
            <SubjectForm onDone={() => setShowSubject(false)} />
          </ResponsiveFormSheet>

          {data.subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tienes asignaturas. Añade la primera.
            </p>
          ) : (
            <motion.div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            >
              {data.subjects.map((subject) => {
                const pending = academicTasks.filter(
                  (t) => t.subject_id === subject.id && t.status !== "done",
                ).length;
                const subjectGrades = data.grades.filter(
                  (g) => g.subject_id === subject.id,
                );
                const stats = computeSubjectGradeStats(subjectGrades);

                return (
                  <motion.div
                    key={subject.id}
                    onClick={() => setSelectedSubject(subject)}
                    variants={{
                      hidden: { opacity: 0, y: 18 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.45, ease: "easeOut" },
                      },
                    }}
                    className="group relative flex flex-col justify-between rounded-xl border bg-card p-3.5 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm cursor-pointer active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-xs transition-transform group-hover:scale-105"
                          style={{
                            backgroundColor: `${subject.color}22`,
                            color: subject.color,
                            border: `1px solid ${subject.color}44`,
                          }}
                        >
                          {subject.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold group-hover:text-primary transition-colors">
                            {subject.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pending} pendiente{pending === 1 ? "" : "s"}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive opacity-80 group-hover:opacity-100 md:h-7 md:w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.deleteSubject(subject.id);
                          if (selectedSubject?.id === subject.id) {
                            setSelectedSubject(null);
                          }
                        }}
                        title="Eliminar asignatura"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Resumen de calificaciones de la asignatura */}
                    <div className="mt-3 flex items-center justify-between pt-2.5 border-t text-xs">
                      {stats.count > 0 ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <Award className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-semibold text-foreground">
                              {stats.weightedAverage != null
                                ? stats.weightedAverage.toFixed(1)
                                : stats.simpleAverage?.toFixed(1)}
                              <span className="text-[10px] text-muted-foreground font-normal">
                                /10
                              </span>
                            </span>
                          </div>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {stats.totalWeight > 0
                              ? `${stats.totalWeight}% evaluado`
                              : `${stats.count} nota${stats.count === 1 ? "" : "s"}`}
                          </span>
                        </>
                      ) : (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 group-hover:text-primary transition-colors">
                          Ver notas y exámenes
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Sheet de detalle de notas de la asignatura seleccionada */}
      <SubjectGradesSheet
        subject={currentSubject}
        open={!!currentSubject}
        onOpenChange={(open) => !open && setSelectedSubject(null)}
      />


      {/* Tareas y entregas (en móvil va primero) */}
      <Card className="order-1 lg:order-2">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Tareas y entregas</CardTitle>
          <Button size="sm" onClick={() => setShowTask((v) => !v)}>
            <Plus className="h-4 w-4" />
            Nueva
          </Button>
        </CardHeader>
        <CardContent>
          {/* Escritorio: formulario inline (como antes) */}
          <div className="mb-4 hidden rounded-lg border bg-muted/30 p-4 md:block">
            {showTask && <TaskForm onDone={() => setShowTask(false)} />}
          </div>
          {/* Móvil: bottom sheet */}
          <ResponsiveFormSheet
            open={showTask}
            onOpenChange={setShowTask}
            title="Nueva tarea o entrega"
          >
            <TaskForm onDone={() => setShowTask(false)} />
          </ResponsiveFormSheet>

          <>
            <motion.ul
              className="divide-y"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            >
              <AnimatePresence initial={academicTasks.length === 0}>
                {pendingTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    subjectById={subjectById}
                    actions={actions}
                  />
                ))}
              </AnimatePresence>
            </motion.ul>
            {academicTasks.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay tareas académicas todavía.
              </p>
            )}

            {completedTasks.length > 0 && (
              <div className="mt-2 border-t pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompleted((v) => !v)}
                  aria-expanded={isDesktop || showCompleted}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 lg:hidden"
                >
                  <span className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Completadas ({completedTasks.length})
                  </span>
                  <motion.span
                    animate={{ rotate: showCompleted ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {(isDesktop || showCompleted) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{
                        height: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
                        opacity: { duration: 0.25 },
                      }}
                      className="overflow-hidden"
                    >
                      <motion.ul
                        className="divide-y"
                        initial="hidden"
                        animate="visible"
                        variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
                      >
                        {completedTasks.map((task) => (
                          <TaskItem
                            key={task.id}
                            task={task}
                            subjectById={subjectById}
                            actions={actions}
                          />
                        ))}
                      </motion.ul>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        </CardContent>
      </Card>

      {/* Asistente académico con IA */}
      <Card className="order-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recomendaciones IA</CardTitle>
        </CardHeader>
        <CardContent>
          <AiAssistant />
        </CardContent>
      </Card>

      {/* Sincronización con Classroom */}
      <Card className="order-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Google Classroom</CardTitle>
        </CardHeader>
        <CardContent>
          <ClassroomConnect />
        </CardContent>
      </Card>
    </div>
  );
}
