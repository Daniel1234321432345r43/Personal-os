import { ListTodo, CalendarClock, Dumbbell, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDuration, todayKey } from "@/lib/format";
import type { DashboardData } from "@/lib/data";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function StatCards({ data }: { data: DashboardData }) {
  const today = todayKey();

  const pending = data.tasks.filter((t) => t.status !== "done").length;

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

  const sportTodayMinutes = data.workouts
    .filter((w) => w.date === today)
    .reduce((sum, w) => sum + w.duration_minutes, 0);

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

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ label, value, sub, icon: Icon, tint }) => (
        <Card key={label}>
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
  );
}
