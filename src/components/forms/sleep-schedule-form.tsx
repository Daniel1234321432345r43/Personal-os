"use client";

import { useState } from "react";
import { Bell, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldClass, inputClass, labelClass } from "@/components/forms/ui";
import { formatDuration } from "@/lib/format";
import { DEFAULT_SLEEP_SETTINGS, SLEEP_REMINDER_MINUTES, hoursBetween } from "@/lib/sleep";
import type { SleepSettingsInput } from "@/components/providers/data-provider";
import type { SleepSettings } from "@/lib/types";

/**
 * Objetivo de sueño: horario, horas objetivo y aviso push antes de acostarse.
 * Se usa en Ajustes (dentro del acordeón "Mi objetivo de sueño"), así que no
 * lleva tarjeta propia: el contenedor lo pone quien lo usa.
 */
export function SleepScheduleForm({
  initial,
  onSave,
}: {
  initial: SleepSettings;
  onSave: (input: SleepSettingsInput) => void;
}) {
  const [target, setTarget] = useState(String(initial.target_hours));
  const [bedtime, setBedtime] = useState(initial.bedtime || DEFAULT_SLEEP_SETTINGS.bedtime);
  const [wakeTime, setWakeTime] = useState(initial.wake_time || DEFAULT_SLEEP_SETTINGS.wake_time);
  const [reminder, setReminder] = useState(initial.reminder_enabled);
  const [saved, setSaved] = useState(false);

  const scheduled = bedtime && wakeTime ? hoursBetween(bedtime, wakeTime) : null;
  const targetValue = Number(target.replace(",", "."));
  const valid = Number.isFinite(targetValue) && targetValue > 0 && targetValue <= 24;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="sleep-bedtime-target">
            Hora de ir a dormir
          </label>
          <input
            id="sleep-bedtime-target"
            type="time"
            value={bedtime}
            onChange={(e) => {
              setBedtime(e.target.value);
              setSaved(false);
            }}
            className={inputClass}
          />
        </div>
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="sleep-wake-target">
            Hora de despertar
          </label>
          <input
            id="sleep-wake-target"
            type="time"
            value={wakeTime}
            onChange={(e) => {
              setWakeTime(e.target.value);
              setSaved(false);
            }}
            className={inputClass}
          />
        </div>
      </div>

      <div className={fieldClass}>
        <label className={labelClass} htmlFor="sleep-target-hours">
          Horas objetivo
        </label>
        <input
          id="sleep-target-hours"
          type="number"
          inputMode="decimal"
          step="0.25"
          min="1"
          max="24"
          value={target}
          onChange={(e) => {
            setTarget(e.target.value);
            setSaved(false);
          }}
          className={inputClass}
        />
        {scheduled != null && (
          <p className="text-[11px] text-muted-foreground">
            De {bedtime} a {wakeTime} son{" "}
            {formatDuration(Math.round(scheduled * 60))}.
            {Number.isFinite(targetValue) && Math.abs(scheduled - targetValue) > 0.25 &&
              ` Tu objetivo son ${targetValue} h.`}
          </p>
        )}
      </div>

      <label className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
        <input
          type="checkbox"
          checked={reminder}
          onChange={(e) => {
            setReminder(e.target.checked);
            setSaved(false);
          }}
          className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
        />
        <span>
          <span className="font-medium">
            Avisarme {SLEEP_REMINDER_MINUTES} minutos antes de dormir
          </span>
          <span className="block text-xs text-muted-foreground">
            Notificación push a las {bedtime ? minutesBefore(bedtime, SLEEP_REMINDER_MINUTES) : "—"}:
            «En {SLEEP_REMINDER_MINUTES} min tienes que dormirte para cumplir tu hábito de
            sueño (objetivo {Number.isFinite(targetValue) ? targetValue : initial.target_hours} h)».
            Necesita las notificaciones activadas en{" "}
            <strong className="font-medium">Ajustes → Notificaciones</strong> y la Edge Function{" "}
            <code className="text-[11px]">send-reminders</code> desplegada para llegar con la app
            cerrada.
          </span>
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={!valid}
          onClick={() => {
            onSave({
              target_hours: targetValue,
              bedtime,
              wake_time: wakeTime,
              reminder_enabled: reminder,
            });
            setSaved(true);
          }}
        >
          <Save className="h-4 w-4" />
          Guardar objetivo
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <Bell className="h-3.5 w-3.5" />
            Objetivo guardado
          </span>
        )}
      </div>
    </div>
  );
}

/** "23:00" con 15 minutos menos → "22:45" (solo para el texto de ayuda). */
function minutesBefore(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const total = (h * 60 + m - minutes + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
