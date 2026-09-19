"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ListTodo,
  CalendarClock,
  Dumbbell,
  Wallet,
  GraduationCap,
  ChevronRight,
  Check,
  Trash2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useData } from "@/components/providers/data-provider";
import { formatCurrency, formatDuration, todayKey } from "@/lib/format";
import type { DashboardData } from "@/lib/data";

const MotionLink = motion.create(Link);

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function StatCards({ data }: { data: DashboardData }) {
  const { actions } = useData();
  const today = todayKey();

  const pendingTasks = data.tasks.filter((t) => t.status !== "done");
  const pending = pendingTasks.length;

  const upcoming = data.tasks
    .filter(
      (t) =>
        (t.type === "assignment" || t.type === "exam") &&
        t.status !== "done" &&
        t.due_date,
    )
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  const nextDue = upcoming[0]?.due_date ?? null;
  const nextDays = daysUntil(nextDue);

  const sportToday = data.workouts.filter((w) => w.date === today);
  const sportTodayMinutes = sportToday.reduce(
    (sum, w) => sum + w.duration_minutes,
    0,
  );
  const completedToday = data.habitCompletions.filter(
    (c) => c.completed_on === today,
  ).length;

  const cards = [
    {
      label: "Tareas pendientes",
      value: String(pending),
      sub: "por completar",
      icon: ListTodo,
      tint: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
    },
    {
      label: "Próxima entrega",
      value:
        nextDays == null
          ? "—"
          : nextDays <= 0
            ? "¡Hoy!"
            : `${nextDays} d`,
      sub: nextDays == null ? "sin entregas" : `en ${nextDays ?? 0} día(s)`,
      icon: CalendarClock,
      tint: "text-violet-600 dark:text-violet-400 bg-violet-500/10",
    },
    {
      label: "Deporte hoy",
      value: sportTodayMinutes ? formatDuration(sportTodayMinutes) : "—",
      sub: sportTodayMinutes ? "de actividad" : "sin entrenar aún",
      icon: Dumbbell,
      tint: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    },
    {
      label: "Balance del mes",
      value: formatCurrency(data.finance.balance),
      sub:
        data.finance.budget != null
          ? `de ${formatCurrency(data.finance.budget)} de presupuesto`
          : "ingresos - gastos",
      icon: Wallet,
      tint: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
    },
  ];

  // Press / hover con física suave; la entrada a la pestaña la anima AppShell.
  const cardSpring = { type: "spring", stiffness: 500, damping: 32 } as const;
  // `min-w-0` es imprescindible: las tarjetas son ítems de un grid y, sin esa
  // restricción, su ancho mínimo lo marca el contenido (títulos de tarea largos
  // con `truncate`, que no pueden partirse) y la cuadrícula desborda la pantalla.
  const cardClass =
    "flex min-w-0 flex-col overflow-hidden rounded-xl border bg-muted/40 p-3.5 transition-shadow duration-200 ease-out motion-safe:hover:shadow-md";

  return (
    <>
      {/* ── Móvil: Bento grid asimétrico (solo < lg) ─────────────────── */}
      <div className="grid auto-rows-fr grid-cols-2 gap-3 lg:hidden">
        {/* Deporte (columna izquierda, superior) → /sport */}
        <MotionLink
          href="/sport"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          transition={cardSpring}
          className={`col-start-1 row-start-1 gap-1.5 ${cardClass}`}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Dumbbell className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">Deporte</span>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-xs text-muted-foreground">
            {sportToday.length > 0
              ? `${sportToday.length} entrenamiento${sportToday.length === 1 ? "" : "s"} · ${formatDuration(sportTodayMinutes)} hoy`
              : "Sin entrenar aún hoy"}
          </p>
          {sportToday.length > 0 && (
            <ul className="min-w-0 space-y-1 text-xs text-muted-foreground">
              {sportToday.slice(0, 2).map((w) => (
                <li key={w.id} className="truncate">
                  <span className="mr-1.5 text-emerald-600 dark:text-emerald-400">
                    •
                  </span>
                  {w.activity_type} · {formatDuration(w.duration_minutes)}
                </li>
              ))}
            </ul>
          )}
          {sportToday.length === 0 && data.habits.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {completedToday} de {data.habits.length} hábitos hoy
            </p>
          )}
        </MotionLink>

        {/* Finanzas (columna izquierda, inferior) → /finance */}
        <MotionLink
          href="/finance"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          transition={cardSpring}
          className={`col-start-1 row-start-2 gap-1 ${cardClass}`}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Wallet className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">Finanzas</span>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-xs text-muted-foreground">Balance del mes</p>
          <p className="truncate text-lg font-semibold tracking-tight">
            {formatCurrency(data.finance.balance)}
          </p>
        </MotionLink>

        {/* Estudios (columna derecha, ocupa el alto completo) → /academic.
            La tarjeta entera ya no es un enlace: cada fila lleva sus propias
            acciones (completar/borrar) para que ninguna tarea se quede sin
            poder quitarse desde la pantalla principal. */}
        <div
          className={`col-start-2 row-span-2 row-start-1 h-full gap-2 ${cardClass}`}
        >
          <Link href="/academic" className="group flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">Estudios</span>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="text-xs text-muted-foreground">
              {pending === 0
                ? "Sin tareas pendientes 🎉"
                : `${pending} tarea${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}`}
            </p>
          </Link>
          {pendingTasks.length > 0 && (
            <ul className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
              {pendingTasks.slice(0, 5).map((t) => (
                <li key={t.id} className="flex min-w-0 items-center gap-1">
                  <span className="mr-0.5 text-primary">•</span>
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <button
                    type="button"
                    onClick={() => actions.toggleTaskDone(t.id)}
                    title="Marcar como hecha"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-primary active:scale-95"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span className="sr-only">Completar {t.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.deleteTask(t.id)}
                    title="Eliminar"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-destructive active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Eliminar {t.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              {nextDays == null
                ? "Sin entregas próximas"
                : nextDays <= 0
                  ? "Próxima entrega: ¡Hoy!"
                  : `Próxima entrega en ${nextDays} d`}
            </p>
            <Link
              href="/academic"
              className="shrink-0 text-xs font-medium text-primary"
            >
              Ver todas
            </Link>
          </div>
        </div>
      </div>

      {/* ── Escritorio: grid de métricas (intacto, solo ≥ lg) ────────── */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-4">
        {cards.map(({ label, value, sub, icon: Icon, tint }) => (
          <Card
            key={label}
            className="bg-muted/40 transition-[box-shadow,transform] duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md"
          >
            <CardContent className="flex items-start gap-3 p-4">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tint}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{label}</p>
                <p className="truncate text-lg font-semibold tracking-tight">
                  {value}
                </p>
                <p className="truncate text-xs text-muted-foreground">{sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
