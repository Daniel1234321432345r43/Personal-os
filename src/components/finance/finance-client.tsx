"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useData } from "@/components/providers/data-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import { MobileCollapsible } from "@/components/ui/mobile-collapsible";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TransactionForm } from "@/components/forms/transaction-form";
import { BudgetForm } from "@/components/forms/budget-form";
import { PlannedExpenseForm } from "@/components/forms/planned-expense-form";
import { BalanceHistoryChart } from "@/components/finance/balance-history-chart";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Clock,
  Plus,
  RotateCw,
  Trash2,
  Wallet,
} from "lucide-react";
import type { PlannedExpense } from "@/lib/types";

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
  const [showPlanned, setShowPlanned] = useState(false);

  const {
    income,
    expenses,
    balance,
    totalBalance,
    budget,
    plannedExpenses,
    plannedIncome,
    committedExpenses,
    remainingBudget,
    projectedRemaining,
  } = data.finance;

  const spentPercent =
    budget != null && budget > 0
      ? Math.min(100, Math.round((expenses / budget) * 100))
      : 0;

  const plannedPercent =
    budget != null && budget > 0
      ? Math.min(
          Math.max(0, 100 - spentPercent),
          Math.round((plannedExpenses / budget) * 100),
        )
      : 0;

  const totalCommittedPercent =
    budget != null && budget > 0
      ? Math.round((committedExpenses / budget) * 100)
      : null;

  const sorted = [...data.transactions].sort((a, b) =>
    b.date.localeCompare(a.date),
  );

  const summary = [
    { label: "Ingresos", value: income, positive: true },
    { label: "Gastos", value: expenses, positive: false },
    { label: "Resultado neto", value: balance, positive: balance >= 0 },
  ];

  // Lo programado se separa por dirección: dinero que entra y dinero que sale.
  const plannedIncomeItems = data.plannedExpenses.filter((p) => p.kind === "income");
  const plannedExpenseItems = data.plannedExpenses.filter((p) => p.kind !== "income");

  const renderPlannedItem = (p: PlannedExpense) => {
    const isIncome = p.kind === "income";
    return (
      <motion.li
        key={p.id}
        layout
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="flex items-center gap-3 p-3 text-sm"
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isIncome
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400",
          )}
        >
          <Clock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <p className="truncate font-medium">{p.description || p.category}</p>
            {p.recurrence && p.recurrence !== "once" && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                <RotateCw className="h-2.5 w-2.5" />
                {p.recurrence === "monthly" ? "Mensual" : p.recurrence === "weekly" ? "Semanal" : "Anual"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {p.category}
            {p.date ? ` · Previsto: ${formatDate(p.date)}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 font-semibold",
            isIncome
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400",
          )}
        >
          {isIncome ? "+" : "~"}
          {formatCurrency(Number(p.amount))}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
            onClick={() => actions.convertPlannedExpenseToTransaction(p.id)}
            title={
              isIncome
                ? "Convertir a ingreso real (ya lo he cobrado)"
                : "Convertir a gasto real (ya lo he pagado)"
            }
          >
            <Check className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{isIncome ? "Ya cobrado" : "Ya realizado"}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => actions.deletePlannedExpense(p.id)}
            title={isIncome ? "Descartar ingreso previsto" : "Descartar gasto previsto"}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </motion.li>
    );
  };

  if (!hydrated) return <LoadingState />;

  return (
    // Flex en columna con `order-*`: deja el presupuesto y los movimientos
    // previstos al final, por debajo de la gráfica, sin mover el JSX.
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <header className="order-1">
        <h1 className="text-2xl font-semibold tracking-tight">Finanzas</h1>
        <p className="text-sm text-muted-foreground">
          Registra tus ingresos y gastos y controla tu balance mensual.
        </p>
      </header>

      <Card className="order-2 border-primary/25 bg-primary/10 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Saldo total</p>
              <p className="text-xs text-muted-foreground">Ingresos acumulados menos gastos acumulados</p>
            </div>
          </div>
          <p className={`text-3xl font-bold tracking-tight ${totalBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
            {formatCurrency(totalBalance)}
          </p>
        </CardContent>
      </Card>

      {/* Resumen: escritorio en cuadrícula (como antes) */}
      <div className="order-3 hidden grid-cols-3 gap-3 sm:grid">
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

      {/* Resumen en móvil: tarjeta colapsable con animación de despliegue */}
      <div className="order-3 sm:hidden">
        <MobileCollapsible
          title="Resumen del mes"
          subtitle="Ingresos, gastos y balance"
          icon={<Wallet className="h-4 w-4 text-primary" />}
        >
          <dl className="divide-y">
            {summary.map((s) => (
              <div
                key={s.label}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <dt className="text-muted-foreground">{s.label}</dt>
                <dd
                  className={`shrink-0 font-semibold tracking-tight ${
                    s.positive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatCurrency(s.value)}
                </dd>
              </div>
            ))}
          </dl>
        </MobileCollapsible>
      </div>

      {/* Presupuesto */}
      <Card className="order-6">
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
        <CardContent className="space-y-6">
          {/* Resumen del presupuesto (en escritorio se oculta mientras se edita) */}
          {!showBudget &&
            (budget == null ? (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No has definido un presupuesto mensual. Defínelo para controlar
                  tus gastos y ver el impacto de tus gastos previstos.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-muted-foreground">
                      Gastado: <strong className="text-foreground">{formatCurrency(expenses)}</strong>
                    </span>
                    {plannedExpenses > 0 && (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        + {formatCurrency(plannedExpenses)} previstos
                      </span>
                    )}
                    {plannedIncome > 0 && (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        + {formatCurrency(plannedIncome)} por cobrar
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      de {formatCurrency(budget)}
                    </span>
                  </div>
                  {totalCommittedPercent != null && (
                    <span className="font-semibold">{totalCommittedPercent}%</span>
                  )}
                </div>

                {/* Barra de progreso compuesta (Gasto real en primario/rojo + Gasto previsto en ámbar) */}
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={`h-full transition-all duration-500 ${
                      (totalCommittedPercent ?? 0) > 100 ? "bg-red-500" : "bg-primary"
                    }`}
                    style={{ width: `${spentPercent}%` }}
                  />
                  {plannedExpenses > 0 && (
                    <div
                      className="absolute top-0 h-full bg-amber-500/80 transition-all duration-500"
                      style={{
                        left: `${spentPercent}%`,
                        width: `${plannedPercent}%`,
                      }}
                    />
                  )}
                </div>

                {/* Leyenda y balance proyectado */}
                <div className="flex flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {projectedRemaining != null && projectedRemaining >= 0 ? (
                      <span>
                        Te quedarán{" "}
                        <strong className="text-foreground">
                          {formatCurrency(projectedRemaining)}
                        </strong>{" "}
                        disponibles tras lo que ya tienes programado
                        {plannedExpenses > 0 && remainingBudget != null
                          ? ` (disponible actual: ${formatCurrency(remainingBudget)})`
                          : ""}
                        {plannedIncome > 0
                          ? `, contando ${formatCurrency(plannedIncome)} de ingresos previstos`
                          : ""}
                        .
                      </span>
                    ) : projectedRemaining != null ? (
                      <span className="font-medium text-red-600 dark:text-red-400">
                        ⚠️ Lo que tienes programado supera tu presupuesto en{" "}
                        {formatCurrency(Math.abs(projectedRemaining))}.
                      </span>
                    ) : null}
                  </div>
                  {plannedExpenses > 0 && budget != null && budget > 0 && (
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-primary" /> Real ({spentPercent}%)
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Previsto ({Math.round((plannedExpenses / budget) * 100)}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

          {/* Escritorio: formulario inline de presupuesto */}
          {showBudget && (
            <div className="hidden md:block">
              <BudgetForm onDone={() => setShowBudget(false)} />
            </div>
          )}
          {/* Móvil: bottom sheet de presupuesto */}
          <ResponsiveFormSheet
            open={showBudget}
            onOpenChange={setShowBudget}
            title="Presupuesto mensual"
          >
            <BudgetForm onDone={() => setShowBudget(false)} />
          </ResponsiveFormSheet>

          {/* Subapartado de movimientos previstos: ingresos y gastos */}
          <div className="border-t pt-5">
            <div className="flex items-center justify-between gap-2 pb-3">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Movimientos previstos</h3>
                <p className="text-xs text-muted-foreground">
                  Programa los ingresos que esperas cobrar y los gastos recurrentes
                  o puntuales que vas a tener, antes de que ocurran.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPlanned((v) => !v)}
                className="gap-1.5 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Programar
              </Button>
            </div>

            {/* Escritorio: formulario inline de gasto previsto */}
            {showPlanned && (
              <div className="mb-4 hidden rounded-lg border bg-muted/30 p-4 md:block">
                <PlannedExpenseForm onDone={() => setShowPlanned(false)} />
              </div>
            )}
            {/* Móvil: bottom sheet de movimiento previsto */}
            <ResponsiveFormSheet
              open={showPlanned}
              onOpenChange={setShowPlanned}
              title="Programar ingreso o gasto"
            >
              <PlannedExpenseForm onDone={() => setShowPlanned(false)} />
            </ResponsiveFormSheet>

            {/* Listas separadas: lo que entra y lo que sale */}
            <div className="space-y-4">
              {[
                {
                  key: "income",
                  title: "Ingresos previstos",
                  items: plannedIncomeItems,
                  total: plannedIncome,
                  badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                  empty:
                    "No has programado ingresos. Añade una nómina o un trabajo que esperas cobrar.",
                },
                {
                  key: "expense",
                  title: "Gastos previstos",
                  items: plannedExpenseItems,
                  total: plannedExpenses,
                  badge: "bg-red-500/15 text-red-700 dark:text-red-300",
                  empty:
                    "No tienes gastos previstos añadidos. Programa las mensualidades y compras futuras para saber de cuánto dinero dispondrás en realidad.",
                },
              ].map((group) => (
                <div key={group.key} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold tracking-tight">
                      {group.title}
                    </h4>
                    {group.items.length > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          group.badge,
                        )}
                      >
                        {group.items.length} · {formatCurrency(group.total)}
                      </span>
                    )}
                  </div>
                  {group.items.length > 0 ? (
                    <ul className="divide-y rounded-lg border bg-muted/10">
                      <AnimatePresence>
                        {group.items.map(renderPlannedItem)}
                      </AnimatePresence>
                    </ul>
                  ) : (
                    <div className="rounded-lg border border-dashed p-3 text-center">
                      <p className="text-xs text-muted-foreground">{group.empty}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evolución del saldo (encima de los movimientos) */}
      <Card className="order-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Evolución del saldo</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cómo ha ido cambiando el dinero acumulado día a día. Toca la gráfica para ver un día concreto.
          </p>
        </CardHeader>
        <CardContent>
          <BalanceHistoryChart transactions={data.transactions} />
        </CardContent>
      </Card>

      {/* Movimientos: acordeón colapsado por defecto, igual que el resto de la app */}
      <div className="order-5">
        <MobileCollapsible
          title="Movimientos"
          subtitle={
            sorted.length === 0
              ? "Sin movimientos registrados"
              : `${sorted.length} ${sorted.length === 1 ? "movimiento" : "movimientos"}`
          }
          icon={<Wallet className="h-4 w-4 text-primary" />}
          defaultOpen={false}
        >
          <div className="space-y-4 pt-1">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowTx((v) => !v)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Nuevo movimiento
              </Button>
            </div>

            {/* Escritorio: formulario inline */}
            {showTx && (
              <div className="hidden rounded-lg border bg-muted/30 p-4 md:block">
                <TransactionForm onDone={() => setShowTx(false)} />
              </div>
            )}

            <ul className="divide-y">
              <AnimatePresence initial={false}>
                {sorted.map((t) => {
                  const isIncome = t.type === "income";
                  return (
                    <motion.li
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: -18, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        x: 40,
                        transition: { duration: 0.55, ease: "easeInOut" },
                      }}
                      transition={{ duration: 0.55, ease: "easeOut" }}
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
                        className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive md:h-8 md:w-8"
                        onClick={() => actions.deleteTransaction(t.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            {sorted.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay movimientos. Añade tu primer ingreso o gasto.
              </p>
            )}
          </div>
        </MobileCollapsible>

        {/* Móvil: bottom sheet (fuera del acordeón para que no se desmonte) */}
        <ResponsiveFormSheet open={showTx} onOpenChange={setShowTx} title="Nuevo movimiento">
          <TransactionForm onDone={() => setShowTx(false)} />
        </ResponsiveFormSheet>
      </div>
    </div>
  );
}
