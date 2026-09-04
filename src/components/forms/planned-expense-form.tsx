"use client";

import { useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, inputClass, labelClass } from "./ui";

const CATEGORIES = [
  "Alimentación",
  "Transporte",
  "Vivienda",
  "Ocio",
  "Suscripciones",
  "Estudios",
  "Salud",
  "Ropa",
  "Trabajo",
  "Freelance",
  "Otros",
];

export function PlannedExpenseForm({
  onDone,
  initialDate,
}: {
  onDone?: () => void;
  initialDate?: string;
}) {
  const { actions } = useData();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(initialDate || "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    if (!category.trim()) return;
    actions.addPlannedExpense({
      amount: value,
      category: category.trim(),
      description: description.trim() || null,
      date: date.trim() || null,
    });
    setAmount("");
    setCategory("");
    setDescription("");
    setDate("");
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="planned-desc">
            Concepto / Motivo
          </label>
          <input
            id="planned-desc"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. Seguro de coche, Compra semanal..."
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="planned-amount">
            Importe previsto (€)
          </label>
          <input
            id="planned-amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="planned-category">
            Categoría
          </label>
          <input
            id="planned-category"
            list="planned-categories"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ej. Vivienda, Ocio..."
            className={inputClass}
          />
          <datalist id="planned-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="planned-date">
            Fecha estimada (opcional)
          </label>
          <input
            id="planned-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button type="submit">Planificar gasto</Button>
      </div>
    </form>
  );
}
