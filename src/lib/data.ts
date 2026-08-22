import type {
  Task,
  Workout,
  Habit,
  HabitCompletion,
  Transaction,
  Subject,
  Note,
  Grade,
} from "@/lib/types";

export interface FinanceSummary {
  income: number;
  expenses: number;
  balance: number;
  budget: number | null;
}

export interface DashboardData {
  subjects: Subject[];
  tasks: Task[];
  notes: Note[];
  workouts: Workout[];
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  transactions: Transaction[];
  grades: Grade[];
  budget: number | null;
  finance: FinanceSummary;
}

/** Calcula el resumen financiero a partir de las transacciones y el presupuesto. */
export function computeFinance(
  transactions: Transaction[],
  budget: number | null,
): FinanceSummary {
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    const amount = Number(t.amount);
    if (t.type === "income") income += amount;
    else expenses += amount;
  }
  return { income, expenses, balance: income - expenses, budget };
}

export interface SubjectGradeStats {
  count: number;
  totalWeight: number; // Suma de porcentajes de las notas que tienen ponderación
  weightedAverage: number | null; // Media ponderada sobre 10 (basada en los pesos definidos)
  simpleAverage: number | null; // Media aritmética simple sobre 10
  accumulatedScore: number; // Puntos reales acumulados de la asignatura (ej. 3.2 puntos sobre 10)
}

/**
 * Calcula las estadísticas de calificaciones para una asignatura.
 * - Puntuaciones normalizadas a base 10 (score / max_score * 10).
 * - Si hay porcentajes asignados, calcula la media ponderada y los puntos acumulados.
 */
export function computeSubjectGradeStats(grades: Grade[]): SubjectGradeStats {
  if (!grades || grades.length === 0) {
    return {
      count: 0,
      totalWeight: 0,
      weightedAverage: null,
      simpleAverage: null,
      accumulatedScore: 0,
    };
  }

  let simpleSum = 0;
  let weightedScoreSum = 0;
  let totalWeight = 0;
  let accumulatedScore = 0;

  for (const g of grades) {
    const maxScore = g.max_score > 0 ? g.max_score : 10;
    const normalizedScore = (g.score / maxScore) * 10;
    simpleSum += normalizedScore;

    if (g.weight_percentage != null && g.weight_percentage > 0) {
      weightedScoreSum += normalizedScore * g.weight_percentage;
      totalWeight += g.weight_percentage;
      accumulatedScore += (normalizedScore * g.weight_percentage) / 100;
    }
  }

  const simpleAverage = simpleSum / grades.length;
  const weightedAverage =
    totalWeight > 0 ? weightedScoreSum / totalWeight : simpleAverage;

  return {
    count: grades.length,
    totalWeight,
    weightedAverage: Number(weightedAverage.toFixed(2)),
    simpleAverage: Number(simpleAverage.toFixed(2)),
    accumulatedScore: Number(accumulatedScore.toFixed(2)),
  };
}

