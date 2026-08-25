"use client";

import { useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, inputClass, labelClass } from "./ui";

const COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
];

export function SubjectForm({ onDone }: { onDone?: () => void }) {
  const { actions } = useData();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    actions.addSubject({ name: name.trim(), color });
    setName("");
    setColor(COLORS[0]);
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className={fieldClass}>
        <label className={labelClass} htmlFor="subject-name">
          Nombre de la asignatura
        </label>
        <input
          id="subject-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Matemáticas"
          className={inputClass}
        />
      </div>

      <div className={fieldClass}>
        <label className={labelClass}>Color</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full transition-transform ${
                color === c ? "ring-2 ring-ring ring-offset-2" : ""
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit">Añadir asignatura</Button>
      </div>
    </form>
  );
}
