"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ListTodo,
  Dumbbell,
  Wallet,
  GraduationCap,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDuration, todayKey } from "@/lib/format";
import type { DashboardData } from "@/lib/data";

const MotionLink = motion.create(Link);

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/** Etiqueta corta de cuenta atrás: «hoy», «mañana» o «6 d». */
function countdown(iso: string): string {
  const days = daysUntil(iso);
  if (days == null || days <= 0) return "hoy";
  if (days === 1) return "mañana";
  return `${days} d`;
}

/** El color de la cuenta atrás marca la urgencia del examen. */
function countdownClass(iso: string): string {
  const days = daysUntil(iso);
  if (days == null || days <= 1) return "text-red-600 dark:text-red-400";
  if (days <= 3) return "text-amber-600 dark:text-amber-400";
  return "text-violet-600 dark:text-violet-400";
}

export function StatCards({ data }: { data: DashboardData }) {
  const today = todayKey();

  // Los exámenes se cuentan y se listan aparte del resto de tareas: con una
  // decena de exámenes por delante, mezclarlos dejaba las entregas invisibles.
  const pendingTasks = data.tasks.filter(
    (t) => t.status !== "done" && t.type !== "exam",
  );
  const pending = pendingTasks.length;

  const exams = data.tasks
    .filter((t) => t.type === "exam" && t.status !== "done" && t.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  const nextExamDays = daysUntil(exams[0]?.due_date ?? null);

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
      label: "Próximo examen",
      value:
        nextExamDays == null
          ? "—"
          : nextExamDays <= 0
            ? "¡Hoy!"
            : `${nextExamDays} d`,
      sub:
        nextExamDays == null
          ? "sin exámenes"
          : `en ${nextExamDays ?? 0} día(s)`,
      icon: GraduationCap,
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
      {/* ── Móvil: Bento grid (solo < lg) ─────────────────────────────
          Deporte y Finanzas arriba, y los exámenes a ancho completo debajo:
          en media columna los títulos no cabían y quedaban en «Examen de Á…». */}
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        {/* Deporte → /sport */}
        <MotionLink
          href="/sport"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          transition={cardSpring}
          className={`gap-1.5 ${cardClass}`}
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

        {/* Finanzas → /finance */}
        <MotionLink
          href="/finance"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.96 }}
          transition={cardSpring}
          className={`gap-1 ${cardClass}`}
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

        {/* Exámenes (ancho completo) → /academic. Antes esta tarjeta listaba
            las tareas pendientes y el próximo examen se perdía entre ellas;
            ahora los exámenes van aquí y las tareas, en la tarjeta de abajo. */}
        <div className={`col-span-2 gap-2 ${cardClass}`}>
          <Link href="/academic" className="group flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">Exámenes</span>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="text-xs text-muted-foreground">
              {exams.length === 0
                ? "Sin exámenes próximos 🎉"
                : `${exams.length} examen${exams.length === 1 ? "" : "es"} por delante`}
            </p>
          </Link>
          {exams.length > 0 && (
            <ul className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
              {exams.slice(0, 5).map((t) => (
                <li key={t.id} className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 text-violet-500">•</span>
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={t.title}
                  >
                    {t.title}
                  </span>
                  <span
                    className={`shrink-0 whitespace-nowrap text-[11px] font-medium ${countdownClass(t.due_date!)}`}
                  >
                    {countdown(t.due_date!)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-auto pt-1 text-xs text-muted-foreground">
            {pending === 0
              ? "Sin tareas pendientes 🎉"
              : `${pending} tarea${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"} · las tienes abajo`}
          </p>
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
