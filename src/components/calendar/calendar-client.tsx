"use client";

import { useMemo, useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { todayKey } from "@/lib/format";
import { useStudyLog } from "@/lib/study-log";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type DayCell,
  type DayEvents,
  type FilterType,
  MONTH_NAMES,
  buildCalendarMatrix,
  toDateKey,
} from "./types";
import { MonthStats } from "./month-stats";
import { CalendarFilters } from "./calendar-filters";
import { MonthGrid } from "./month-grid";
import { WeekView } from "./week-view";
import { AgendaView } from "./agenda-view";
import { DayDetailPanel } from "./day-detail-panel";

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
  const study = useStudyLog();

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
    const map = new Map<string, DayEvents>();

    const getEntry = (date: string): DayEvents => {
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
    let workoutMinutes = 0;

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
        workoutMinutes += w.duration_minutes;
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
      // El entreno se cuenta en HORAS (lo que has entrenado), no en sesiones.
      workoutMinutes,
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

  // Lista de días del mes con eventos para la vista de agenda
  const agendaDays = matrix
    .filter((cell) => cell.isCurrentMonth)
    .map((cell) => {
      const ev = eventsByDate.get(cell.key);
      if (!ev) return null;

      const hasAcademic = ev.exams.length > 0 || ev.assignments.length > 0 || ev.studySessions.length > 0;
      // El filtro "Tareas" incluye también las sesiones de estudio: son tareas
      // de trabajo (a menudo las crea el Secretario) y ocultarlas aquí hacía
      // que parecieran perdidas.
      const hasTasks = ev.tasks.length > 0 || ev.studySessions.length > 0;
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
    <div className="flex flex-col gap-5 p-4 md:p-6 lg:gap-4 lg:p-6">
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

          <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 md:h-8 md:w-8"
              onClick={handlePrevMonth}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Mes anterior</span>
            </Button>
            <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
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

      {/* Métricas del mes (resumen arriba, justo bajo la cabecera) */}
      <MonthStats stats={monthStats} />

      {/* Barra de Filtros */}
      <CalendarFilters filter={filter} onFilterChange={setFilter} />

      {/* Contenido principal: Calendario / Agenda + Panel Lateral */}
      <div className="order-3 grid gap-6 lg:grid-cols-3">
        {/* Columna izquierda: Vista del Calendario o Lista */}
        <div className="lg:col-span-2 space-y-4">
          {viewMode === "month" ? (
            <MonthGrid
              matrix={matrix}
              eventsByDate={eventsByDate}
              selectedDate={selectedDate}
              today={today}
              filter={filter}
              onSelectDate={setSelectedDate}
            />
          ) : viewMode === "week" ? (
            <WeekView
              weekDays={weekDays}
              weekStart={weekStart}
              eventsByDate={eventsByDate}
              selectedDate={selectedDate}
              today={today}
              subjectById={subjectById}
              onSelectDate={setSelectedDate}
            />
          ) : (
            <AgendaView
              agendaDays={agendaDays}
              selectedDate={selectedDate}
              today={today}
              currentMonthName={MONTH_NAMES[currentDate.month]}
              currentYear={currentDate.year}
              subjectById={subjectById}
              onSelectDate={setSelectedDate}
              onToggleTaskDone={actions.toggleTaskDone}
            />
          )}
        </div>

        {/* Columna derecha: Detalle del día seleccionado */}
        <div className="space-y-4">
          <DayDetailPanel
            selectedDate={selectedDate}
            today={today}
            selectedDayEvents={selectedDayEvents}
            subjectById={subjectById}
            studyByTask={study.byTask}
            allTasks={data.tasks}
            activeModal={activeModal}
            onSetActiveModal={setActiveModal}
            onToggleTaskDone={actions.toggleTaskDone}
            onDeleteTask={actions.deleteTask}
            onDeleteTransaction={actions.deleteTransaction}
            onDeleteWorkout={actions.deleteWorkout}
          />
        </div>
      </div>
    </div>
  );
}
