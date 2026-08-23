// Tipos compartidos para las entidades de la base de datos (Supabase / PostgreSQL).
// Deben mantenerse sincronizados con supabase/migrations/*.sql.

export type TaskStatus = "pending" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskType = "task" | "assignment" | "exam" | "study_session";
export type TaskCategory = "personal" | "academic" | "sport" | "finance";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

/** Asignatura o curso. `classroom_course_id` enlaza con Google Classroom. */
export interface Subject {
  id: string;
  user_id: string;
  name: string;
  color: string;
  classroom_course_id: string | null;
  classroom_name: string | null;
  created_at: string;
}

/**
 * Tarea genérica. También representa entregas, exámenes y sesiones de estudio
 * mediante el campo `type`. `classroom_id` es el ID del coursework en Google
 * Classroom para sincronizar sin duplicar.
 */
export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  category: TaskCategory;
  due_date: string | null;
  /** Hora de inicio en formato HH:MM (opcional). Usada para recordatorios push. */
  start_time: string | null;
  estimated_minutes: number | null;
  subject_id: string | null;
  classroom_id: string | null;
  session_index?: number | null;
  total_sessions?: number | null;
  parent_task_id?: string | null;
  created_at: string;
  updated_at: string;
}

/** Entrenamiento simplificado: tipo de actividad, fecha, duración y notas. */
export interface Workout {
  id: string;
  user_id: string;
  activity_type: string;
  title: string | null;
  date: string; // YYYY-MM-DD
  /** Hora de inicio en formato HH:MM (opcional). Usada para recordatorios push. */
  start_time: string | null;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  frequency: "daily" | "weekly";
  created_at: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  completed_on: string; // YYYY-MM-DD
}

export interface Transaction {
  id: string;
  user_id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string | null;
  date: string; // YYYY-MM-DD
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  month: string; // YYYY-MM (primer día)
  amount: number;
  created_at: string;
}

/**
 * Nota/apunte del usuario. El contenido principal es texto (markdown). Además
 * puede llevar un adjunto opcional: imagen (data URL) o un archivo binario en
 * base64 (`file_data`) con su nombre y tipo MIME.
 */
export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  file_name: string | null;
  file_type: string | null;
  file_data: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Calificación / nota académica de un examen, entrega o evaluación.
 * Incluye la puntuación obtenida, la puntuación máxima y el porcentaje de ponderación
 * sobre la nota final de la asignatura.
 */
export interface Grade {
  id: string;
  user_id: string;
  subject_id: string;
  task_id: string | null;
  title: string;
  score: number;
  max_score: number;
  weight_percentage: number | null;
  date: string | null; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
  updated_at: string;
}

