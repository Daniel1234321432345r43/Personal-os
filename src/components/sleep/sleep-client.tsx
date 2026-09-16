"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  Bell,
  ChevronLeft,
  ChevronRight,
  Flame,
  MoonStar,
  Save,
  Sunrise,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fieldClass, inputClass, labelClass, selectClass } from "@/components/forms/ui";
import { useData } from "@/components/providers/data-provider";
import { formatDate, formatDateLong, formatDuration } from "@/lib/format";
import {
  DEFAULT_SLEEP_SETTINGS,
  SLEEP_LEVEL_CLASS,
  SLEEP_LEVEL_LABEL,
  SLEEP_XP_LABEL,
  addDays,
  dateKey,
  hoursBetween,
  sleepLevel,
  weekKeys,
} from "@/lib/sleep";
import type { SleepLog } from "@/lib/types";
import { SleepHeatmap } from "./sleep-heatmap";
import { SleepWeekChart } from "./sleep-week-chart";

function LoadingState() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[320px] lg:col-span-2" />
        <Skeleton className="h-[320px]" />
      </div>
    </div>
  );
}

/** Formulario de una noche. Se remonta con `key={fecha}` para cargar sus datos. */
function SleepLogForm({
  date,
  log,
  defaultBedtime,
  defaultWake,
  onSave,
  onDelete,
}: {
  date: string;
  log: SleepLog | null;
  defaultBedtime: string;
  defaultWake: string;
  onSave: (input: {
    date: string;
    hours: number;
    bedtime?: string | null;
    wake_time?: string | null;
    quality?: number | null;
    notes?: string | null;
  }) => void;
  onDelete: (date: string) => void;
}) {
  const [bedtime, setBedtime] = useState(log?.bedtime ?? defaultBedtime);
  const [wakeTime, setWakeTime] = useState(log?.wake_time ?? defaultWake);
  const [hours, setHours] = useState(
    log ? String(log.hours) : hoursBetween(defaultBedtime, defaultWake).toString(),
  );
  const [quality, setQuality] = useState(log?.quality ? String(log.quality) : "");
  const [notes, setNotes] = useState(log?.notes ?? "");

  /** Al cambiar las horas, se recalcula el total (editable a mano después). */
  function updateTimes(nextBedtime: string, nextWake: string) {
    setBedtime(nextBedtime);
    setWakeTime(nextWake);
    if (nextBedtime && nextWake) setHours(String(hoursBetween(nextBedtime, nextWake)));
  }

  const hoursValue = Number(hours.replace(",", "."));
  const valid = Number.isFinite(hoursValue) && hoursValue > 0 && hoursValue <= 24;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="sleep-bedtime">
            Hora de acostarse
          </label>
          <input
            id="sleep-bedtime"
            type="time"
            value={bedtime}
            onChange={(e) => updateTimes(e.target.value, wakeTime)}
            className={inputClass}
          />
        </div>
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="sleep-wake">
            Hora de despertar
          </label>
          <input
            id="sleep-wake"
            type="time"
            value={wakeTime}
            onChange={(e) => updateTimes(bedtime, e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="sleep-hours">
            Horas dormidas
          </label>
          <input
            id="sleep-hours"
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0.25"
            max="24"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={inputClass}
          />
          <p className="text-[11px] text-muted-foreground">
            Se calcula de las horas de arriba; puedes escribirlo a mano si no las
            recuerdas.
          </p>
        </div>
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="sleep-quality">
            ¿Cómo has descansado?
          </label>
          <select
            id="sleep-quality"
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className={selectClass}
          >
            <option value="">Sin valorar</option>
            <option value="1">1 · Fatal</option>
            <option value="2">2 · Mal</option>
            <option value="3">3 · Normal</option>
            <option value="4">4 · Bien</option>
            <option value="5">5 · Genial</option>
          </select>
        </div>
      </div>

      <div className={fieldClass}>
        <label className={labelClass} htmlFor="sleep-notes">
          Notas (opcional)
        </label>
        <input
          id="sleep-notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Me desperté a media noche, café después de las 18:00…"
          className={inputClass}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!valid}
          onClick={() =>
            onSave({
              date,
              hours: hoursValue,
              bedtime: bedtime || null,
              wake_time: wakeTime || null,
              quality: quality ? Number(quality) : null,
              notes: notes.trim() || null,
            })
          }
        >
          <Save className="h-4 w-4" />
          {log ? "Actualizar noche" : "Guardar noche"}
        </Button>
        {log && (
          <Button type="button" variant="outline" onClick={() => onDelete(date)}>
            <Trash2 className="h-4 w-4" />
            Borrar registro
          </Button>
        )}
      </div>
    </div>
  );
}

/** Objetivo de sueño: horas, horario y aviso push antes de acostarse. */
function ScheduleForm({
  initial,
  onSave,
}: {
  initial: { target_hours: number; bedtime: string; wake_time: string; reminder_enabled: boolean };
  onSave: (input: {
    target_hours: number;
    bedtime: string;
    wake_time: string;
    reminder_enabled: boolean;
  }) => void;
}) {
  const [target, setTarget] = useState(String(initial.target_hours));
  const [bedtime, setBedtime] = useState(initial.bedtime);
  const [wakeTime, setWakeTime] = useState(initial.wake_time);
  const [reminder, setReminder] = useState(initial.reminder_enabled);

  const scheduled = bedtime && wakeTime ? hoursBetween(bedtime, wakeTime) : null;
  const targetValue = Number(target.replace(",", "."));
  const valid = Number.isFinite(targetValue) && targetValue > 0 && targetValue <= 24;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="schedule-bedtime">
            Hora de ir a dormir
          </label>
          <input
            id="schedule-bedtime"
            type="time"
            value={bedtime}
            onChange={(e) => setBedtime(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="schedule-wake">
            Hora de despertar
          </label>
          <input
            id="schedule-wake"
            type="time"
            value={wakeTime}
            onChange={(e) => setWakeTime(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className={fieldClass}>
        <label className={labelClass} htmlFor="schedule-target">
          Horas objetivo
        </label>
        <input
          id="schedule-target"
          type="number"
          inputMode="decimal"
          step="0.25"
          min="1"
          max="24"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={inputClass}
        />
      </div>

      {scheduled != null && (
        <p className="text-[11px] text-muted-foreground">
          De {bedtime} a {wakeTime} son {formatDuration(Math.round(scheduled * 60))}
          {Math.abs(scheduled - (Number.isFinite(targetValue) ? targetValue : scheduled)) > 0.25 &&
            ` · tu objetivo son ${targetValue} h`}
        </p>
      )}

      <label className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
        <input
          type="checkbox"
          checked={reminder}
          onChange={(e) => setReminder(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
        />
        <span>
          <span className="font-medium">
            Avisarme 15 minutos antes de dormir
          </span>
          <span className="block text-xs text-muted-foreground">
            Notificación push: te avisa para que cumplas el objetivo de sueño.
          </span>
        </span>
      </label>

      <Button
        type="button"
        disabled={!valid}
        onClick={() =>
          onSave({
            target_hours: targetValue,
            bedtime,
            wake_time: wakeTime,
            reminder_enabled: reminder,
          })
        }
      >
        <Save className="h-4 w-4" />
        Guardar objetivo
      </Button>
    </div>
  );
}

export function SleepClient() {
  const { data, hydrated, actions } = useData();
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const formRef = useRef<HTMLDivElement>(null);

  /** Cargar una noche desde las gráficas y llevar la vista al formulario. */
  function selectDateFromChart(key: string) {
    setSelectedDate(key);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const settings = data.sleepSettings ?? DEFAULT_SLEEP_SETTINGS;
  const target = settings.target_hours;
  const today = dateKey(new Date());

  const byDate = useMemo(
    () => new Map(data.sleepLogs.map((log) => [log.date, log])),
    [data.sleepLogs],
  );
  const selectedLog = byDate.get(selectedDate) ?? null;

  const week = useMemo(
    () => weekKeys(addDays(today, weekOffset * 7)),
    [today, weekOffset],
  );

  // Estadísticas de los últimos 7 días (hoy incluido).
  const stats = useMemo(() => {
    const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
    const logs = last7
      .map((key) => byDate.get(key))
      .filter((log): log is SleepLog => Boolean(log));
    const totalHours = logs.reduce((sum, log) => sum + log.hours, 0);
    const onTarget = logs.filter((log) => sleepLevel(log.hours, target) === "perfect").length;

    // Racha: noches seguidas cumpliendo el objetivo hasta la última registrada.
    let streak = 0;
    for (const key of last7) {
      const log = byDate.get(key);
      if (!log) {
        if (key === today) continue; // hoy aún puede no estar registrado
        break;
      }
      if (sleepLevel(log.hours, target) !== "perfect") break;
      streak += 1;
    }

    return {
      count: logs.length,
      average: logs.length > 0 ? totalHours / logs.length : null,
      onTarget,
      streak,
    };
  }, [byDate, target, today]);

  if (!hydrated) return <LoadingState />;

  return (
    <div className="space-y-5 p-4 md:p-6 lg:p-6">
      <header>
        <h1 className="flex items-center gap-2 break-words text-2xl font-semibold tracking-tight">
          <MoonStar className="h-6 w-6 text-violet-500" /> Sueño
        </h1>
        <p className="text-sm text-muted-foreground">
          Registra tus noches, cumple tu objetivo de horas y mira tu año de un
          vistazo.
        </p>
      </header>

      {/* Métricas de la última semana */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Media (7 días)</p>
              <p className="text-base font-semibold">
                {stats.average != null
                  ? formatDuration(Math.round(stats.average * 60))
                  : "—"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <BedDouble className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Noches registradas</p>
              <p className="text-base font-semibold">{stats.count} / 7</p>
              {stats.count > 0 && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {stats.onTarget} en objetivo
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Flame className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Racha en objetivo</p>
              <p className="text-base font-semibold">
                {stats.streak} {stats.streak === 1 ? "noche" : "noches"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <MoonStar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Objetivo</p>
              <p className="text-base font-semibold">{target} h</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* Registrar / editar una noche */}
          <Card ref={formRef}>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>Registrar una noche</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {formatDateLong(selectedDate)}
                  {selectedDate === today && " · hoy"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={fieldClass}>
                <label className={labelClass} htmlFor="sleep-date">
                  Fecha
                </label>
                <input
                  id="sleep-date"
                  type="date"
                  value={selectedDate}
                  max={today}
                  onChange={(e) => setSelectedDate(e.target.value || today)}
                  className={inputClass}
                />
                <p className="text-[11px] text-muted-foreground">
                  El día en que te has despertado. También puedes tocar un día en
                  las gráficas.
                </p>
              </div>

              <SleepLogForm
                key={selectedDate}
                date={selectedDate}
                log={selectedLog}
                defaultBedtime={settings.bedtime}
                defaultWake={settings.wake_time}
                onSave={(input) => actions.saveSleepLog(input)}
                onDelete={(date) => actions.deleteSleepLog(date)}
              />

              {selectedLog &&
                (() => {
                  const level = sleepLevel(selectedLog.hours, target);
                  return (
                    <p className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${SLEEP_LEVEL_CLASS[level]}`}
                      />
                      <span>
                        Guardada: {selectedLog.hours} h
                        {selectedLog.bedtime && selectedLog.wake_time
                          ? ` (${selectedLog.bedtime} → ${selectedLog.wake_time})`
                          : ""}
                      </span>
                      <span className="font-medium text-foreground">
                        {SLEEP_LEVEL_LABEL[level]}
                      </span>
                      <span>{SLEEP_XP_LABEL[level]}</span>
                    </p>
                  );
                })()}
            </CardContent>
          </Card>

          {/* Semana en curso */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>
                  Semana del {formatDate(week[0])} al {formatDate(week[6])}
                </span>
                <span className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setWeekOffset((value) => value - 1)}
                    aria-label="Semana anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => setWeekOffset(0)}
                    disabled={weekOffset === 0}
                  >
                    Esta semana
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setWeekOffset((value) => Math.min(0, value + 1))}
                    disabled={weekOffset >= 0}
                    aria-label="Semana siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SleepWeekChart
                dates={week}
                logs={data.sleepLogs}
                target={target}
                selectedDate={selectedDate}
                onSelectDate={selectDateFromChart}
              />
            </CardContent>
          </Card>
        </div>

        {/* Objetivo y aviso */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BedDouble className="h-4 w-4 text-primary" /> Mi objetivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScheduleForm
                key={`${settings.bedtime}-${settings.wake_time}-${settings.target_hours}-${settings.reminder_enabled}`}
                initial={settings}
                onSave={(input) => actions.setSleepSettings(input)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-primary" /> Recordatorio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <Sunrise className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {settings.reminder_enabled
                    ? `Recibirás un aviso 15 minutos antes de las ${settings.bedtime}: «En 15 minutos tienes que dormirte para cumplir tu hábito de sueño».`
                    : "El aviso antes de dormir está desactivado en tu objetivo."}
                </span>
              </p>
              <p>
                Las notificaciones push se activan en{" "}
                <Link href="/settings" className="font-medium underline">
                  Ajustes → Notificaciones
                </Link>{" "}
                y necesitan la Edge Function desplegada para llegar con la app
                cerrada.
              </p>
              <p className="rounded-lg bg-muted/40 p-2.5">
                Puntuación por noche: <strong>+15 XP</strong> si cumples el
                objetivo, <strong>+5 XP</strong> si te quedas cerca,{" "}
                <strong>0 XP</strong> si es insuficiente y{" "}
                <strong>−5 XP</strong> si te quedas muy corto.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Heatmap anual, abajo del todo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span>Mapa de calor anual</span>
            <span className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setYear((value) => value - 1)}
                aria-label="Año anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold">{year}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setYear((value) => value + 1)}
                disabled={year >= new Date().getFullYear()}
                aria-label="Año siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SleepHeatmap
            logs={data.sleepLogs}
            target={target}
            year={year}
            selectedDate={selectedDate}
            onSelectDate={selectDateFromChart}
          />
        </CardContent>
      </Card>
    </div>
  );
}
