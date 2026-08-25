"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, inputClass, labelClass } from "./ui";
import { todayKey } from "@/lib/format";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Trabajo",
  "Freelance",
  "Alimentación",
  "Transporte",
  "Ocio",
  "Estudios",
  "Vivienda",
  "Salud",
  "Ropa",
  "Suscripciones",
  "Otros",
];

export function TransactionForm({
  onDone,
  initialDate,
  initialType = "expense",
}: {
  onDone?: () => void;
  initialDate?: string;
  initialType?: "income" | "expense";
}) {
  const { actions } = useData();
  const [type, setType] = useState<"income" | "expense">(initialType);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(initialDate || todayKey());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    if (!category.trim()) return;
    actions.addTransaction({
      type,
      amount: value,
      category: category.trim(),
      description: description.trim() || null,
      date,
    });
    setAmount("");
    setCategory("");
    setDescription("");
    setDate(todayKey());
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="relative grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={type === "expense" ? "default" : "outline"}
          onClick={() => setType("expense")}
          className={cn(type === "expense" && "bg-red-600 hover:bg-red-700")}
        >
          <motion.span
            initial={false}
            animate={{ scale: type === "expense" ? 1.03 : 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className="inline-block"
          >
            Gasto
          </motion.span>
        </Button>
        <Button
          type="button"
          variant={type === "income" ? "default" : "outline"}
          onClick={() => setType("income")}
          className={cn(type === "income" && "bg-emerald-600 hover:bg-emerald-700")}
        >
          <motion.span
            initial={false}
            animate={{ scale: type === "income" ? 1.03 : 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className="inline-block"
          >
            Ingreso
          </motion.span>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="tx-amount">
            Importe (€)
          </label>
          <input
            id="tx-amount"
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

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="tx-category">
            Categoría
          </label>
          <input
            id="tx-category"
            list="tx-categories"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Ej. Alimentación"
            className={inputClass}
          />
          <datalist id="tx-categories">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className={fieldClass}>
          <label className={labelClass} htmlFor="tx-date">
            Fecha
          </label>
          <input
            id="tx-date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className={fieldClass}>
          <label className={labelClass} htmlFor="tx-desc">
            Descripción
          </label>
          <input
            id="tx-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opcional"
            className={inputClass}
          />
        </div>
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
