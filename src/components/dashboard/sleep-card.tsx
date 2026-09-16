"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Moon, MoonStar, Sunrise } from "lucide-react";
import { formatDuration } from "@/lib/format";
import {
  DEFAULT_SLEEP_SETTINGS,
  SLEEP_LEVEL_CLASS,
  SLEEP_LEVEL_LABEL,
  addDays,
  dateKey,
  sleepLevel,
  weekKeys,
} from "@/lib/sleep";
import type { DashboardData } from "@/lib/data";

const MotionLink = motion.create(Link);

const WEEKDAY_INITIALS = ["L", "M", "X", "J", "V", "S", "D"];

/**
 * Tarjeta de Sueño del panel "Hoy". Va entre el Secretario IA y las rutinas:
 * resume la última noche, el objetivo y la semana en curso, y lleva al módulo
 * completo (/sueno) al pulsarla.
 */
export function SleepCard({ data }: { data: DashboardData }) {
  const settings = data.sleepSettings ?? DEFAULT_SLEEP_SETTINGS;
  const target = settings.target_hours;
  const today = dateKey(new Date());

  const byDate = new Map(data.sleepLogs.map((log) => [log.date, log]));
  const lastNight = byDate.get(today) ?? byDate.get(addDays(today, -1));
  const level = lastNight ? sleepLevel(lastNight.hours, target) : null;

  const week = weekKeys(today).map((key, index) => ({
    key,
    label: WEEKDAY_INITIALS[index],
    hours: byDate.get(key)?.hours ?? null,
    isToday: key === today,
  }));

  const maxHours = Math.max(target, ...week.map((d) => d.hours ?? 0));
  const registered = week.filter((d) => d.hours != null).length;
  const average =
    registered > 0
      ? week.reduce((sum, d) => sum + (d.hours ?? 0), 0) / registered
      : null;

  return (
    <MotionLink
      href="/sueno"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 500, damping: 32 }}
      className="flex min-w-0 flex-col gap-2 rounded-xl border bg-muted/40 p-3.5 transition-shadow duration-200 ease-out motion-safe:hover:shadow-md"
    >
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <Moon className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">Sueño</span>
        {level && (
          <span
            className={`ml-1 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white ${SLEEP_LEVEL_CLASS[level]}`}
          >
            {SLEEP_LEVEL_LABEL[level]}
          </span>
        )}
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50" />
      </div>

      {lastNight ? (
        <p className="text-xs text-muted-foreground">
          <span className="text-lg font-semibold tracking-tight text-foreground">
            {formatDuration(Math.round(lastNight.hours * 60))}
          </span>{" "}
          {lastNight.date === today ? "esta noche" : "anoche"} · objetivo {target} h
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sin registrar todavía. Objetivo: {target} h ({settings.bedtime} →{" "}
          {settings.wake_time})
        </p>
      )}

      {/* Mini gráfica de la semana: una barra por día, con la altura en horas */}
      <div className="flex items-end justify-between gap-1.5 pt-1">
        {week.map((day) => (
          <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex h-14 w-full items-end justify-center">
              {day.hours != null ? (
                <div
                  className={`w-full max-w-6 rounded-t ${SLEEP_LEVEL_CLASS[sleepLevel(day.hours, target)]}`}
                  style={{ height: `${Math.max(8, (day.hours / maxHours) * 100)}%` }}
                  title={`${day.key}: ${formatDuration(Math.round(day.hours * 60))}`}
                />
              ) : (
                <div className="h-1.5 w-full max-w-6 rounded-full bg-muted-foreground/20" />
              )}
            </div>
            <span
              className={`text-[10px] font-medium ${
                day.isToday ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <MoonStar className="h-3 w-3" /> {settings.bedtime}
        </span>
        <span className="flex items-center gap-1">
          <Sunrise className="h-3 w-3" /> {settings.wake_time}
        </span>
        {average != null && (
          <span>
            media {formatDuration(Math.round(average * 60))} ({registered}/7)
          </span>
        )}
      </div>
    </MotionLink>
  );
}
