"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { fieldClass, inputClass, labelClass, selectClass } from "@/components/forms/ui";
import { cn } from "@/lib/utils";
import { Clock, Dumbbell, Plus, Power, Trash2 } from "lucide-react";

/** Días en el mismo orden que usa la base de datos (0 = domingo). */
const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const ACTIVITIES = [
  "Gimnasio",
  "Fútbol",
  "Baloncesto",
  "Running",
  "Natación",
  "Ciclismo",
  "Pádel",
  "Bádminton",
  "Yoga",
  "Escalada",
  "Caminar",
];

/**
 * Plan semanal de entrenamientos.
 *
 * Es lo que usa el cron de recordatorios para preguntar, al terminar el entreno
 * programado, «Hoy deberías haber ido a X, ¿has ido?». La respuesta se da desde
 * el propio aviso (modal en `WorkoutCheckDialog`), así que aquí solo se define
 * qué días toca, a qué hora y cuánto dura.
 */
export function WorkoutScheduleCard() {
  const { data, actions } = useData();
  const [weekday, setWeekday] = useState(() => new Date().getDay());
  const [activity, setActivity] = useState("");
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState("60");

  const entries = [...data.workoutSchedule].sort(
    (a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!activity.trim() || !time) return;
    actions.addWorkoutSchedule({
      weekday,
      activity_type: activity.trim(),
      time,
      duration_minutes: Number(duration) || 60,
    });
    setActivity("");
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Dinos qué días entrenas. Al terminar el entreno programado te
        preguntaremos si has ido, con un aviso en el móvil.
      </p>

      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="plan-day">
              Día
            </label>
            <select
              id="plan-day"
              value={weekday}
              onChange={(e) => setWeekday(Number(e.target.value))}
              className={selectClass}
            >
              {DAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="plan-activity">
              Entrenamiento
            </label>
            <input
              id="plan-activity"
              list="plan-activities"
              required
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="Ej. Gimnasio, Running..."
              className={inputClass}
            />
            <datalist id="plan-activities">
              {ACTIVITIES.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="plan-time">
              Hora de inicio
            </label>
            <input
              id="plan-time"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className={fieldClass}>
            <label className={labelClass} htmlFor="plan-duration">
              Duración (minutos)
            </label>
            <input
              id="plan-duration"
              type="number"
              min={1}
              max={600}
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <Button type="submit" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Añadir al plan
        </Button>
      </form>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-center">
          <p className="text-xs text-muted-foreground">
            Todavía no has programado ningún entreno.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-muted/10">
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <motion.li
                key={entry.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={cn(
                  "flex items-center gap-3 p-3 text-sm",
                  !entry.enabled && "opacity-60",
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Dumbbell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {entry.title || entry.activity_type}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {DAYS[entry.weekday]} · {entry.time} ·{" "}
                    {formatDuration(entry.duration_minutes)}
                    {!entry.enabled && " · pausado"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8 shrink-0",
                    entry.enabled ? "text-primary" : "text-muted-foreground",
                  )}
                  onClick={() =>
                    actions.updateWorkoutSchedule(entry.id, { enabled: !entry.enabled })
                  }
                  title={entry.enabled ? "Pausar aviso" : "Reactivar aviso"}
                >
                  <Power className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => actions.deleteWorkoutSchedule(entry.id)}
                  title="Quitar del plan"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
