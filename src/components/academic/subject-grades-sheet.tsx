"use client";

import { useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { useIsMobile } from "@/lib/use-is-mobile";
import { computeSubjectGradeStats } from "@/lib/data";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GradeForm } from "@/components/forms/grade-form";
import { formatDate } from "@/lib/format";
import {
  Award,
  Plus,
  Trash2,
  Calendar,
  CheckCircle2,
  BookOpen,
  Edit2,
  FileCheck,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Subject, Grade } from "@/lib/types";

interface SubjectGradesSheetProps {
  subject: Subject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubjectGradesSheet({
  subject,
  open,
  onOpenChange,
}: SubjectGradesSheetProps) {
  const { data, actions } = useData();
  const isMobile = useIsMobile();
  const [showAddGrade, setShowAddGrade] = useState(false);
  const [gradeToEdit, setGradeToEdit] = useState<Grade | undefined>(undefined);
  const [prefilledTitle, setPrefilledTitle] = useState("");

  if (!subject) return null;

  const subjectGrades = data.grades.filter((g) => g.subject_id === subject.id);
  const subjectTasks = data.tasks.filter((t) => t.subject_id === subject.id);
  const stats = computeSubjectGradeStats(subjectGrades);

  function handleStartAdd(taskTitle?: string) {
    setGradeToEdit(undefined);
    setPrefilledTitle(taskTitle || "");
    setShowAddGrade(true);
  }

  function handleStartEdit(grade: Grade) {
    setGradeToEdit(grade);
    setShowAddGrade(true);
  }

  function handleFormDone() {
    setShowAddGrade(false);
    setGradeToEdit(undefined);
    setPrefilledTitle("");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        /* En móvil abre como bottom sheet a pantalla completa (la base del
           Sheet fuerza w-3/4 en side=right y aplasta el contenido); en
           escritorio sigue siendo un panel lateral. */
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "h-[92dvh] max-h-[92dvh] rounded-t-2xl border-t p-0 sm:p-6"
            : "h-full w-full overflow-y-auto p-4 sm:max-w-md md:max-w-lg sm:p-6"
        }
      >
        <SheetHeader className="shrink-0 border-b px-4 pb-2 pt-4 sm:px-0 sm:pt-0">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold shadow-xs"
              style={{
                backgroundColor: `${subject.color}22`,
                color: subject.color,
                border: `1px solid ${subject.color}44`,
              }}
            >
              {subject.name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl font-bold truncate">
                {subject.name}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Notas, exámenes y ponderaciones de la asignatura
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-5 sm:px-0">
          <div className="space-y-6">
          {/* Tarjeta Resumen de Notas y Ponderaciones */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-primary" />
                Resumen Académico
              </span>
              {stats.count > 0 && (
                <Badge variant="secondary" className="text-[11px] font-medium">
                  {stats.count} {stats.count === 1 ? "nota" : "notas"}
                </Badge>
              )}
            </div>

            {/* Autoevaluación: dots 1-10 */}
            <div className="pt-2 pb-1">
              <p className="text-[11px] text-muted-foreground mb-2 font-medium">
                ¿Cómo la llevas? ({subject.self_rating ?? "—"}/10)
              </p>
              <div className="flex items-center gap-1.5 justify-center">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
                  const active = (subject.self_rating ?? 0) >= n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        actions.setSubjectRating(
                          subject.id,
                          subject.self_rating === n ? null : n,
                        )
                      }
                      className={cn(
                        "h-7 w-7 rounded-full border-2 text-[11px] font-bold transition-all duration-150 flex items-center justify-center",
                        active
                          ? "bg-primary border-primary text-primary-foreground scale-110 shadow-sm"
                          : "bg-background border-muted-foreground/25 text-muted-foreground hover:border-primary/60 hover:bg-primary/10",
                      )}
                      title={`${n}/10`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="rounded-lg bg-background p-2.5 shadow-xs border">
                <p className="text-[11px] text-muted-foreground">
                  {stats.totalWeight > 0 ? "Media ponderada" : "Media simple"}
                </p>
                <p
                  className={cn(
                    "text-xl font-bold mt-0.5",
                    stats.weightedAverage == null
                      ? "text-muted-foreground"
                      : stats.weightedAverage >= 7
                        ? "text-emerald-600 dark:text-emerald-400"
                        : stats.weightedAverage >= 5
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-red-600 dark:text-red-400",
                  )}
                >
                  {stats.weightedAverage != null
                    ? stats.weightedAverage.toFixed(2)
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">sobre 10</p>
              </div>

              <div className="rounded-lg bg-background p-2.5 shadow-xs border">
                <p className="text-[11px] text-muted-foreground">Evaluado</p>
                <p className="text-xl font-bold mt-0.5 text-foreground">
                  {stats.totalWeight}%
                </p>
                <p className="text-[10px] text-muted-foreground">de 100%</p>
              </div>

              <div className="rounded-lg bg-background p-2.5 shadow-xs border">
                <p className="text-[11px] text-muted-foreground">Puntos ganados</p>
                <p className="text-xl font-bold mt-0.5 text-primary">
                  {stats.accumulatedScore.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">acumulados</p>
              </div>
            </div>

            {/* Barra de progreso de porcentaje evaluado */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Progreso de evaluación</span>
                <span>{stats.totalWeight}% ponderado</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{
                    width: `${Math.min(Math.max(stats.totalWeight, 0), 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Formulario Añadir / Editar Nota */}
          {showAddGrade && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4" />
                  {gradeToEdit ? "Editar Calificación" : "Nueva Calificación"}
                </h4>
              </div>
              <GradeForm
                defaultSubjectId={subject.id}
                gradeToEdit={
                  gradeToEdit ||
                  (prefilledTitle
                    ? ({
                        id: "",
                        user_id: "",
                        subject_id: subject.id,
                        task_id: null,
                        title: prefilledTitle,
                        score: 0,
                        max_score: 10,
                        weight_percentage: null,
                        date: null,
                        notes: null,
                        created_at: "",
                        updated_at: "",
                      } as Grade)
                    : undefined)
                }
                onDone={handleFormDone}
              />
            </div>
          )}

          {/* Lista de Calificaciones */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Award className="h-4 w-4 text-amber-500" />
                Notas registradas ({subjectGrades.length})
              </h3>
              {!showAddGrade && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs rounded-lg"
                  onClick={() => handleStartAdd()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir nota
                </Button>
              )}
            </div>

            {subjectGrades.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground space-y-2">
                <Award className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">
                  Aún no tienes notas registradas en {subject.name}
                </p>
                <p className="text-xs">
                  Puedes añadirlas con el botón superior o diciéndoselo a tu
                  Secretario IA (ej.{" "}
                  <em>
                    &ldquo;He sacado un 8 en el examen de {subject.name} que
                    cuenta un 20%&rdquo;
                  </em>
                  ).
                </p>
                {!showAddGrade && (
                  <Button
                    size="sm"
                    className="mt-2 text-xs"
                    onClick={() => handleStartAdd()}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Registrar primera nota
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {subjectGrades.map((grade) => {
                  const max = grade.max_score > 0 ? grade.max_score : 10;
                  const normalized = (grade.score / max) * 10;
                  const scoreColor =
                    normalized >= 7
                      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : normalized >= 5
                        ? "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20"
                        : "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20";

                  const contribution =
                    grade.weight_percentage != null && grade.weight_percentage > 0
                      ? (
                          (normalized * grade.weight_percentage) /
                          100
                        ).toFixed(2)
                      : null;

                  return (
                    <div
                      key={grade.id}
                      className="rounded-xl border bg-card p-3.5 shadow-xs transition-colors hover:border-primary/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">
                              {grade.title}
                            </span>
                            {grade.weight_percentage != null ? (
                              <Badge
                                variant="secondary"
                                className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] font-semibold"
                              >
                                Cuenta {grade.weight_percentage}%
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-muted-foreground"
                              >
                                Sin peso %
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {grade.date && (
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(grade.date)}
                              </span>
                            )}
                            {contribution && (
                              <span className="text-primary font-medium">
                                Aporta +{contribution} pts al total
                              </span>
                            )}
                          </div>

                          {grade.notes && (
                            <p className="text-xs text-muted-foreground pt-1 border-t mt-1.5 italic">
                              &ldquo;{grade.notes}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Puntuación y acciones */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <div
                            className={cn(
                              "flex items-center justify-center rounded-lg border px-2.5 py-1 text-sm font-bold shadow-2xs",
                              scoreColor,
                            )}
                          >
                            <span>{grade.score}</span>
                            <span className="text-[11px] font-normal text-muted-foreground ml-0.5">
                              /{grade.max_score}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 mt-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleStartEdit(grade)}
                              title="Editar calificación"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => actions.deleteGrade(grade.id)}
                              title="Eliminar calificación"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tareas y Exámenes de esta asignatura */}
          <div className="space-y-3 pt-3 border-t">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-primary" />
              Exámenes y entregas de {subject.name}
            </h3>

            {subjectTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No hay tareas ni exámenes programados para esta asignatura.
              </p>
            ) : (
              <div className="space-y-2">
                {subjectTasks.map((task) => {
                  const done = task.status === "done";
                  const hasMatchingGrade = subjectGrades.some(
                    (g) =>
                      g.task_id === task.id ||
                      g.title.toLowerCase().trim() === task.title.toLowerCase().trim(),
                  );

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center justify-between gap-2.5 rounded-lg border p-2.5 text-xs transition-colors",
                        done ? "bg-muted/40 opacity-75" : "bg-card",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => actions.toggleTaskDone(task.id)}
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            done
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input hover:border-primary",
                          )}
                        >
                          {done && <Check className="h-3 w-3" />}
                        </button>
                        <div className="min-w-0 flex-1 truncate">
                          <p
                            className={cn(
                              "font-medium truncate",
                              done && "line-through text-muted-foreground",
                            )}
                          >
                            {task.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {task.type === "exam"
                              ? "Examen"
                              : task.type === "assignment"
                                ? "Entrega"
                                : "Tarea"}
                            {task.due_date ? ` · ${formatDate(task.due_date)}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {hasMatchingGrade ? (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Calificado
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2 rounded-md gap-1"
                            onClick={() => handleStartAdd(task.title)}
                          >
                            <Plus className="h-3 w-3" />
                            Poner nota
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
