"use client";

import { useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, inputClass, labelClass } from "./ui";

export function BudgetForm({ onDone }: { onDone?: () => void }) {
  const { data, actions } = useData();
  const [amount, setAmount] = useState(
    data.budget != null ? String(data.budget) : "",
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    actions.setBudget(value);
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className={fieldClass}>
        <label className={labelClass} htmlFor="budget-amount">
          Presupuesto mensual (€)
        </label>
        <input
          id="budget-amount"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="500"
          className={inputClass}
        />
      </div>
      <div className="flex justify-end gap-2">
        {data.budget != null && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              actions.setBudget(null);
              setAmount("");
              onDone?.();
            }}
          >
            Quitar presupuesto
          </Button>
        )}
        <Button type="submit">Guardar</Button>
      </div>
    </form>
  );
}
