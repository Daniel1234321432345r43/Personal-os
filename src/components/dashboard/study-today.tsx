"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronDown, History, Timer } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { useStudyLog } from "@/lib/study-log";
import { summarizeStudy, type StudyWorkItem } from "@/lib/study-summary";
import { formatDate, formatDuration, todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Cuántos días del desglose se muestran al desplegar un trabajo. */
const DAYS_SHOWN = 6;

/**
 * Tiempo de estudio de hoy, sacado del registro de Pomodoros.
 *
 * Arriba, lo único que importa al entrar: a qué has dedicado el día y cuánto
 * ("Estudiar para el examen de Dibujo Técnico — hoy 50 min"). Si todavía no has
 * estudiado, lo dice y punto.
 *
 * Todo el tiempo acumulado —lo de días pasados y los trabajos que ya has dado
 * por terminados— va debajo, en un apartado COMPRIMIDO (`Todo el tiempo
 * acumulado`): sigue estando, pero sin ocupar la tarjeta. Cada trabajo se
 * despliega para ver sus minutos día a día.
 *
 * Las sesiones sin tarea (o de una tarea borrada) se agrupan en "Estudio
 * general", así que su tiempo nunca desaparece de los totales.
 */
export function StudyToday() {
  const { data } = useData();
  const study = useStudyLog();
  const today = todayKey();
  /** Trabajo desplegado (la clave, no el nombre: hay nombres repetidos). */
  const [openKey, setOpenKey] = useState<string | null>(null);
  /** El acumulado nace comprimido: solo se abre si lo pides. */
  const [showTotal, setShowTotal] = useState(false);

  const items = useMemo(
    () => summarizeStudy(study.sessions, data.tasks, today),
    [study.sessions, data.tasks, today],
  );
  const todayItems = items.filter((item) => item.minutesToday > 0);
  const totalToday = todayItems.reduce((acc, item) => acc + item.minutesToday, 0);

  const renderRow = (item: StudyWorkItem, variant: "today" | "total") => {
    const open = openKey === item.key;
    return (
      <li key={`${variant}-${item.key}`} className="rounded-lg border bg-card">
        <button
          type="button"
          onClick={() => setOpenKey(open ? null : item.key)}
          aria-expanded={open}
          className="flex w-full items-center gap-2.5 p-2.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{item.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {item.byDate.length === 1 ? "1 día" : `${item.byDate.length} días`}
              {variant === "today"
                ? ` · total ${formatDuration(item.totalMinutes)}`
                : ` · último ${formatDate(item.byDate[0].date)}`}
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
              variant === "today"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {variant === "today"
              ? `Hoy ${formatDuration(item.minutesToday)}`
              : formatDuration(item.totalMinutes)}
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

      {totalToday === 0 ? (
        <p className="text-sm text-muted-foreground">
          Hoy todavía no has estudiado. Empieza un{" "}
          <Link href="/pomodoro" className="font-medium text-primary">
            pomodoro
          </Link>{" "}
          y aquí verás a qué has dedicado el tiempo.
        </p>
      ) : (
        <ul className="space-y-1.5">{todayItems.map((item) => renderRow(item, "today"))}</ul>
      )}

      {/* Acumulado (días pasados y trabajos ya terminados): comprimido por
          defecto, se abre con una animación como el resto de acordeones. */}
      {items.length > 0 && (
        <div className="border-t pt-2">
          <button
            type="button"
            onClick={() => setShowTotal((v) => !v)}
            aria-expanded={showTotal}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <span className="flex min-w-0 items-center gap-2">
              <History className="h-4 w-4 shrink-0" />
              <span className="truncate">
                Todo el tiempo acumulado ({items.length})
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                {formatDuration(study.totalMinutes)}
              </span>
              <motion.span
                animate={{ rotate: showTotal ? 180 : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.span>
            </span>
          </button>

          <AnimatePresence initial={false}>
            {showTotal && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
                  opacity: { duration: 0.25 },
                }}
                className="overflow-hidden"
              >
                <ul className="space-y-1.5 pt-2">
                  {items.map((item) => renderRow(item, "total"))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
