"use client";

import { useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, inputClass, labelClass, selectClass } from "./ui";
import { todayKey } from "@/lib/format";
import type { TaskPriority, TaskType } from "@/lib/types";
import { CalendarRange, Plus, Trash2 } from "lucide-react";

const TYPES: { value: TaskType; label: string }[] = [
  { value: "study_session", label: "Sesión de estudio" },
  { value: "assignment", label: "Entrega / Trabajo" },
  { value: "exam", label: "Examen" },
  { value: "task", label: "Tarea" },
];

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

function addDays(isoDate: string, days: number): string {
  const base = isoDate || todayKey();
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TaskForm({
  onDone,
  initialDueDate = "",
  initialType = "study_session",
}: {
  onDone?: () => void;
  initialDueDate?: string;
  initialType?: TaskType;
}) {
  const { data, actions } = useData();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>(initialType);
  const [subjectId, setSubjectId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState(initialDueDate || todayKey());
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");

  // Soporte para sesiones multi-día (1/N, 2/N...)
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [sessionDates, setSessionDates] = useState<string[]>([
    initialDueDate || todayKey(),
    addDays(initialDueDate || todayKey(), 1),
  ]);

  function handleSetSessionsCount(count: number) {
    const validCount = Math.max(2, Math.min(10, count));
    const base = sessionDates[0] || dueDate || todayKey();
    const newDates: string[] = [];
    for (let i = 0; i < validCount; i++) {
      newDates.push(sessionDates[i] || addDays(base, i));
    }
    setSessionDates(newDates);
  }

  function handleDateChange(index: number, val: string) {
    const updated = [...sessionDates];
    updated[index] = val;
    setSessionDates(updated);
  }

  function handleAddSession() {
    const lastDate = sessionDates[sessionDates.length - 1] || todayKey();
    setSessionDates([...sessionDates, addDays(lastDate, 1)]);
  }

  function handleRemoveSession(index: number) {
    if (sessionDates.length <= 2) return;
    setSessionDates(sessionDates.filter((_, i) => i !== index));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    if (isMultiDay && sessionDates.length > 1) {
      actions.addTask({
        title: title.trim(),
        type,
        category: "academic",
        priority,
        subject_id: subjectId || null,
        session_dates: sessionDates,
        estimated_minutes: minutes ? Number(minutes) : null,
        description: description.trim() || null,
      });
    } else {
      actions.addTask({
        title: title.trim(),
        type,
        category: "academic",
        priority,
        subject_id: subjectId || null,
        due_date: dueDate || null,
        estimated_minutes: minutes ? Number(minutes) : null,
        description: description.trim() || null,
      });
    }

    setTitle("");
    setType("study_session");
    setSubjectId("");
    setPriority("medium");
    setDueDate(initialDueDate || todayKey());
    setMinutes("");
    setDescription("");
    setIsMultiDay(false);
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className={fieldClass}>
        <label className={labelClass} htmlFor="task-title">
          Título o Actividad
        </label>
        <input
          id="task-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej. Estudiar Geografía, Preparar Examen de Álgebra"
          className={inputClass}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="task-type">
            Tipo
          </label>
          <select
            id="task-type"
            value={type}
            onChange={(e) => setType(e.target.value as TaskType)}
            className={selectClass}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="task-subject">
            Asignatura
          </label>
          <select
            id="task-subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={selectClass}
          >
            <option value="">Sin asignatura</option>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="task-priority">
            Prioridad
          </label>
          <select
            id="task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className={selectClass}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="task-minutes">
            Minutos estimados (por sesión)
          </label>
          <input
            id="task-minutes"
            type="number"
            min="1"
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="Ej. 60, 90 (opcional)"
            className={inputClass}
          />
        </div>
      </div>

      {/* Opción de dividir en varias sesiones / Multi-día */}
      <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isMultiDay}
              onChange={(e) => setIsMultiDay(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
            />
            <span className="flex items-center gap-1.5">
              <CalendarRange className="h-4 w-4 text-primary" />
              Dividir en varios días / sesiones (1/N, 2/N...)
            </span>
          </label>
          {isMultiDay && (
            <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {sessionDates.length} partes
            </span>
          )}
        </div>

        {isMultiDay ? (
          <div className="space-y-2.5 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Se crearán automáticamente {sessionDates.length} tareas consecutivas vinculadas:
              <br />
              <strong className="text-foreground">
                &ldquo;{title.trim() || "Estudiar"} 1/{sessionDates.length}&rdquo;
              </strong>
              ,{" "}
              <strong className="text-foreground">
                &ldquo;{title.trim() || "Estudiar"} 2/{sessionDates.length}&rdquo;
              </strong>
              ...
            </p>

            <div className="flex items-center gap-2 pb-1">
              <span className="text-xs text-muted-foreground">Número de sesiones:</span>
              {[2, 3, 4, 5].map((n) => (
                <Button
                  key={n}
                  type="button"
                  size="sm"
                  variant={sessionDates.length === n ? "default" : "outline"}
                  className="h-6 w-8 p-0 text-xs"
                  onClick={() => handleSetSessionsCount(n)}
                >
                  {n}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              {sessionDates.map((d, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="min-w-[80px] text-xs font-medium text-muted-foreground">
                    Sesión {index + 1}/{sessionDates.length}:
                  </span>
                  <input
                    type="date"
                    required
                    value={d}
                    onChange={(e) => handleDateChange(index, e.target.value)}
                    className={inputClass}
                  />
                  {sessionDates.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleRemoveSession(index)}
                      title="Eliminar sesión"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs w-full mt-1"
              onClick={handleAddSession}
            >
              <Plus className="mr-1 h-3 w-3" />
              Añadir otra sesión / día
            </Button>
          </div>
        ) : (
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="task-due">
              Fecha
            </label>
            <input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
      </div>

      <div className={fieldClass}>
        <label className={labelClass} htmlFor="task-desc">
          Descripción o notas
        </label>
        <textarea
          id="task-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Temario a cubrir, capítulos, enlaces... (opcional)"
          className={inputClass}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit">
          {isMultiDay
            ? `Crear ${sessionDates.length} sesiones`
            : "Añadir tarea"}
        </Button>
      </div>
    </form>
  );
}
