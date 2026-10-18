import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateLong, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DayEvents } from "./types";
import type { Subject } from "@/lib/types";
import { ArrowUpRight, ArrowDownRight, Dumbbell } from "lucide-react";

interface WeekDayItem {
  key: string;
  dayNumber: number;
}

interface WeekViewProps {
  weekDays: WeekDayItem[];
  weekStart: string;
  eventsByDate: Map<string, DayEvents>;
  selectedDate: string;
  today: string;
  subjectById: Map<string, Subject>;
  onSelectDate: (key: string) => void;
}

export function WeekView({
  weekDays,
  weekStart,
  eventsByDate,
  selectedDate,
  today,
  subjectById,
  onSelectDate,
}: WeekViewProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Semana del {formatDateLong(weekStart)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {weekDays.map((day) => {
          const ev = eventsByDate.get(day.key);
          const isToday = day.key === today;
          const isSelected = day.key === selectedDate;
          return (
            <div
              key={day.key}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                isSelected && "border-primary bg-primary/5",
                isToday && !isSelected && "border-primary/40",
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDate(day.key)}
                className="flex items-center gap-2 text-sm font-semibold hover:underline"
              >
                <span>{formatDateLong(day.key)}</span>
                {isToday && (
                  <Badge variant="default" className="text-[10px]">
                    Hoy
                  </Badge>
                )}
              </button>
              {ev ? (
                <div className="mt-2 space-y-1">
                  {ev.exams.map((t) => (
                    <div key={t.id} className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      <span className="font-medium">Examen:</span> {t.title}
                      {t.subject_id && (
                        <span className="text-muted-foreground">
                          ({subjectById.get(t.subject_id)?.name ?? "—"})
                        </span>
                      )}
                    </div>
                  ))}
                  {ev.assignments.map((t) => (
                    <div key={t.id} className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span className="font-medium">Entrega:</span> {t.title}
                      {t.subject_id && (
                        <span className="text-muted-foreground">
                          ({subjectById.get(t.subject_id)?.name ?? "—"})
                        </span>
                      )}
                    </div>
                  ))}
                  {ev.studySessions.map((t) => (
                    <div key={t.id} className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span className="font-medium">Estudio:</span> {t.title}
                      {t.subject_id && (
                        <span className="text-muted-foreground">
                          ({subjectById.get(t.subject_id)?.name ?? "—"})
                        </span>
                      )}
                    </div>
                  ))}
                  {ev.tasks.map((t) => (
                    <div key={t.id} className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                      <span className="font-medium">Tarea:</span> {t.title}
                    </div>
                  ))}
                  {ev.incomes.map((tx) => (
                    <div key={tx.id} className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                      <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                      <span className="font-medium">+{formatCurrency(Number(tx.amount))}</span>
                      <span className="text-muted-foreground">{tx.category}</span>
                    </div>
                  ))}
                  {ev.expenses.map((tx) => (
                    <div key={tx.id} className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                      <ArrowDownRight className="h-3 w-3 text-red-500" />
                      <span className="font-medium">-{formatCurrency(Number(tx.amount))}</span>
                      <span className="text-muted-foreground">{tx.category}</span>
                    </div>
                  ))}
                  {ev.workouts.map((w) => (
                    <div key={w.id} className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
                      <Dumbbell className="h-3 w-3 text-blue-500" />
                      <span className="font-medium">{w.activity_type}</span>
                      {w.duration_minutes && (
                        <span className="text-muted-foreground">
                          {formatDuration(w.duration_minutes)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Sin eventos
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
