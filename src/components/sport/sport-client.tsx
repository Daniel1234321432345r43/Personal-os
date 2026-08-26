"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useData } from "@/components/providers/data-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import { MobileCollapsible } from "@/components/ui/mobile-collapsible";
import { formatDate, formatDuration, todayKey } from "@/lib/format";
import { WorkoutForm } from "@/components/forms/workout-form";
import { HabitForm } from "@/components/forms/habit-form";
import { Check, Dumbbell, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

function daysAgoKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function LoadingState() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

export function SportClient() {
  const { data, hydrated, actions } = useData();
  const [showWorkout, setShowWorkout] = useState(false);
  const [showHabit, setShowHabit] = useState(false);

  if (!hydrated) return <LoadingState />;

  const today = todayKey();

  const weekWorkouts = data.workouts.filter((w) => w.date >= daysAgoKey(6));
  const totalMinutes = weekWorkouts.reduce((s, w) => s + w.duration_minutes, 0);
  const todayMinutes = data.workouts
    .filter((w) => w.date === today)
    .reduce((s, w) => s + w.duration_minutes, 0);

  const activityCount = new Map<string, number>();
  data.workouts.forEach((w) =>
    activityCount.set(w.activity_type, (activityCount.get(w.activity_type) ?? 0) + 1),
  );
  const favorite =
    [...activityCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const completedToday = data.habitCompletions.filter(
    (c) => c.completed_on === today,
  ).length;

  const sorted = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date));

  const stats = [
    { label: "Entrenamientos (7 días)", value: String(weekWorkouts.length) },
    { label: "Minutos esta semana", value: formatDuration(totalMinutes) },
    { label: "Hoy", value: todayMinutes ? formatDuration(todayMinutes) : "—" },
    { label: "Actividad favorita", value: favorite },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Deporte</h1>
        <p className="text-sm text-muted-foreground">
          Registra tus entrenamientos y hábitos diarios.
        </p>
      </header>

      {/* Métricas: escritorio en cuadrícula (como antes) */}
      <div className="hidden grid-cols-4 gap-3 lg:grid">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="truncate text-xs text-muted-foreground">{s.label}</p>
              <p className="truncate text-lg font-semibold tracking-tight">
                {s.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Métricas en móvil: tarjeta colapsable con animación de despliegue */}
      <div className="lg:hidden">
        <MobileCollapsible
          title="Resumen"
          subtitle="Últimos 7 días"
          icon={<Dumbbell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
        >
          <dl className="divide-y">
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <dt className="text-muted-foreground">{s.label}</dt>
                <dd className="shrink-0 font-semibold tracking-tight">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </MobileCollapsible>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Entrenamientos */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Entrenamientos</CardTitle>
            <Button size="sm" onClick={() => setShowWorkout((v) => !v)}>
              <Plus className="h-4 w-4" />
              Nuevo
            </Button>
          </CardHeader>
          <CardContent>
            {/* Escritorio: formulario inline (como antes) */}
            <div className="mb-4 hidden rounded-lg border bg-muted/30 p-4 md:block">
              {showWorkout && <WorkoutForm onDone={() => setShowWorkout(false)} />}
            </div>
            {/* Móvil: bottom sheet */}
            <ResponsiveFormSheet
              open={showWorkout}
              onOpenChange={setShowWorkout}
              title="Nuevo entrenamiento"
            >
              <WorkoutForm onDone={() => setShowWorkout(false)} />
            </ResponsiveFormSheet>

            <>
              <ul className="divide-y">
                <AnimatePresence initial={sorted.length === 0}>
                {sorted.map((w) => (
                  <motion.li
                    key={w.id}
                    layout
                    initial={{ opacity: 0, y: -18, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      x: 40,
                      transition: { duration: 0.55, ease: "easeInOut" },
                    }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Dumbbell className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {w.activity_type}
                        {w.title ? ` — ${w.title}` : ""}
                      </p>
                      {w.notes && (
                        <p className="truncate text-xs text-muted-foreground">
                          {w.notes}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium">
                        {formatDuration(w.duration_minutes)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(w.date)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive md:h-8 md:w-8"
                      onClick={() => actions.deleteWorkout(w.id)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.li>
                ))}
                </AnimatePresence>
              </ul>
              {sorted.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aún no has registrado entrenamientos.
                </p>
              )}
            </>
          </CardContent>
        </Card>

        {/* Hábitos */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Hábitos</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowHabit((v) => !v)}>
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Escritorio: formulario inline (como antes) */}
            <div className="hidden rounded-lg border bg-muted/30 p-4 md:block">
              {showHabit && <HabitForm onDone={() => setShowHabit(false)} />}
            </div>
            {/* Móvil: bottom sheet */}
            <ResponsiveFormSheet
              open={showHabit}
              onOpenChange={setShowHabit}
              title="Nuevo hábito"
            >
              <HabitForm onDone={() => setShowHabit(false)} />
            </ResponsiveFormSheet>

            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                {completedToday} de {data.habits.length} completados hoy.
              </p>
              <ul className="space-y-1">
                <AnimatePresence initial={data.habits.length === 0}>
                {data.habits.map((h) => {
                  const done = data.habitCompletions.some(
                    (c) => c.habit_id === h.id && c.completed_on === today,
                  );
                  return (
                    <motion.li
                      key={h.id}
                      layout
                      initial={{ opacity: 0, y: -18, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        x: 40,
                        transition: { duration: 0.55, ease: "easeInOut" },
                      }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
                        className="flex items-center gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => actions.toggleHabit(h.id)}
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors md:h-5 md:w-5",
                            done
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input hover:border-primary",
                          )}
                          aria-pressed={done}
                          aria-label={`Marcar ${h.name}`}
                        >
                          <AnimatePresence>
                            {done && (
                              <motion.span
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 26 }}
                                className="flex"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </button>
                        <span className="text-sm">{h.emoji}</span>
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate text-sm",
                            done && "text-muted-foreground line-through",
                          )}
                        >
                          {h.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive md:h-7 md:w-7"
                          onClick={() => actions.deleteHabit(h.id)}
                          title="Eliminar hábito"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </div>
            {data.habits.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sin hábitos. Añade uno para empezar a seguirlo.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
