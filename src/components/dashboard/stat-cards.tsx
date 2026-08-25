import Link from "next/link";
import {
  ListTodo,
  CalendarClock,
  Dumbbell,
  Wallet,
  GraduationCap,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDuration, todayKey } from "@/lib/format";
import type { DashboardData } from "@/lib/data";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function StatCards({ data }: { data: DashboardData }) {
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

  const cardTransition =
    "transition-[box-shadow,transform] duration-200 ease-out active:scale-[0.98] motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md";

  return (
    <>
      {/* ── Móvil: Bento grid asimétrico (solo < lg) ─────────────────── */}
      <div className="grid auto-rows-fr grid-cols-2 gap-3 lg:hidden">
        {/* Estudios (columna izquierda, superior) → /academic */}
        <Link
          href="/academic"
          className={`col-start-1 row-start-1 flex flex-col gap-2 rounded-xl border bg-card p-3.5 ${cardTransition}`}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">Estudios</span>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
          </div>
          <p className="text-xs text-muted-foreground">
            {pending === 0
              ? "Sin tareas pendientes 🎉"
              : `${pending} tarea${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}`}
          </p>
          {pendingTasks.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {pendingTasks.slice(0, 3).map((t) => (
                <li key={t.id} className="truncate">
                  <span className="mr-1.5 text-primary">•</span>
                  {t.title}
                </li>
              ))}
            </ul>
          )}
        </Link>

        {/* Finanzas (columna izquierda, inferior) → /finance */}
        <Link
          href="/finance"
          className={`col-start-1 row-start-2 flex flex-col gap-1 rounded-xl border bg-card p-3.5 ${cardTransition}`}
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
        </Link>

        {/* Deporte (columna derecha, ocupa el alto completo) → /sport */}
        <Link
          href="/sport"
          className={`col-start-2 row-span-2 row-start-1 flex h-full flex-col gap-2 rounded-xl border bg-card p-3.5 ${cardTransition}`}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Dumbbell className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">Deporte</span>
            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/50" />
          </div>
          <div className="mt-auto space-y-2">
            <p className="text-xs text-muted-foreground">
              {sportToday.length > 0
                ? `${sportToday.length} entrenamiento${sportToday.length === 1 ? "" : "s"} · ${formatDuration(sportTodayMinutes)} hoy`
                : "Sin entrenar aún hoy"}
            </p>
            {sportToday.length > 0 && (
              <ul className="space-y-1 text-xs text-muted-foreground">
                {sportToday.slice(0, 3).map((w) => (
                  <li key={w.id} className="truncate">
                    <span className="mr-1.5 text-emerald-600 dark:text-emerald-400">
                      •
                    </span>
                    {w.activity_type} · {formatDuration(w.duration_minutes)}
                  </li>
                ))}
              </ul>
            )}
            {data.habits.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {completedToday} de {data.habits.length} hábitos hoy
              </p>
            )}
          </div>
        </Link>
      </div>

      {/* ── Escritorio: grid de métricas (intacto, solo ≥ lg) ────────── */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-4">
        {cards.map(({ label, value, sub, icon: Icon, tint }) => (
          <Card
            key={label}
            className="transition-[box-shadow,transform] duration-200 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md"
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
