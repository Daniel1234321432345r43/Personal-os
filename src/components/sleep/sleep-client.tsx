"use client";

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BedDouble,
  Bell,
  ChevronLeft,
  ChevronRight,
  Flame,
  MoonStar,
  Save,
  Settings2,
  Sunrise,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import { fieldClass, inputClass, labelClass } from "@/components/forms/ui";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useData } from "@/components/providers/data-provider";
import { formatDate, formatDateLong, formatDuration } from "@/lib/format";
import {
  DEFAULT_SLEEP_SETTINGS,
  SLEEP_BANDS,
  SLEEP_LEVEL_LABEL,
  SLEEP_MIN_DURATION_MINUTES,
  SLEEP_REMINDER_MINUTES,
  SLEEP_XP_LABEL,
  addDays,
  dateKey,
  roundHours,
  sleepBand,
  sleepLevel,
  timeToMinutes,
  weekKeys,
} from "@/lib/sleep";
import type { SleepLog } from "@/lib/types";
import { SleepHeatmap } from "./sleep-heatmap";
import { SleepRingDial } from "./sleep-ring-dial";
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

/** Valoración de la noche (misma escala 1-5 que se guarda en la base de datos). */
const QUALITY_OPTIONS = [
  { value: 1, emoji: "😖", label: "Malo" },
  { value: 2, emoji: "😕", label: "Flojo" },
  { value: 3, emoji: "🙂", label: "Normal" },
  { value: 4, emoji: "😌", label: "Bueno" },
  { value: 5, emoji: "🤩", label: "Excelente" },
];

/** Formulario de una noche. Se remonta con `key={fecha}` para cargar sus datos. */
function SleepLogForm({
  date,
  log,
  defaultBedtime,
  defaultWake,
  targetHours,
  onSave,
  onDelete,
}: {
  date: string;
  log: SleepLog | null;
  defaultBedtime: string;
  defaultWake: string;
  targetHours: number;
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
  const [quality, setQuality] = useState<number | null>(log?.quality ?? null);
  const [notes, setNotes] = useState(log?.notes ?? "");

  // Las horas dormidas salen del arco del dial: no se escriben a mano.
  const bedMinutes = timeToMinutes(bedtime);
  const wakeMinutes = timeToMinutes(wakeTime);
  const durationMinutes =
    bedMinutes != null && wakeMinutes != null
      ? (wakeMinutes - bedMinutes + 1440) % 1440
      : 0;
  const hoursValue = roundHours(durationMinutes / 60);
  const valid = durationMinutes >= SLEEP_MIN_DURATION_MINUTES;
  const level = sleepLevel(hoursValue, targetHours);

  return (
    <div className="space-y-4">
      {/* Selector circular: arrastra el arco para indicar de qué hora a qué hora dormiste */}
      <SleepRingDial
        bedtime={bedtime}
        wakeTime={wakeTime}
        targetHours={targetHours}
        onChange={(nextBedtime, nextWake) => {
          setBedtime(nextBedtime);
          setWakeTime(nextWake);
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Horas dormidas: se calculan en tiempo real según el arco */}
        <div className={fieldClass}>
          <span className={labelClass}>Horas dormidas</span>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <span className="text-lg font-semibold tabular-nums">
              {formatDuration(durationMinutes)}
            </span>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: SLEEP_BANDS[sleepBand(hoursValue)].hex }}
            />
            <span className="truncate text-xs text-muted-foreground">
              {SLEEP_LEVEL_LABEL[level]}
            </span>
            <span className="ml-auto shrink-0 text-xs font-medium">
              {SLEEP_XP_LABEL[level]}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Calculadas del arco del dial. En pasos de 5 minutos.
          </p>
        </div>

        {/* Sensación de la noche */}
        <div className={fieldClass}>
          <span className={labelClass}>Qué tal has dormido</span>
          <div className="flex gap-1.5">
            {QUALITY_OPTIONS.map((option) => {
              const active = quality === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  aria-label={option.label}
                  onClick={() => setQuality(active ? null : option.value)}
                  className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 transition-colors ${
                    active
                      ? "border-primary bg-primary/10"
                      : "bg-background hover:bg-muted/50"
                  }`}
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {option.emoji}
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-muted-foreground">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
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

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={!valid}
          onClick={() =>
            onSave({
              date,
              hours: hoursValue,
              bedtime: bedtime || null,
              wake_time: wakeTime || null,
              quality,
              notes: notes.trim() || null,
            })
          }
        >
          <Save className="h-4 w-4" />
          {log ? "Actualizar registro" : "Guardar registro"}
        </Button>
        {log && (
          <Button type="button" variant="outline" onClick={() => onDelete(date)}>
            <Trash2 className="h-4 w-4" />
            Borrar registro
          </Button>
        )}
      </div>

      {!valid && (
        <p className="text-[11px] text-muted-foreground">
          Arrastra el arco del dial para indicar cuándo dormiste: hacen falta al
          menos {SLEEP_MIN_DURATION_MINUTES} minutos.
        </p>
      )}
    </div>
  );
}

/**
 * Contenido del registro de una noche (fecha, dial, sensación y resumen de lo
 * guardado). Es el mismo bloque dentro de la tarjeta de escritorio y dentro de
 * la hoja inferior del móvil, para no mantener dos formularios distintos.
 */
function NightEditor({
  date,
  today,
  log,
  defaultBedtime,
  defaultWake,
  target,
  onSelectDate,
  onSave,
  onDelete,
}: {
  date: string;
  today: string;
  log: SleepLog | null;
  defaultBedtime: string;
  defaultWake: string;
  target: number;
  onSelectDate: (key: string) => void;
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
  // El editor existe a la vez en la tarjeta (escritorio) y en la hoja (móvil),
  // así que el id del campo tiene que ser único por instancia.
  const dateInputId = useId();

  return (
    <>
      <div className={fieldClass}>
        <label className={labelClass} htmlFor={dateInputId}>
          Fecha
        </label>
        <input
          id={dateInputId}
          type="date"
          value={date}
          max={today}
          onChange={(e) => onSelectDate(e.target.value || today)}
          className={inputClass}
        />
        <p className="text-[11px] text-muted-foreground">
          El día en que te has despertado. También puedes tocar un día en las
          gráficas.
        </p>
      </div>

      <SleepLogForm
        key={date}
        date={date}
        log={log}
        defaultBedtime={defaultBedtime}
        defaultWake={defaultWake}
        targetHours={target}
        onSave={onSave}
        onDelete={onDelete}
      />

      {log &&
        (() => {
          const level = sleepLevel(log.hours, target);
          return (
            <p className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: SLEEP_BANDS[sleepBand(log.hours)].hex }}
              />
              <span>
                Guardada: {log.hours} h
                {log.bedtime && log.wake_time
                  ? ` (${log.bedtime} → ${log.wake_time})`
                  : ""}
              </span>
              <span className="font-medium text-foreground">
                {SLEEP_LEVEL_LABEL[level]}
              </span>
              <span>{SLEEP_XP_LABEL[level]}</span>
            </p>
          );
        })()}
    </>
  );
}

export function SleepClient() {
  const { data, hydrated, actions } = useData();
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [weekOffset, setWeekOffset] = useState(0);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [formOpen, setFormOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  /**
   * Cargar una noche desde las gráficas. En el móvil el formulario vive en una
   * hoja inferior, así que se abre; en escritorio basta con desplazar la vista
   * hasta la tarjeta, que está siempre a la vista.
   */
  function selectDateFromChart(key: string) {
    setSelectedDate(key);
    if (isMobile) {
      setFormOpen(true);
      return;
    }
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
    <div className="flex flex-col gap-3 p-4 md:gap-5 md:p-6">
      <header>
        <h1 className="flex items-center gap-2 break-words text-2xl font-semibold tracking-tight">
          <MoonStar className="h-6 w-6 text-violet-500" /> Sueño
        </h1>
        <p className="text-sm text-muted-foreground">
          Registra tus noches, cumple tu objetivo de horas y mira tu año de un
          vistazo.
        </p>
      </header>

      {/* Métricas de la última semana. En el móvil van más apretadas (icono,
          etiqueta y número algo menores) para que las gráficas entren antes. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-2.5 md:p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 md:h-8 md:w-8 dark:text-violet-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground md:text-xs">
                Media (7 días)
              </p>
              <p className="text-sm font-semibold md:text-base">
                {stats.average != null
                  ? formatDuration(Math.round(stats.average * 60))
                  : "—"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-2.5 md:p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 md:h-8 md:w-8 dark:text-blue-400">
              <BedDouble className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] text-muted-foreground md:text-xs">
                Noches registradas
              </p>
              <p className="text-sm font-semibold md:text-base">{stats.count} / 7</p>
              {stats.count > 0 && (
                <p className="truncate text-[10px] text-muted-foreground md:text-[11px]">
                  {stats.onTarget} en objetivo
                </p>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-2.5 md:p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 md:h-8 md:w-8 dark:text-emerald-400">
              <Flame className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground md:text-xs">
                Racha en objetivo
              </p>
              <p className="text-sm font-semibold md:text-base">
                {stats.streak} {stats.streak === 1 ? "noche" : "noches"}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-2.5 md:p-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 md:h-8 md:w-8 dark:text-amber-400">
              <MoonStar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground md:text-xs">
                Objetivo
              </p>
              <p className="text-sm font-semibold md:text-base">{target} h</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Móvil: el registro vive en una hoja inferior, así que aquí solo deja un
          acceso diminuto. Antes ocupaba media pantalla nada más entrar y las
          gráficas quedaban fuera de vista. */}
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-left shadow-xs transition-colors hover:bg-muted/40 active:scale-[0.99] md:hidden"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <BedDouble className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium">
            Registrar una noche
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {formatDateLong(selectedDate)}
            {selectedDate === today && " · hoy"}
            {selectedLog ? ` · ${selectedLog.hours} h` : ""}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <ResponsiveFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Registrar una noche"
      >
        <div className="space-y-3">
          <NightEditor
            date={selectedDate}
            today={today}
            log={selectedLog}
            defaultBedtime={settings.bedtime}
            defaultWake={settings.wake_time}
            target={target}
            onSelectDate={setSelectedDate}
            onSave={(input) => {
              actions.saveSleepLog(input);
              setFormOpen(false);
            }}
            onDelete={(date) => actions.deleteSleepLog(date)}
          />
        </div>
      </ResponsiveFormSheet>

      <div className="flex min-w-0 flex-col gap-3 md:gap-5 lg:grid lg:grid-cols-3 lg:gap-6">
        <div className="order-1 min-w-0 space-y-4 md:space-y-5 lg:order-none lg:col-span-2 lg:space-y-6">
          {/* Registrar / editar una noche (en móvil va en la hoja de arriba) */}
          <Card ref={formRef} className="hidden md:block">
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
              <NightEditor
                date={selectedDate}
                today={today}
                log={selectedLog}
                defaultBedtime={settings.bedtime}
                defaultWake={settings.wake_time}
                target={target}
                onSelectDate={setSelectedDate}
                onSave={(input) => actions.saveSleepLog(input)}
                onDelete={(date) => actions.deleteSleepLog(date)}
              />
            </CardContent>
          </Card>

          {/* Semana en curso */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                {/* En móvil el título corto cabe en la misma línea que las
                    flechas; el largo partía el encabezado en dos. */}
                <span className="text-sm md:text-base">
                  <span className="hidden md:inline">
                    Semana del {formatDate(week[0])} al {formatDate(week[6])}
                  </span>
                  <span className="md:hidden">
                    {formatDate(week[0])} – {formatDate(week[6])}
                  </span>
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

        {/* Objetivo y aviso (se configuran en Ajustes). En móvil bajan al final
            para que lo primero que se vea sean las gráficas. */}
        <div className="order-3 min-w-0 space-y-4 md:space-y-5 lg:order-none lg:space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BedDouble className="h-4 w-4 text-primary" /> Mi objetivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <MoonStar className="h-3.5 w-3.5" /> Ir a dormir
                </span>
                <span className="font-semibold tabular-nums">{settings.bedtime}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Sunrise className="h-3.5 w-3.5" /> Despertar
                </span>
                <span className="font-semibold tabular-nums">{settings.wake_time}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Bell className="h-3.5 w-3.5" /> Aviso {SLEEP_REMINDER_MINUTES} min antes
                </span>
                <span className="font-semibold">
                  {settings.reminder_enabled ? "Activado" : "Desactivado"}
                </span>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/settings">
                  <Settings2 className="h-4 w-4" />
                  Cambiar en Ajustes
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-primary" /> Cómo puntúa
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p className="rounded-lg bg-muted/40 p-2.5">
                Puntuación por noche: <strong>+15 XP</strong> si cumples el
                objetivo de {target} h, <strong>+5 XP</strong> si te quedas
                cerca, <strong>0 XP</strong> si es insuficiente y{" "}
                <strong>−5 XP</strong> si te quedas muy corto.
              </p>
              <p>
                El XP se otorga una sola vez por noche, al guardar el registro.
                El aviso push necesita las notificaciones activadas en{" "}
                <Link href="/settings" className="font-medium underline">
                  Ajustes → Notificaciones
                </Link>{" "}
                y la Edge Function desplegada para llegar con la app cerrada.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Heatmap anual: en escritorio ocupa su propia fila bajo las dos
            columnas; en móvil sube justo debajo de la semana. */}
        <Card className="order-2 lg:order-none lg:col-span-3">
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
    </div>
  );
}
