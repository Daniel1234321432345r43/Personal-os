"use client";

import { useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, inputClass, labelClass } from "./ui";

const EMOJIS = ["📖", "💧", "🧘", "😴", "🏃", "🥗", "✍️", "🪥"];

export function HabitForm({ onDone }: { onDone?: () => void }) {
  const { actions } = useData();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✅");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    actions.addHabit({ name: name.trim(), emoji: emoji.trim() || "✅" });
    setName("");
    setEmoji("✅");
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className={fieldClass}>
        <label className={labelClass} htmlFor="habit-name">
          Nombre
        </label>
        <input
          id="habit-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Leer 20 min"
          className={inputClass}
        />
      </div>

      <div className={fieldClass}>
        <label className={labelClass}>Emoji</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={`flex h-9 w-9 items-center justify-center rounded-md border text-lg transition-colors ${
                emoji === e
                  ? "border-primary bg-primary/10"
                  : "border-input hover:bg-muted"
              }`}
              aria-pressed={emoji === e}
            >
              {e}
            </button>
          ))}
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className={`${inputClass} w-16 text-center`}
            maxLength={4}
            aria-label="Emoji personalizado"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit">Añadir hábito</Button>
      </div>
    </form>
  );
}
