import type { Task, Habit, Workout, Subject, Note, Grade } from "@/lib/types";

/** Contexto que el Secretario IA recibe para planificar el día y responder. */
export interface SecretaryContext {
  date: string;
  tasks: Pick<
    Task,
    | "id"
    | "title"
    | "type"
    | "category"
    | "priority"
    | "due_date"
    | "estimated_minutes"
    | "subject_id"
  >[];
  subjects: Pick<Subject, "id" | "name">[];
  grades: (Pick<
    Grade,
    | "id"
    | "subject_id"
    | "title"
    | "score"
    | "max_score"
    | "weight_percentage"
    | "date"
    | "notes"
  > & { subject_name?: string })[];
  notes: Pick<Note, "id" | "title" | "content">[];
  habits: Pick<Habit, "name" | "emoji">[];
  workouts: Pick<Workout, "activity_type" | "duration_minutes">[];
  finance: {
    income: number;
    expenses: number;
    balance: number;
    budget: number | null;
  };
}

export interface PlanBlock {
  time: string; // "09:00"
  title: string;
  detail?: string;
  category: "academic" | "sport" | "finance" | "personal" | "break";
  priority: 1 | 2 | 3;
}

export interface DayPlan {
  summary: string;
  blocks: PlanBlock[];
}

/** Recomendación del asistente académico para un plazo concreto (por id de tarea). */
export interface DeadlineRecommendation {
  id: string;
  advice: string;
}

export interface AcademicAdvice {
  summary: string;
  recommendations: DeadlineRecommendation[];
}
