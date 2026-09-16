"use client";

import { useMemo } from "react";
import { formatDuration } from "@/lib/format";
import {
  SLEEP_LEVEL_CLASS,
  SLEEP_LEVEL_LABEL,
  dateKey,
  sleepLevel,
} from "@/lib/sleep";
import type { SleepLog } from "@/lib/types";

const WEEKDAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const WEEKDAY_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Gráfica de columnas de la semana (lunes → domingo). La altura de cada
 * columna son las horas dormidas y el color el cumplimiento del objetivo. Las
 * barras y la línea discontinua del objetivo comparten la misma área, para que
 * la línea marque exactamente la altura del objetivo.
 */
export function SleepWeekChart({
  dates,
  logs,
  target,
  selectedDate,
  onSelectDate,
}: {
  /** Las 7 fechas de la semana, de lunes a domingo (YYYY-MM-DD). */
  dates: string[];
  logs: SleepLog[];
  target: number;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const today = dateKey(new Date());

  const byDate = useMemo(() => {
    const map = new Map<string, SleepLog>();
    for (const log of logs) map.set(log.date, log);
    return map;
  }, [logs]);

  const days = dates.map((key, index) => ({
    key,
    label: WEEKDAY_LABELS[index],
    short: WEEKDAY_SHORT[index],
    hours: byDate.get(key)?.hours ?? null,
    isToday: key === today,
    isFuture: key > today,
  }));

  const registered = days.filter((day) => day.hours != null);
  const average =
    registered.length > 0
      ? registered.reduce((sum, day) => sum + (day.hours ?? 0), 0) / registered.length
      : null;

  // El eje llega al objetivo o a la noche más larga, lo que sea mayor.
  const maxHours = Math.max(target, ...days.map((day) => day.hours ?? 0), 1);
  const percent = (hours: number) => Math.min(100, (hours / maxHours) * 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Horas dormidas por día</h3>
        <p className="text-xs text-muted-foreground">
          Objetivo {target} h
          {average != null && ` · media ${formatDuration(Math.round(average * 60))}`}
        </p>
      </div>

      {/* Área de la gráfica: las barras y la línea del objetivo usan el mismo eje */}
      <div className="relative h-48 w-full">
        <div className="absolute inset-x-0 bottom-6 top-5 flex items-end gap-1 sm:gap-2">
          {/* Línea del objetivo (misma escala que la altura de las barras) */}
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-emerald-600/70"
            style={{ bottom: `${percent(target)}%` }}
          />
          <span
            className="pointer-events-none absolute right-0 z-10 -translate-y-full rounded bg-background/80 px-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
            style={{ bottom: `${percent(target)}%` }}
          >
            {target} h
          </span>

          {days.map((day) => {
            const level = day.hours != null ? sleepLevel(day.hours, target) : null;
            const heightPercent = day.hours != null ? percent(day.hours) : 0;
            const isSelected = day.key === selectedDate;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => onSelectDate(day.key)}
                title={
                  day.hours != null
                    ? `${day.label}: ${formatDuration(Math.round(day.hours * 60))} · ${SLEEP_LEVEL_LABEL[level ?? "bad"]}`
                    : `${day.label}: sin registro`
                }
                aria-label={
                  day.hours != null
                    ? `${day.label}: ${day.hours} horas`
                    : `${day.label}: sin registro`
                }
                className={`group relative h-full min-w-0 flex-1 rounded-md transition-colors ${
                  isSelected ? "bg-primary/5 ring-1 ring-primary/40" : "hover:bg-muted/60"
                }`}
              >
                <span
                  className={`absolute inset-x-1 bottom-0 rounded-t-md transition-[height] duration-300 ${
                    level ? SLEEP_LEVEL_CLASS[level] : "bg-muted-foreground/20"
                  } ${day.isFuture ? "opacity-40" : ""}`}
                  style={{ height: `${day.hours != null ? Math.max(3, heightPercent) : 3}%` }}
                />
                {day.hours != null && (
                  <span
                    className="absolute inset-x-0 text-center text-[10px] font-medium text-muted-foreground"
                    style={{ bottom: `calc(${heightPercent}% + 2px)` }}
                  >
                    {day.hours} h
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Etiquetas de los días */}
        <div className="absolute inset-x-0 bottom-0 flex h-6 items-center gap-1 sm:gap-2">
          {days.map((day) => (
            <span
              key={day.key}
              className={`min-w-0 flex-1 text-center text-[10px] font-medium sm:text-xs ${
                day.isToday ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="sm:hidden">{day.short}</span>
              <span className="hidden sm:inline">{day.label.slice(0, 3)}</span>
            </span>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Toca una columna para cargar esa noche en el formulario
        {registered.length > 0 && ` · ${registered.length} de 7 noches registradas`}
      </p>
    </div>
  );
}
