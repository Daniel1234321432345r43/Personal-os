"use client";

import { useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { TransactionForm } from "@/components/forms/transaction-form";
import { BudgetForm } from "@/components/forms/budget-form";
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2 } from "lucide-react";

function LoadingState() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

export function FinanceClient() {
  const { data, hydrated, actions } = useData();
  const [showTx, setShowTx] = useState(false);
  const [showBudget, setShowBudget] = useState(false);

  if (!hydrated) return <LoadingState />;

  const { income, expenses, balance, budget } = data.finance;
  const budgetUsed =
    budget != null && budget > 0
      ? Math.min(100, Math.round((expenses / budget) * 100))
      : null;

  const sorted = [...data.transactions].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  const summary = [
    { label: "Ingresos", value: income, positive: true },
    { label: "Gastos", value: expenses, positive: false },
    { label: "Balance", value: balance, positive: balance >= 0 },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted-foreground">
          Registra tus ingresos y gastos y controla tu balance mensual.
        </p>
      </header>

      {/* Resumen */}
      <div className="grid gap-3 sm:grid-cols-3">
        {summary.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p
                className={`text-2xl font-semibold tracking-tight ${
                  s.positive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(s.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Presupuesto */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Presupuesto mensual</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowBudget((v) => !v)}
          >
            {budget != null ? "Editar" : "Definir"}
          </Button>
        </CardHeader>
        <CardContent>
          {showBudget ? (
            <BudgetForm onDone={() => setShowBudget(false)} />
          ) : budget == null ? (
            <p className="text-sm text-muted-foreground">
              No has definido un presupuesto mensual. Defínelo para controlar
              tus gastos.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Gastado {formatCurrency(expenses)} de {formatCurrency(budget)}
                </span>
                <span className="font-medium">{budgetUsed}%</span>
              </div>
              <Progress value={budgetUsed ?? 0} />
              <p className="text-xs text-muted-foreground">
                Te quedan{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(Math.max(0, budget - expenses))}
                </span>{" "}
                disponibles este mes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Movimientos */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Movimientos</CardTitle>
          <Button size="sm" onClick={() => setShowTx((v) => !v)}>
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </CardHeader>
        <CardContent>
          {showTx && (
            <div className="mb-4 rounded-lg border bg-muted/30 p-4">
              <TransactionForm onDone={() => setShowTx(false)} />
            </div>
          )}

          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay movimientos. Añade tu primer ingreso o gasto.
            </p>
          ) : (
            <ul className="divide-y">
              {sorted.map((t) => {
                const isIncome = t.type === "income";
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        isIncome
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {t.description || t.category}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.category} · {formatDate(t.date)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        isIncome
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isIncome ? "+" : "−"}
                      {formatCurrency(Number(t.amount))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => actions.deleteTransaction(t.id)}
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
