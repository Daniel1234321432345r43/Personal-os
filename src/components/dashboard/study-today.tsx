"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronDown, Timer } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { useStudyLog } from "@/lib/study-log";
import { summarizeStudy, type StudyWorkItem } from "@/lib/study-summary";
import { formatDate, formatDuration, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Cuántos días del desglose se muestran al desplegar un trabajo. */
const DAYS_SHOWN = 6;
/** Cuántos trabajos sin tiempo hoy se listan (para poder ver su total). */
const IDLE_SHOWN = 3;

/**
 * Tiempo de estudio de hoy, sacado del registro de Pomodoros.
 *
 * Cada pomodoro de trabajo deja sus minutos en la tarea elegida, así que aquí
 * se ve a qué se ha dedicado el día y cuánto: "Estudiar para el examen de
 * Dibujo Técnico — 50 min". Al desplegar un trabajo se ve TODO el tiempo que
 * lleva acumulado (no solo el de hoy) y el desglose de los últimos días.
 *
 * Las sesiones sin tarea (o de una tarea borrada) se agrupan en "Estudio
 * general", así que su tiempo nunca desaparece de los totales.
 */
export function StudyToday() {
  const { data } = useData();
  const study = useStudyLog();
  const today = todayKey();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const items = useMemo(
    () => summarizeStudy(study.sessions, data.tasks, today),
    [study.sessions, data.tasks, today],
  );
  const workedToday = items.filter((item) => item.minutesToday > 0);
  const idle = items.filter((item) => item.minutesToday === 0).slice(0, IDLE_SHOWN);

  const totalToday = workedToday.reduce((acc, item) => acc + item.minutesToday, 0);

  const renderRow = (item: StudyWorkItem) => {
    const open = openKey === item.key;
    return (
      <li key={item.key} className="rounded-lg border bg-card">
        <button
          type="button"
          onClick={() => setOpenKey(open ? null : item.key)}
          aria-expanded={open}
          className="flex w-full items-center gap-2.5 p-2.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{item.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              Total: {formatDuration(item.totalMinutes)} ·{" "}
              {item.byDate.length === 1 ? "1 día" : `${item.byDate.length} días`}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
              item.minutesToday > 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {item.minutesToday > 0 ? `Hoy ${formatDuration(item.minutesToday)}` : "Sin tiempo hoy"}
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 text-muted-foreground"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-1.5 border-t px-2.5 py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Pomodoros en total:{" "}
                  <span className="text-foreground">{formatDuration(item.totalMinutes)}</span>
                  {item.minutesToday > 0 && (
                    <>
                      {" · hoy "}
                      <span className="text-foreground">
                        {formatDuration(item.minutesToday)}
                      </span>
                    </>
                  )}
                </p>
                <ul className="space-y-0.5">
                  {item.byDate.slice(0, DAYS_SHOWN).map((day) => (
                    <li
                      key={day.date}
                      className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                    >
                      <span>{formatDate(day.date)}</span>
                      <span className="font-medium text-foreground">
                        {formatDuration(day.minutes)}
                      </span>
                    </li>
                  ))}
                </ul>
                {item.byDate.length > DAYS_SHOWN && (
                  <p className="text-[11px] text-muted-foreground">
                    y {item.byDate.length - DAYS_SHOWN} día(s) más
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </li>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">Tiempo de estudio de hoy</span>
        </h3>
        <Link href="/pomodoro" className="shrink-0 text-xs font-medium text-primary">
          <span className="inline-flex items-center gap-1">
            <Timer className="h-3.5 w-3.5" />
            {formatDuration(totalToday)}
          </span>
        </Link>
      </div>

      {workedToday.length === 0 && idle.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no has hecho ningún pomodoro. Empieza uno en{" "}
          <Link href="/pomodoro" className="font-medium text-primary">
            Pomodoro
          </Link>{" "}
          y aquí verás a qué has dedicado el tiempo.
        </p>
      ) : (
        <>
          {workedToday.length > 0 ? (
            <ul className="space-y-1.5">{workedToday.map(renderRow)}</ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Hoy todavía no has estudiado. Lo que lleves en total sigue aquí abajo.
            </p>
          )}

          {idle.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Sin tiempo hoy
              </p>
              <ul className="space-y-1.5">{idle.map(renderRow)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
