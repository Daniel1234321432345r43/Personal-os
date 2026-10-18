import { Card } from "@/components/ui/card";
import { formatCurrency, formatDuration } from "@/lib/format";
import type { MonthStatsData } from "./types";
import {
  GraduationCap,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Dumbbell,
} from "lucide-react";

interface MonthStatsProps {
  stats: MonthStatsData;
}

export function MonthStats({ stats }: MonthStatsProps) {
  return (
    <div className="order-1 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Card className="p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Exámenes / Entregas</p>
            <p className="text-base font-semibold">
              {stats.exams + stats.assignments}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Tareas del mes</p>
            <p className="text-base font-semibold">{stats.tasks}</p>
          </div>
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
              +{formatCurrency(stats.income)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <ArrowDownRight className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Gastos</p>
            <p className="text-base font-semibold text-rose-600 dark:text-rose-400">
              -{formatCurrency(stats.expenses)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Balance mensual</p>
            <p
              className={`text-base font-semibold ${
                stats.net >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {stats.net >= 0 ? "+" : ""}
              {formatCurrency(stats.net)}
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Dumbbell className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Entrenamientos</p>
            <p
              className="text-base font-semibold"
              title={`${stats.workouts} entrenamiento(s) este mes`}
            >
              {stats.workoutMinutes > 0
                ? formatDuration(stats.workoutMinutes)
                : "—"}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
