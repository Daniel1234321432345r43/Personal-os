"use client";

import { useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, inputClass, labelClass } from "./ui";
import { todayKey } from "@/lib/format";

const ACTIVITIES = [
  "Gimnasio",
  "Fútbol",
  "Boxeo",
  "Carrera",
  "Natación",
  "Ciclismo",
  "Baloncesto",
  "Tenis",
  "Yoga",
  "Senderismo",
];

export function WorkoutForm({
  onDone,
  initialDate,
}: {
  onDone?: () => void;
  initialDate?: string;
}) {
  const { actions } = useData();
  const [activity, setActivity] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(initialDate || todayKey());
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const minutes = Number(duration);
    if (!activity.trim()) return;
    if (!minutes || minutes <= 0) return;
    actions.addWorkout({
      activity_type: activity.trim(),
      title: title.trim() || null,
      date,
      start_time: startTime || null,
      duration_minutes: minutes,
      notes: notes.trim() || null,
    });
    setActivity("");
    setTitle("");
    setStartTime("");
    setDuration("");
    setNotes("");
    setDate(todayKey());
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="wk-activity">
            Actividad
          </label>
          <input
            id="wk-activity"
            list="wk-activities"
            required
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="Ej. Gimnasio"
            className={inputClass}
          />
          <datalist id="wk-activities">
            {ACTIVITIES.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="wk-duration">
            Duración (min)
          </label>
          <input
            id="wk-duration"
            type="number"
            min="1"
            inputMode="numeric"
            required
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="60"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="wk-date">
            Fecha
          </label>
          <input
            id="wk-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="wk-start-time">
            Hora de inicio (opcional)
          </label>
          <input
            id="wk-start-time"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
          <p className="text-[11px] text-muted-foreground">
            Se usa para recordarte por notificación antes del entreno.
          </p>
        </div>
      </div>

      <div className={fieldClass}>
        <label className={labelClass} htmlFor="wk-title">
          Título
        </label>
        <input
          id="wk-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Opcional (ej. Fuerza tren superior)"
          className={inputClass}
        />
      </div>

      <div className={fieldClass}>
        <label className={labelClass} htmlFor="wk-notes">
          Notas
        </label>
        <textarea
          id="wk-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional"
          className={inputClass}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit">Añadir</Button>
      </div>
    </form>
  );
}
