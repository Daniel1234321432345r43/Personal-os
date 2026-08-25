"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useData } from "@/components/providers/data-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveFormSheet } from "@/components/ui/responsive-form-sheet";
import { formatCurrency, formatDateLong, todayKey } from "@/lib/format";
import { TaskForm } from "@/components/forms/task-form";
import { TransactionForm } from "@/components/forms/transaction-form";
import { WorkoutForm } from "@/components/forms/workout-form";
import { cn } from "@/lib/utils";
import type { Task, Transaction, Workout } from "@/lib/types";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ListFilter,
  Plus,
  Trash2,
  Check,
  Wallet,
  Dumbbell,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  CheckCircle2,
  Clock,
  BookOpen,
  FileText,
  CheckSquare,
} from "lucide-react";

type FilterType = "all" | "academic" | "tasks" | "finance" | "sport";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

interface DayCell {
  dayNumber: number;
  key: string;
  isCurrentMonth: boolean;
}

function toDateKey(year: number, monthZero: number, day: number): string {
  const d = new Date(year, monthZero, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayStr = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayStr}`;
}

function buildCalendarMatrix(year: number, month: number): DayCell[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // 0 = Lunes, 6 = Domingo
  const totalDays = lastDay.getDate();

  const days: DayCell[] = [];

  // Días previos para rellenar la primera semana
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const key = toDateKey(year, month - 1, d);
    days.push({ dayNumber: d, key, isCurrentMonth: false });
  }

  // Días del mes actual
  for (let d = 1; d <= totalDays; d++) {
    const key = toDateKey(year, month, d);
    days.push({ dayNumber: d, key, isCurrentMonth: true });
  }

  // Días siguientes para completar la última semana
  const remaining = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const key = toDateKey(year, month + 1, d);
    days.push({ dayNumber: d, key, isCurrentMonth: false });
  }

  return days;
}

function LoadingState() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-[500px]" />
    </div>
  );
}

export function CalendarClient() {
  const { data, hydrated, actions } = useData();
  const today = todayKey();

  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [filter, setFilter] = useState<FilterType>("all");
  // En móvil, la vista por defecto es semanal (más legible en pantalla
  // pequeña); se puede alternar a mensual con el toggle de arriba.
  const [viewMode, setViewMode] = useState<"month" | "week" | "list">(() => {
    if (typeof window === "undefined") return "month";
    return window.matchMedia("(max-width: 767px)").matches ? "week" : "month";
  });
  const [activeModal, setActiveModal] = useState<"task" | "transaction" | "workout" | null>(null);

  const subjectById = useMemo(
    () => new Map(data.subjects.map((s) => [s.id, s])),
    [data.subjects],
  );

  // Agrupar todos los eventos por fecha ISO (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = new Map<
      string,
      {
        exams: Task[];
        assignments: Task[];
        tasks: Task[];
        studySessions: Task[];
        incomes: Transaction[];
        expenses: Transaction[];
        workouts: Workout[];
      }
    >();

    const getEntry = (date: string) => {
      let entry = map.get(date);
      if (!entry) {
        entry = {
          exams: [],
          assignments: [],
          tasks: [],
          studySessions: [],
          incomes: [],
          expenses: [],
          workouts: [],
        };
        map.set(date, entry);
      }
      return entry;
    };

    // Tareas / plazos
    data.tasks.forEach((t) => {
      if (!t.due_date) return;
      const entry = getEntry(t.due_date);
      if (t.type === "exam") entry.exams.push(t);
      else if (t.type === "assignment") entry.assignments.push(t);
      else if (t.type === "study_session") entry.studySessions.push(t);
      else entry.tasks.push(t);
    });

    // Transacciones
    data.transactions.forEach((tx) => {
      const entry = getEntry(tx.date);
      if (tx.type === "income") entry.incomes.push(tx);
      else entry.expenses.push(tx);
    });

    // Entrenamientos
    data.workouts.forEach((w) => {
      const entry = getEntry(w.date);
      entry.workouts.push(w);
    });

    return map;
  }, [data.tasks, data.transactions, data.workouts]);

  // Días de la cuadrícula del mes
  const matrix = useMemo(
    () => buildCalendarMatrix(currentDate.year, currentDate.month),
    [currentDate.year, currentDate.month],
  );

  // ── Vista semanal: 7 días alrededor de hoy ─────────────────────────────
  const weekStart = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0=Dom, 1=Lun, ...
    const diff = day === 0 ? -6 : 1 - day; // offset hasta lunes
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    return toDateKey(monday.getFullYear(), monday.getMonth(), monday.getDate());
  }, []);

  const weekDays = useMemo(() => {
    const [y, m, d] = weekStart.split("-").map(Number);
    const start = new Date(y, m - 1, d);
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const key = toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
      return { key, dayNumber: date.getDate() };
    });
  }, [weekStart]);

  // Estadísticas del mes actual seleccionado
  const monthStats = useMemo(() => {
    const prefix = `${currentDate.year}-${String(currentDate.month + 1).padStart(2, "0")}`;
    let exams = 0;
    let assignments = 0;
    let tasks = 0;
    let income = 0;
    let expenses = 0;
    let workouts = 0;

    data.tasks.forEach((t) => {
      if (t.due_date?.startsWith(prefix)) {
        if (t.type === "exam") exams++;
        else if (t.type === "assignment") assignments++;
        else tasks++;
      }
    });

    data.transactions.forEach((tx) => {
      if (tx.date.startsWith(prefix)) {
        if (tx.type === "income") income += Number(tx.amount);
        else expenses += Number(tx.amount);
      }
    });

    data.workouts.forEach((w) => {
      if (w.date.startsWith(prefix)) {
        workouts++;
      }
    });

    return {
      exams,
      assignments,
      tasks,
      income,
      expenses,
      net: income - expenses,
      workouts,
      totalEvents: exams + assignments + tasks + (income > 0 || expenses > 0 ? 1 : 0) + workouts,
    };
  }, [data.tasks, data.transactions, data.workouts, currentDate.year, currentDate.month]);

  if (!hydrated) return <LoadingState />;

  function handlePrevMonth() {
    setCurrentDate((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }

  function handleNextMonth() {
    setCurrentDate((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }

  function handleGoToday() {
    const now = new Date();
    setCurrentDate({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(todayKey());
  }

  const selectedDayEvents = eventsByDate.get(selectedDate) || {
    exams: [],
    assignments: [],
    tasks: [],
    studySessions: [],
    incomes: [],
    expenses: [],
    workouts: [],
  };

  const selectedDayHasEvents =
    selectedDayEvents.exams.length > 0 ||
    selectedDayEvents.assignments.length > 0 ||
    selectedDayEvents.tasks.length > 0 ||
    selectedDayEvents.studySessions.length > 0 ||
    selectedDayEvents.incomes.length > 0 ||
    selectedDayEvents.expenses.length > 0 ||
    selectedDayEvents.workouts.length > 0;

  const dayTotalIncome = selectedDayEvents.incomes.reduce((acc, i) => acc + Number(i.amount), 0);
  const dayTotalExpenses = selectedDayEvents.expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const dayNet = dayTotalIncome - dayTotalExpenses;

  // Lista de días del mes con eventos para la vista de agenda
  const agendaDays = matrix
    .filter((cell) => cell.isCurrentMonth)
    .map((cell) => {
      const ev = eventsByDate.get(cell.key);
      if (!ev) return null;

      const hasAcademic = ev.exams.length > 0 || ev.assignments.length > 0 || ev.studySessions.length > 0;
      const hasTasks = ev.tasks.length > 0;
      const hasFinance = ev.incomes.length > 0 || ev.expenses.length > 0;
      const hasSport = ev.workouts.length > 0;

      if (filter === "academic" && !hasAcademic) return null;
      if (filter === "tasks" && !hasTasks) return null;
      if (filter === "finance" && !hasFinance) return null;
      if (filter === "sport" && !hasSport) return null;
      if (filter === "all" && !hasAcademic && !hasTasks && !hasFinance && !hasSport) return null;

      return { cell, events: ev };
    })
    .filter(Boolean) as { cell: DayCell; events: typeof selectedDayEvents }[];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      {/* Cabecera */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Entregas, exámenes, ingresos, gastos y entrenamientos en un solo lugar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de vista */}
          <div className="flex rounded-lg border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={cn(
                "rounded-md px-4 py-2.5 text-xs font-medium transition-colors md:px-3 md:py-1.5",
                viewMode === "month"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={cn(
                "rounded-md px-4 py-2.5 text-xs font-medium transition-colors md:px-3 md:py-1.5",
                viewMode === "week"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "rounded-md px-4 py-2.5 text-xs font-medium transition-colors md:px-3 md:py-1.5",
                viewMode === "list"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Agenda
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-10 md:h-7"
            onClick={handleGoToday}
          >
            Hoy
          </Button>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 md:h-8 md:w-8"
              onClick={handlePrevMonth}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Mes anterior</span>
            </Button>
            <span className="min-w-[130px] text-center text-sm font-semibold">
              {MONTH_NAMES[currentDate.month]} {currentDate.year}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 md:h-8 md:w-8"
              onClick={handleNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Mes siguiente</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Métricas del mes (en móvil van debajo del calendario) */}
      <div className="order-3 lg:order-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Exámenes / Entregas</p>
              <p className="text-base font-semibold">
                {monthStats.exams + monthStats.assignments}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ingresos del mes</p>
              <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(monthStats.income)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <ArrowDownRight className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gastos del mes</p>
              <p className="text-base font-semibold text-rose-600 dark:text-rose-400">
                -{formatCurrency(monthStats.expenses)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Dumbbell className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entrenamientos</p>
              <p className="text-base font-semibold">{monthStats.workouts} ses.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Barra de Filtros (en móvil va justo antes del calendario) */}
      <div className="order-1 lg:order-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <ListFilter className="h-3.5 w-3.5" /> Filtrar:
        </span>
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          className="h-10 rounded-full text-xs md:h-7"
          onClick={() => setFilter("all")}
        >
          <Layers className="mr-1 h-3 w-3" />
          Todo
        </Button>
        <Button
          variant={filter === "academic" ? "default" : "outline"}
          size="sm"
          className="h-10 rounded-full text-xs md:h-7"
          onClick={() => setFilter("academic")}
        >
          <GraduationCap className="mr-1 h-3 w-3" />
          Exámenes y Entregas
        </Button>
        <Button
          variant={filter === "tasks" ? "default" : "outline"}
          size="sm"
          className="h-10 rounded-full text-xs md:h-7"
          onClick={() => setFilter("tasks")}
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Tareas
        </Button>
        <Button
          variant={filter === "finance" ? "default" : "outline"}
          size="sm"
          className="h-10 rounded-full text-xs md:h-7"
          onClick={() => setFilter("finance")}
        >
          <Wallet className="mr-1 h-3 w-3" />
          Finanzas
        </Button>
        <Button
          variant={filter === "sport" ? "default" : "outline"}
          size="sm"
          className="h-10 rounded-full text-xs md:h-7"
          onClick={() => setFilter("sport")}
        >
          <Dumbbell className="mr-1 h-3 w-3" />
          Deporte
        </Button>
      </div>

      {/* Contenido principal: Calendario / Agenda + Panel Lateral (en móvil va primero) */}
      <div className="order-2 lg:order-3 grid gap-6 lg:grid-cols-3">
        {/* Columna izquierda: Vista del Calendario o Lista */}
        <div className="lg:col-span-2 space-y-4">
          {viewMode === "month" ? (
            <Card className="overflow-hidden">
              <CardContent className="p-2 sm:p-4">
                {/* Cabecera de días de la semana */}
                <div className="grid grid-cols-7 gap-1 border-b pb-2 text-center text-xs font-semibold text-muted-foreground">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="py-1">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Cuadrícula de días */}
                <div className="grid grid-cols-7 gap-1 pt-2">
                  {matrix.map((cell) => {
                    const isToday = cell.key === today;
                    const isSelected = cell.key === selectedDate;
                    const ev = eventsByDate.get(cell.key);

                    // Filtrar elementos según el filtro activo
                    const showExams = filter === "all" || filter === "academic";
                    const showAssignments = filter === "all" || filter === "academic";
                    const showStudy = filter === "all" || filter === "academic";
                    const showTasks = filter === "all" || filter === "tasks";
                    const showFinance = filter === "all" || filter === "finance";
                    const showSport = filter === "all" || filter === "sport";

                    const examsList = showExams ? ev?.exams || [] : [];
                    const assignmentsList = showAssignments ? ev?.assignments || [] : [];
                    const studySessionsList = showStudy ? ev?.studySessions || [] : [];
                    const tasksList = showTasks ? ev?.tasks || [] : [];
                    const incomesList = showFinance ? ev?.incomes || [] : [];
                    const expensesList = showFinance ? ev?.expenses || [] : [];
                    const workoutsList = showSport ? ev?.workouts || [] : [];

                    const totalBadges =
                      examsList.length +
                      assignmentsList.length +
                      studySessionsList.length +
                      tasksList.length +
                      incomesList.length +
                      expensesList.length +
                      workoutsList.length;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        onClick={() => setSelectedDate(cell.key)}
                        className={cn(
                          "group relative flex min-h-[56px] flex-col rounded-lg border p-1 text-left transition-all md:min-h-[90px] md:p-1.5 lg:min-h-[105px]",
                          cell.isCurrentMonth
                            ? "bg-card hover:bg-muted/40"
                            : "bg-muted/20 text-muted-foreground/60 opacity-60",
                          isSelected && "ring-2 ring-primary border-primary",
                          isToday && !isSelected && "border-primary/50 bg-primary/5",
                        )}
                      >
                        {/* Cabecera del día */}
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                              isToday
                                ? "bg-primary text-primary-foreground"
                                : "text-foreground group-hover:text-primary",
                            )}
                          >
                            {cell.dayNumber}
                          </span>

                          {totalBadges > 0 && (
                            <span className="hidden sm:inline-block text-[10px] font-medium text-muted-foreground">
                              {totalBadges} {totalBadges === 1 ? "evento" : "eventos"}
                            </span>
                          )}
                        </div>

                        {/* Eventos dentro de la celda */}
                        <div className="mt-1 flex flex-1 flex-col gap-0.5 overflow-hidden">
                          {/* Exámenes */}
                          {examsList.slice(0, 2).map((exam) => (
                            <div
                              key={exam.id}
                              className="flex items-center gap-1 truncate rounded bg-red-500/15 px-1 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-300 border border-red-500/20"
                              title={`Examen: ${exam.title}`}
                            >
                              <GraduationCap className="h-3 w-3 shrink-0" />
                              <span className="truncate">{exam.title}</span>
                            </div>
                          ))}

                          {/* Entregas */}
                          {assignmentsList.slice(0, 2).map((assign) => (
                            <div
                              key={assign.id}
                              className="flex items-center gap-1 truncate rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300 border border-amber-500/20"
                              title={`Entrega: ${assign.title}`}
                            >
                              <FileText className="h-3 w-3 shrink-0" />
                              <span className="truncate">{assign.title}</span>
                            </div>
                          ))}

                          {/* Sesiones de estudio (1/N, 2/N) */}
                          {studySessionsList.slice(0, 2).map((study) => (
                            <div
                              key={study.id}
                              className="flex items-center gap-1 truncate rounded bg-indigo-500/15 px-1 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300 border border-indigo-500/20"
                              title={`Sesión de estudio: ${study.title}`}
                            >
                              <BookOpen className="h-3 w-3 shrink-0" />
                              <span className="truncate">{study.title}</span>
                            </div>
                          ))}

                          {/* Tareas */}
                          {tasksList.slice(0, 1).map((t) => (
                            <div
                              key={t.id}
                              className="flex items-center gap-1 truncate rounded bg-blue-500/15 px-1 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 border border-blue-500/20"
                              title={`Tarea: ${t.title}`}
                            >
                              <CheckSquare className="h-3 w-3 shrink-0" />
                              <span className="truncate">{t.title}</span>
                            </div>
                          ))}

                          {/* Gastos / Ingresos */}
                          {expensesList.length > 0 && (
                            <div className="flex items-center gap-1 truncate rounded bg-rose-500/15 px-1 py-0.5 text-[10px] font-medium text-rose-700 dark:text-rose-300">
                              <ArrowDownRight className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                -{formatCurrency(expensesList.reduce((a, b) => a + Number(b.amount), 0))}
                              </span>
                            </div>
                          )}

                          {incomesList.length > 0 && (
                            <div className="flex items-center gap-1 truncate rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                              <ArrowUpRight className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                +{formatCurrency(incomesList.reduce((a, b) => a + Number(b.amount), 0))}
                              </span>
                            </div>
                          )}

                          {/* Entrenamientos */}
                          {workoutsList.slice(0, 1).map((w) => (
                            <div
                              key={w.id}
                              className="flex items-center gap-1 truncate rounded bg-purple-500/15 px-1 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300"
                              title={`Entrenamiento: ${w.activity_type}`}
                            >
                              <Dumbbell className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {w.activity_type} ({w.duration_minutes}m)
                              </span>
                            </div>
                          ))}

                          {/* Indicador de más eventos */}
                          {totalBadges > 3 && (
                            <div className="text-[9px] font-semibold text-muted-foreground text-center pt-0.5">
                              +{totalBadges - 3} más
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : viewMode === "week" ? (
            /* ── Vista Semanal ────────────────────────────────────────────── */
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Semana del {formatDateLong(weekStart)}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {weekDays.map((day) => {
                  const ev = eventsByDate.get(day.key);
                  const isToday = day.key === today;
                  const isSelected = day.key === selectedDate;
                  return (
                    <div
                      key={day.key}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        isSelected && "border-primary bg-primary/5",
                        isToday && !isSelected && "border-primary/40",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedDate(day.key)}
                        className="flex items-center gap-2 text-sm font-semibold hover:underline"
                      >
                        <span>{formatDateLong(day.key)}</span>
                        {isToday && (
                          <Badge variant="default" className="text-[10px]">
                            Hoy
                          </Badge>
                        )}
                      </button>
                      {ev ? (
                        <div className="mt-2 space-y-1">
                          {ev.exams.map((t) => (
                            <div key={t.id} className="flex items-center gap-1.5 text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              <span className="font-medium">Examen:</span> {t.title}
                              {t.subject_id && (
                                <span className="text-muted-foreground">
                                  ({subjectById.get(t.subject_id)?.name ?? "—"})
                                </span>
                              )}
                            </div>
                          ))}
                          {ev.assignments.map((t) => (
                            <div key={t.id} className="flex items-center gap-1.5 text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              <span className="font-medium">Entrega:</span> {t.title}
                              {t.subject_id && (
                                <span className="text-muted-foreground">
                                  ({subjectById.get(t.subject_id)?.name ?? "—"})
                                </span>
                              )}
                            </div>
                          ))}
                          {ev.studySessions.map((t) => (
                            <div key={t.id} className="flex items-center gap-1.5 text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              <span className="font-medium">Estudio:</span> {t.title}
                              {t.subject_id && (
                                <span className="text-muted-foreground">
                                  ({subjectById.get(t.subject_id)?.name ?? "—"})
                                </span>
                              )}
                            </div>
                          ))}
                          {ev.tasks.map((t) => (
                            <div key={t.id} className="flex items-center gap-1.5 text-xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                              <span className="font-medium">Tarea:</span> {t.title}
                            </div>
                          ))}
                          {ev.incomes.map((tx) => (
                            <div key={tx.id} className="flex items-center gap-1.5 text-xs">
                              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                              <span className="font-medium">+{formatCurrency(Number(tx.amount))}</span>
                              <span className="text-muted-foreground">{tx.category}</span>
                            </div>
                          ))}
                          {ev.expenses.map((tx) => (
                            <div key={tx.id} className="flex items-center gap-1.5 text-xs">
                              <ArrowDownRight className="h-3 w-3 text-red-500" />
                              <span className="font-medium">-{formatCurrency(Number(tx.amount))}</span>
                              <span className="text-muted-foreground">{tx.category}</span>
                            </div>
                          ))}
                          {ev.workouts.map((w) => (
                            <div key={w.id} className="flex items-center gap-1.5 text-xs">
                              <Dumbbell className="h-3 w-3 text-blue-500" />
                              <span className="font-medium">{w.activity_type}</span>
                              {w.duration_minutes && (
                                <span className="text-muted-foreground">{w.duration_minutes} min</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Sin eventos
                        </p>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : (
            /* Vista de Agenda / Lista */
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Agenda de {MONTH_NAMES[currentDate.month]} {currentDate.year}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {agendaDays.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No hay eventos registrados en este mes con el filtro seleccionado.
                  </p>
                ) : (
                  agendaDays.map(({ cell, events }) => (
                    <div
                      key={cell.key}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        cell.key === selectedDate && "border-primary bg-primary/5",
                        cell.key === today && "border-primary/40",
                      )}
                    >
                      <div className="flex items-center justify-between border-b pb-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDate(cell.key)}
                          className="flex items-center gap-2 text-sm font-semibold hover:underline"
                        >
                          <span>{formatDateLong(cell.key)}</span>
                          {cell.key === today && (
                            <Badge variant="secondary" className="text-[10px]">
                              Hoy
                            </Badge>
                          )}
                        </button>
                      </div>

                      <div className="mt-2.5 space-y-2">
                        {/* Exámenes y entregas */}
                        {[...events.exams, ...events.assignments, ...events.tasks, ...events.studySessions].map(
                          (t) => {
                            const sub = t.subject_id ? subjectById.get(t.subject_id) : null;
                            const isDone = t.status === "done";
                            return (
                              <div
                                key={t.id}
                                className="flex items-center justify-between rounded-md bg-muted/40 p-2 text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => actions.toggleTaskDone(t.id)}
                                    className={cn(
                                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                      isDone ? "bg-primary text-primary-foreground border-primary" : "border-input",
                                    )}
                                  >
                                    {isDone && (
                                      <motion.span
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 26 }}
                                        className="flex"
                                      >
                                        <Check className="h-3 w-3" />
                                      </motion.span>
                                    )}
                                  </button>
                                  <span className={cn(isDone && "line-through text-muted-foreground font-normal", "font-medium")}>
                                    {t.title}
                                  </span>
                                  {sub && (
                                    <span
                                      className="rounded px-1.5 py-0.2 text-[10px]"
                                      style={{ backgroundColor: `${sub.color}22`, color: sub.color }}
                                    >
                                      {sub.name}
                                    </span>
                                  )}
                                </div>
                                <Badge variant="outline" className="text-[10px]">
                                  {t.type === "exam" ? "Examen" : t.type === "assignment" ? "Entrega" : "Tarea"}
                                </Badge>
                              </div>
                            );
                          },
                        )}

                        {/* Finanzas */}
                        {[...events.incomes, ...events.expenses].map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between rounded-md bg-muted/40 p-2 text-xs"
                          >
                            <span className="font-medium">
                              {tx.category} {tx.description ? `· ${tx.description}` : ""}
                            </span>
                            <span
                              className={cn(
                                "font-semibold",
                                tx.type === "income" ? "text-emerald-600" : "text-rose-600",
                              )}
                            >
                              {tx.type === "income" ? "+" : "-"}
                              {formatCurrency(Number(tx.amount))}
                            </span>
                          </div>
                        ))}

                        {/* Entrenamientos */}
                        {events.workouts.map((w) => (
                          <div
                            key={w.id}
                            className="flex items-center justify-between rounded-md bg-purple-500/10 p-2 text-xs text-purple-900 dark:text-purple-200"
                          >
                            <span className="flex items-center gap-1 font-medium">
                              <Dumbbell className="h-3.5 w-3.5" />
                              {w.activity_type}
                            </span>
                            <span>{w.duration_minutes} min</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Columna derecha: Detalle del día seleccionado */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base">Detalle del día</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {formatDateLong(selectedDate)}
                </p>
              </div>
              {selectedDate === today && (
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                  Hoy
                </Badge>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Botones de acción rápida para añadir al día seleccionado */}
              <div className="flex flex-wrap gap-1.5 border-b pb-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 text-xs md:h-7"
                  onClick={() => setActiveModal((m) => (m === "task" ? null : "task"))}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Tarea / Examen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 text-xs md:h-7"
                  onClick={() => setActiveModal((m) => (m === "transaction" ? null : "transaction"))}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Transacción
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-11 text-xs md:h-7"
                  onClick={() => setActiveModal((m) => (m === "workout" ? null : "workout"))}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Deporte
                </Button>
              </div>

              {/* Formularios desplegables (escritorio: inline; móvil: bottom sheet) */}
              {activeModal === "task" && (
                <div className="hidden rounded-lg border bg-muted/40 p-3 md:block">
                  <p className="mb-2 text-xs font-semibold">Nueva tarea / examen para {selectedDate}:</p>
                  <TaskForm
                    initialDueDate={selectedDate}
                    onDone={() => setActiveModal(null)}
                  />
                </div>
              )}
              <ResponsiveFormSheet
                open={activeModal === "task"}
                onOpenChange={(open) => !open && setActiveModal(null)}
                title={`Nueva tarea para ${formatDateLong(selectedDate)}`}
              >
                <TaskForm
                  initialDueDate={selectedDate}
                  onDone={() => setActiveModal(null)}
                />
              </ResponsiveFormSheet>

              {activeModal === "transaction" && (
                <div className="hidden rounded-lg border bg-muted/40 p-3 md:block">
                  <p className="mb-2 text-xs font-semibold">Nueva transacción para {selectedDate}:</p>
                  <TransactionForm
                    initialDate={selectedDate}
                    onDone={() => setActiveModal(null)}
                  />
                </div>
              )}
              <ResponsiveFormSheet
                open={activeModal === "transaction"}
                onOpenChange={(open) => !open && setActiveModal(null)}
                title={`Nueva transacción para ${formatDateLong(selectedDate)}`}
              >
                <TransactionForm
                  initialDate={selectedDate}
                  onDone={() => setActiveModal(null)}
                />
              </ResponsiveFormSheet>

              {activeModal === "workout" && (
                <div className="hidden rounded-lg border bg-muted/40 p-3 md:block">
                  <p className="mb-2 text-xs font-semibold">Nuevo entrenamiento para {selectedDate}:</p>
                  <WorkoutForm
                    initialDate={selectedDate}
                    onDone={() => setActiveModal(null)}
                  />
                </div>
              )}
              <ResponsiveFormSheet
                open={activeModal === "workout"}
                onOpenChange={(open) => !open && setActiveModal(null)}
                title={`Nuevo entrenamiento para ${formatDateLong(selectedDate)}`}
              >
                <WorkoutForm
                  initialDate={selectedDate}
                  onDone={() => setActiveModal(null)}
                />
              </ResponsiveFormSheet>

              {/* Lista de eventos del día */}
              {!selectedDayHasEvents ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <CalendarIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  No hay eventos registrados para este día.
                </div>
              ) : (
                <div className="space-y-4 divide-y">
                  {/* Exámenes y entregas */}
                  {(selectedDayEvents.exams.length > 0 ||
                    selectedDayEvents.assignments.length > 0 ||
                    selectedDayEvents.tasks.length > 0 ||
                    selectedDayEvents.studySessions.length > 0) && (
                    <div className="space-y-2 pt-2 first:pt-0">
                      <p className="text-xs font-semibold text-muted-foreground">Estudios y tareas</p>
                      <ul className="space-y-2">
                        {[
                          ...selectedDayEvents.exams,
                          ...selectedDayEvents.assignments,
                          ...selectedDayEvents.tasks,
                          ...selectedDayEvents.studySessions,
                        ].map((t) => {
                          const sub = t.subject_id ? subjectById.get(t.subject_id) : null;
                          const isDone = t.status === "done";
                          return (
                            <li
                              key={t.id}
                              className="flex items-start justify-between gap-2 rounded-lg border bg-card p-2.5 text-xs"
                            >
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() => actions.toggleTaskDone(t.id)}
                                  className={cn(
                                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                    isDone
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "border-input hover:border-primary",
                                  )}
                                  title="Marcar como hecha"
                                >
                                  {isDone && (
                                      <motion.span
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 26 }}
                                        className="flex"
                                      >
                                        <Check className="h-3 w-3" />
                                      </motion.span>
                                    )}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p className={cn("font-medium truncate", isDone && "line-through text-muted-foreground")}>
                                    {t.title}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <Badge variant="outline" className="text-[10px] py-0">
                                      {t.type === "exam"
                                        ? "Examen"
                                        : t.type === "assignment"
                                          ? "Entrega"
                                          : t.type === "study_session"
                                            ? "Estudio"
                                            : "Tarea"}
                                    </Badge>
                                    {t.session_index && t.total_sessions && (
                                      <Badge variant="secondary" className="text-[10px] py-0 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                                        Parte {t.session_index}/{t.total_sessions}
                                      </Badge>
                                    )}
                                    {sub && (
                                      <span
                                        className="rounded px-1.5 py-0.2 font-medium"
                                        style={{ backgroundColor: `${sub.color}22`, color: sub.color }}
                                      >
                                        {sub.name}
                                      </span>
                                    )}
                                    {t.estimated_minutes && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> {t.estimated_minutes} min
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => actions.deleteTask(t.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Finanzas */}
                  {(selectedDayEvents.incomes.length > 0 || selectedDayEvents.expenses.length > 0) && (
                    <div className="space-y-2 pt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-muted-foreground">Finanzas del día</span>
                        <span className={cn("font-bold", dayNet >= 0 ? "text-emerald-600" : "text-rose-600")}>
                          Balance: {dayNet >= 0 ? "+" : ""}
                          {formatCurrency(dayNet)}
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {[...selectedDayEvents.incomes, ...selectedDayEvents.expenses].map((tx) => (
                          <li
                            key={tx.id}
                            className="flex items-center justify-between rounded-lg border bg-card p-2 text-xs"
                          >
                            <div>
                              <p className="font-medium">{tx.category}</p>
                              {tx.description && (
                                <p className="text-[11px] text-muted-foreground">{tx.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "font-semibold",
                                  tx.type === "income" ? "text-emerald-600" : "text-rose-600",
                                )}
                              >
                                {tx.type === "income" ? "+" : "-"}
                                {formatCurrency(Number(tx.amount))}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => actions.deleteTransaction(tx.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Entrenamientos */}
                  {selectedDayEvents.workouts.length > 0 && (
                    <div className="space-y-2 pt-3">
                      <p className="text-xs font-semibold text-muted-foreground">Deporte y entrenamiento</p>
                      <ul className="space-y-1.5">
                        {selectedDayEvents.workouts.map((w) => (
                          <li
                            key={w.id}
                            className="flex items-center justify-between rounded-lg border border-purple-500/20 bg-purple-500/5 p-2 text-xs text-purple-900 dark:text-purple-200"
                          >
                            <div>
                              <p className="font-medium flex items-center gap-1">
                                <Dumbbell className="h-3.5 w-3.5" />
                                {w.activity_type} {w.title ? `· ${w.title}` : ""}
                              </p>
                              {w.notes && <p className="text-[11px] opacity-80">{w.notes}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{w.duration_minutes} min</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => actions.deleteWorkout(w.id)}
                                title="Eliminar"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
