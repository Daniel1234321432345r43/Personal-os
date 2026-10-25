"use client";

import { useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fieldClass, inputClass, labelClass } from "./ui";

import type { RecurrenceFrequency } from "@/lib/types";

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
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(initialDate || "");
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency>("once");

  const isIncome = kind === "income";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    if (!category.trim()) return;
    actions.addPlannedExpense({
      kind,
      amount: value,
      category: category.trim(),
      description: description.trim() || null,
      date: date.trim() || null,
      recurrence,
    });
    setAmount("");
    setCategory("");
    setDescription("");
    setDate("");
    setRecurrence("once");
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Gasto o ingreso: mismo estilo que el formulario de movimientos
          (gasto en rojo, ingreso en verde). */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={kind === "expense" ? "default" : "outline"}
          onClick={() => setKind("expense")}
          aria-pressed={kind === "expense"}
          className={cn(kind === "expense" && "bg-red-600 text-white hover:bg-red-700")}
        >
          Gasto previsto
        </Button>
        <Button
          type="button"
          variant={kind === "income" ? "default" : "outline"}
          onClick={() => setKind("income")}
          aria-pressed={kind === "income"}
          className={cn(kind === "income" && "bg-emerald-600 text-white hover:bg-emerald-700")}
        >
          Ingreso previsto
        </Button>
      </div>

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
            placeholder={
              isIncome
                ? "Ej. Nómina de octubre, Clase particular..."
                : "Ej. Seguro de coche, Compra semanal..."
            }
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="planned-amount">
            {isIncome ? "Importe previsto a cobrar (€)" : "Importe previsto (€)"}
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

      <div className={fieldClass}>
        <label className={labelClass}>Repetición / Frecuencia</label>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {[
            { value: "once", label: "Puntual", desc: "Una sola vez" },
            { value: "monthly", label: "Mensual", desc: "Suscripción / Recibo" },
            { value: "weekly", label: "Semanal", desc: "Cada semana" },
            { value: "yearly", label: "Anual", desc: "Cada año" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setRecurrence(opt.value as RecurrenceFrequency)}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border p-2 text-center text-xs transition-colors",
                recurrence === opt.value
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              <span>{opt.label}</span>
              <span className="text-[10px] font-normal opacity-75">{opt.desc}</span>
            </button>
          ))}
        </div>
        {recurrence === "monthly" && (
          <p className="text-[11px] text-muted-foreground mt-1">
            💡 Al marcar este movimiento como realizado, se registrará el gasto y se programará automáticamente la cuota del mes siguiente.
          </p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
        )}
        <Button
          type="submit"
          className={cn(
            "text-white",
            isIncome ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700",
          )}
        >
          {isIncome ? "Programar ingreso" : "Planificar gasto"}
        </Button>
      </div>
    </form>
  );
}
