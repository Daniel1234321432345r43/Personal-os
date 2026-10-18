import type { Task, Transaction, Workout } from "@/lib/types";

export type FilterType = "all" | "academic" | "tasks" | "finance" | "sport";

export const MONTH_NAMES = [
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

export const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export interface DayCell {
  dayNumber: number;
  key: string;
  isCurrentMonth: boolean;
}

export interface DayEvents {
  exams: Task[];
  assignments: Task[];
  tasks: Task[];
  studySessions: Task[];
  incomes: Transaction[];
  expenses: Transaction[];
  workouts: Workout[];
}

export interface MonthStatsData {
  exams: number;
  assignments: number;
  tasks: number;
  income: number;
  expenses: number;
  net: number;
  workouts: number;
  workoutMinutes: number;
  totalEvents: number;
}

export function toDateKey(year: number, monthZero: number, day: number): string {
  const d = new Date(year, monthZero, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayStr = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayStr}`;
}

export function buildCalendarMatrix(year: number, month: number): DayCell[] {
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
