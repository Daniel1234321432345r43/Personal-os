"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useData } from "@/components/providers/data-provider";
import { computeSubjectGradeStats } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { SubjectForm } from "@/components/forms/subject-form";
import { TaskForm } from "@/components/forms/task-form";
import { ClassroomConnect } from "./classroom-connect";
import { AiAssistant } from "./ai-assistant";
import { SubjectGradesSheet } from "./subject-grades-sheet";
import { Check, Plus, Trash2, Award, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskType, Subject } from "@/lib/types";

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

  if (!hydrated) return <LoadingState />;

  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  // Derivar el subject actual desde el estado vivo (no el snapshot stale de useState).
  const currentSubject = selectedSubject ? subjectById.get(selectedSubject.id) ?? selectedSubject : null;

  const academicTasks = data.tasks
    .filter((t) => t.subject_id || t.category === "academic")
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Estudios</h1>
        <p className="text-sm text-muted-foreground">
          Tus asignaturas, notas, ponderaciones, entregas y exámenes.
        </p>
      </header>

      {/* Asignaturas */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Asignaturas</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Haz clic en cualquier asignatura para ver sus notas, exámenes y ponderaciones
            </p>
          </div>
          <Button size="sm" onClick={() => setShowSubject((v) => !v)}>
            <Plus className="h-4 w-4" />
            Nueva
          </Button>
        </CardHeader>
        <CardContent>
          {showSubject && (
            <div className="mb-4 rounded-lg border bg-muted/30 p-4">
              <SubjectForm onDone={() => setShowSubject(false)} />
            </div>
          )}

          {data.subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tienes asignaturas. Añade la primera.
            </p>
          ) : (
            <motion.div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
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
                      hidden: { opacity: 0, y: 16 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.28, ease: "easeOut" },
                      },
                    }}
                    className="group relative flex flex-col justify-between rounded-xl border bg-card p-3.5 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm cursor-pointer"
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
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive opacity-80 group-hover:opacity-100"
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
        </CardContent>
      </Card>

      {/* Sheet de detalle de notas de la asignatura seleccionada */}
      <SubjectGradesSheet
        subject={currentSubject}
        open={!!currentSubject}
        onOpenChange={(open) => !open && setSelectedSubject(null)}
      />


      {/* Tareas y entregas */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Tareas y entregas</CardTitle>
          <Button size="sm" onClick={() => setShowTask((v) => !v)}>
            <Plus className="h-4 w-4" />
            Nueva
          </Button>
        </CardHeader>
        <CardContent>
          {showTask && (
            <div className="mb-4 rounded-lg border bg-muted/30 p-4">
              <TaskForm onDone={() => setShowTask(false)} />
            </div>
          )}

          {academicTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay tareas académicas todavía.
            </p>
          ) : (
            <motion.ul
              className="divide-y"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.045 } } }}
            >
              <AnimatePresence initial={false}>
              {academicTasks.map((task) => {
                const subject = task.subject_id
                  ? subjectById.get(task.subject_id)
                  : null;
                const done = task.status === "done";
                return (
                  <motion.li
                    key={task.id}
                    layout
                    variants={{
                      hidden: { opacity: 0, x: -14 },
                      visible: {
                        opacity: 1,
                        x: 0,
                        transition: { duration: 0.25 },
                      },
                    }}
                    exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <button
                      type="button"
                      onClick={() => actions.toggleTaskDone(task.id)}
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
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
                      <p className="text-xs text-muted-foreground">
                        {subject?.name ?? "General"} · {typeLabel[task.type]}
                        {task.due_date ? ` · ${formatDate(task.due_date)}` : ""}
                      </p>
                    </div>

                    <Badge variant="outline" className={priorityClass[task.priority]}>
                      {typeLabel[task.type]}
                    </Badge>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => actions.deleteTask(task.id)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.li>
                );
              })}
              </AnimatePresence>
            </motion.ul>
          )}
        </CardContent>
      </Card>

      {/* Asistente académico con IA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recomendaciones IA</CardTitle>
        </CardHeader>
        <CardContent>
          <AiAssistant />
        </CardContent>
      </Card>

      {/* Sincronización con Classroom */}
      <Card>
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
