"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { formatDate, formatDuration } from "@/lib/format";
import { SLEEP_BANDS, SLEEP_BAND_ORDER, SLEEP_LEVEL_LABEL, addDays, sleepBand, sleepLevel } from "@/lib/sleep";
import type { SleepLog } from "@/lib/types";

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
const WEEKDAY_LABELS = ["L", "", "X", "", "V", "", "D"];

interface DayCell {
  key: string;
  inYear: boolean;
  hours: number | null;
  level: ReturnType<typeof sleepLevel> | null;
}

/**
 * Mapa de calor anual estilo contribuciones: una columna por semana (lunes
 * arriba) y un cuadro por día. El color de cada cuadro sale de las horas
 * dormidas (granate por debajo de 6 h, verdes de 6 a 9 h y ámbar a partir de
 * 9 h), y gris si no hay registro.
 */
export function SleepHeatmap({
  logs,
  target,
  year,
  selectedDate,
  onSelectDate,
}: {
  logs: SleepLog[];
  target: number;
  year: number;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const byDate = useMemo(() => {
    const map = new Map<string, SleepLog>();
    for (const log of logs) map.set(log.date, log);
    return map;
  }, [logs]);

  // La matriz es más ancha que la pantalla del móvil, así que hay que colocarla
  // a mano: si no, siempre aparece enero y el mes en el que estás queda a un
  // deslizamiento de distancia. Se centra una sola vez por año (al entrar y al
  // cambiar de año); después manda el dedo del usuario.
  const scrollRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const centeredYearRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (centeredYearRef.current === year) return;
    const container = scrollRef.current;
    if (!container) return;
    centeredYearRef.current = year;

    // En el año en curso, el ancla es la noche seleccionada (hoy al entrar); en
    // cualquier otro año, el 1 de enero.
    const anchor = selectedDate.startsWith(`${year}-`)
      ? selectedDate
      : `${year}-01-01`;
    const cell = cellRefs.current.get(anchor);
    if (!cell) return;

    const cellRect = cell.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    container.scrollLeft = Math.max(
      0,
      container.scrollLeft +
        cellRect.left -
        containerRect.left -
        container.clientWidth / 2 +
        cellRect.width / 2,
    );
  }, [year, selectedDate]);

  const weeks = useMemo<DayCell[][]>(() => {
    // La matriz empieza en el lunes de la semana del 1 de enero.
    const firstOfYear = `${year}-01-01`;
    const [y, m, d] = firstOfYear.split("-").map(Number);
    const firstWeekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // 0 = lunes
    const start = addDays(firstOfYear, -firstWeekday);
    const lastOfYear = `${year}-12-31`;

    const result: DayCell[][] = [];
    let cursor = start;
    while (cursor <= lastOfYear) {
      const week: DayCell[] = [];
      for (let i = 0; i < 7; i++) {
        const key = cursor;
        const log = byDate.get(key);
        week.push({
          key,
          inYear: key.slice(0, 4) === String(year),
          hours: log?.hours ?? null,
          level: log ? sleepLevel(log.hours, target) : null,
        });
        cursor = addDays(cursor, 1);
      }
      result.push(week);
    }
    return result;
  }, [byDate, target, year]);

  const totalRegistered = weeks.reduce(
    (sum, week) => sum + week.filter((cell) => cell.inYear && cell.hours != null).length,
    0,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">Año {year}</h3>
        <p className="text-xs text-muted-foreground">
          {totalRegistered} {totalRegistered === 1 ? "noche registrada" : "noches registradas"}
        </p>
      </div>

      {/* Scroll horizontal propio de la matriz (no afecta al ancho de la página) */}
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div className="w-max">
          {/* Etiquetas de mes: cada una sobresale de su columna sin empujar el resto */}
          <div className="mb-1 flex h-3 gap-[3px] text-[10px] text-muted-foreground">
            {weeks.map((week, index) => {
              const first = week.find((cell) => cell.inYear);
              const previous = index > 0 ? weeks[index - 1].find((cell) => cell.inYear) : null;
              const month = first?.key.slice(5, 7) ?? null;
              // Se etiqueta la primera semana de cada mes (no solo la del día 1:
              // el 1 de febrero puede caer a mitad de una semana que empieza en enero).
              const label =
                month && month !== previous?.key.slice(5, 7)
                  ? MONTH_LABELS[Number(month) - 1]
                  : "";
              return (
                <span key={index} className="relative w-2.5 shrink-0 sm:w-3">
                  {label && (
                    <span className="absolute left-0 top-0 whitespace-nowrap">
                      {label}
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          <div className="flex gap-[3px]">
            {/* Día de la semana */}
            <div className="mr-1 flex flex-col gap-[3px] text-[9px] leading-none text-muted-foreground">
              {WEEKDAY_LABELS.map((label, index) => (
                <span key={index} className="flex h-2.5 items-center sm:h-3">
                  {label}
                </span>
              ))}
            </div>

            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {week.map((cell) => {
                  const isSelected = cell.key === selectedDate;
                  const label = cell.hours != null
                    ? `${formatDate(cell.key)}: ${formatDuration(Math.round(cell.hours * 60))} · ${SLEEP_LEVEL_LABEL[cell.level ?? "bad"]}`
                    : `${formatDate(cell.key)}: sin registro`;
                  return (
                    <button
                      key={cell.key}
                      ref={(node) => {
                        if (node) cellRefs.current.set(cell.key, node);
                        else cellRefs.current.delete(cell.key);
                      }}
                      type="button"
                      onClick={() => onSelectDate(cell.key)}
                      title={label}
                      aria-label={label}
                      className={`h-2.5 w-2.5 shrink-0 rounded-[2px] transition-transform hover:scale-125 sm:h-3 sm:w-3 ${
                        cell.hours == null ? "bg-muted" : ""
                      } ${cell.inYear ? "" : "opacity-25"} ${
                        isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
                      }`}
                      style={
                        cell.hours == null
                          ? undefined
                          : { backgroundColor: SLEEP_BANDS[sleepBand(cell.hours)].hex }
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Leyenda: los cinco tramos de horas dormidas con su color */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] text-muted-foreground sm:gap-x-3 sm:text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-muted" /> sin registro
        </span>
        {SLEEP_BAND_ORDER.map((band) => (
          <span key={band} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ backgroundColor: SLEEP_BANDS[band].hex }}
            />
            {SLEEP_BANDS[band].label}
          </span>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Toca cualquier cuadro para cargar esa noche en el formulario.
      </p>
    </div>
  );
}
