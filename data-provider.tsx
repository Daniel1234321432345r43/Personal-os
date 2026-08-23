"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createClient } from "@supabase/supabase-js";
import type {
  Subject,
  Task,
  TaskCategory,
  TaskPriority,
  TaskType,
  Workout,
  Habit,
  HabitCompletion,
  Transaction,
  Note,
  Grade,
} from "@/lib/types";
import { computeFinance, type DashboardData } from "@/lib/data";
import { todayKey } from "@/lib/format";

// Inicialización de Supabase leyendo desde las variables de entorno
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface DataState {
  subjects: Subject[];
  tasks: Task[];
  notes: Note[];
  workouts: Workout[];
  habits: Habit[];
  habitCompletions: HabitCompletion[];
  transactions: Transaction[];
  grades: Grade[];
  budget: number | null;
}

export type SubjectInput = { name: string; color?: string };
export type TaskInput = {
  title: string;
  type?: TaskType;
  category?: TaskCategory;
  priority?: TaskPriority;
  due_date?: string | null;
  estimated_minutes?: number | null;
  subject_id?: string | null;
  subject_name?: string | null;
  description?: string | null;
  session_dates?: string[];
  session_index?: number | null;
  total_sessions?: number | null;
  parent_task_id?: string | null;
};
export type WorkoutInput = {
  activity_type: string;
  date?: string;
  duration_minutes: number;
  title?: string | null;
  notes?: string | null;
};
export type HabitInput = { name: string; emoji?: string };
export type TransactionInput = {
  type: "income" | "expense";
  amount: number;
  category: string;
  date?: string;
  description?: string | null;
};
export type NoteInput = {
  title: string;
  content: string;
  file_name?: string | null;
  file_type?: string | null;
  file_data?: string | null;
};
export type GradeInput = {
  subject_id?: string | null;
  subject_name?: string | null;
  task_id?: string | null;
  task_title?: string | null;
  title: string;
  score: number;
  max_score?: number;
  weight_percentage?: number | null;
  date?: string | null;
  notes?: string | null;
};

export interface DataActions {
  addSubject: (input: SubjectInput) => Promise<void>;
  addSubjects: (inputs: SubjectInput[]) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  deleteSubjects: (ids?: string[], names?: string[]) => Promise<void>;
  addTask: (input: TaskInput) => Promise<void>;
  addTasks: (inputs: TaskInput[]) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  deleteTasks: (ids?: string[], titles?: string[]) => Promise<void>;
  toggleTaskDone: (id: string) => Promise<void>;
  addNote: (input: NoteInput) => Promise<void>;
  addNotes: (inputs: NoteInput[]) => Promise<void>;
  updateNote: (id: string, input: NoteInput) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  addWorkout: (input: WorkoutInput) => Promise<void>;
  addWorkouts: (inputs: WorkoutInput[]) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
  addHabit: (input: HabitInput) => Promise<void>;
  addHabits: (inputs: HabitInput[]) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  toggleHabit: (habitId: string) => Promise<void>;
  addTransaction: (input: TransactionInput) => Promise<void>;
  addTransactions: (inputs: TransactionInput[]) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  setBudget: (amount: number | null) => Promise<void>;
  addGrade: (input: GradeInput) => Promise<void>;
  addGrades: (inputs: GradeInput[]) => Promise<void>;
  updateGrade: (id: string, input: Partial<GradeInput>) => Promise<void>;
  deleteGrade: (id: string) => Promise<void>;
  deleteGrades: (ids?: string[], titles?: string[]) => Promise<void>;
}

interface DataContextValue {
  data: DashboardData;
  hydrated: boolean;
  actions: DataActions;
}

const DataContext = createContext<DataContextValue | null>(null);

function emptyState(): DataState {
  return {
    subjects: [],
    tasks: [],
    notes: [],
    workouts: [],
    habits: [],
    habitCompletions: [],
    transactions: [],
    grades: [],
    budget: null,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  // Carga inicial de datos desde Supabase
  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      if (!userId) {
        setHydrated(true);
        return;
      }

      const [
        { data: subjects },
        { data: tasks },
        { data: notes },
        { data: workouts },
        { data: habits },
        { data: habitCompletions },
        { data: transactions },
        { data: grades },
      ] = await Promise.all([
        supabase.from("subjects").select("*").eq("user_id", userId),
        supabase.from("tasks").select("*").eq("user_id", userId),
        supabase.from("notes").select("*").eq("user_id", userId),
        supabase.from("workouts").select("*").eq("user_id", userId),
        supabase.from("habits").select("*").eq("user_id", userId),
        supabase.from("habit_completions").select("*").eq("user_id", userId),
        supabase.from("transactions").select("*").eq("user_id", userId),
        supabase.from("grades").select("*").eq("user_id", userId),
      ]);

      setState({
        subjects: subjects || [],
        tasks: tasks || [],
        notes: notes || [],
        workouts: workouts || [],
        habits: habits || [],
        habitCompletions: habitCompletions || [],
        transactions: transactions || [],
        grades: grades || [],
        budget: null,
      });
    } catch (err) {
      console.error("Error al sincronizar con Supabase:", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const actions = useMemo<DataActions>(() => {
    const DEFAULT_COLORS = [
      "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
      "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6",
    ];

    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || null;
    };

    return {
      addSubject: async (input) => {
        const userId = await getUserId();
        if (!userId) return;
        const color = input.color || DEFAULT_COLORS[state.subjects.length % DEFAULT_COLORS.length];
        const { data, error } = await supabase
          .from("subjects")
          .insert({ name: input.name.trim(), color, user_id: userId })
          .select()
          .single();

        if (!error && data) {
          setState((prev) => ({ ...prev, subjects: [...prev.subjects, data] }));
        }
      },

      addSubjects: async (inputs) => {
        const userId = await getUserId();
        if (!userId) return;
        const records = inputs.map((input, idx) => ({
          name: input.name.trim(),
          color: input.color || DEFAULT_COLORS[(state.subjects.length + idx) % DEFAULT_COLORS.length],
          user_id: userId,
        }));

        const { data, error } = await supabase.from("subjects").insert(records).select();
        if (!error && data) {
          setState((prev) => ({ ...prev, subjects: [...prev.subjects, ...data] }));
        }
      },

      deleteSubject: async (id) => {
        const { error } = await supabase.from("subjects").delete().eq("id", id);
        if (!error) {
          setState((prev) => ({
            ...prev,
            subjects: prev.subjects.filter((s) => s.id !== id),
            tasks: prev.tasks.map((t) => (t.subject_id === id ? { ...t, subject_id: null } : t)),
            grades: prev.grades.filter((g) => g.subject_id !== id),
          }));
        }
      },

      deleteSubjects: async (ids = []) => {
        const { error } = await supabase.from("subjects").delete().in("id", ids);
        if (!error) {
          const idSet = new Set(ids);
          setState((prev) => ({
            ...prev,
            subjects: prev.subjects.filter((s) => !idSet.has(s.id)),
            tasks: prev.tasks.map((t) => (t.subject_id && idSet.has(t.subject_id) ? { ...t, subject_id: null } : t)),
            grades: prev.grades.filter((g) => !idSet.has(g.id)),
          }));
        }
      },

      addTask: async (input) => {
        const userId = await getUserId();
        if (!userId) return;

        const newTask = {
          user_id: userId,
          title: input.title.trim(),
          description: input.description ?? null,
          status: "pending",
          priority: input.priority ?? "medium",
          type: input.type ?? "task",
          category: input.category ?? (input.subject_id ? "academic" : "personal"),
          due_date: input.due_date ?? null,
          estimated_minutes: input.estimated_minutes ?? null,
          subject_id: input.subject_id ?? null,
        };

        const { data, error } = await supabase.from("tasks").insert(newTask).select().single();
        if (!error && data) {
          setState((prev) => ({ ...prev, tasks: [...prev.tasks, data] }));
        }
      },

      addTasks: async (inputs) => {
        const userId = await getUserId();
        if (!userId) return;

        const newTasks = inputs.map((input) => ({
          user_id: userId,
          title: input.title.trim(),
          description: input.description ?? null,
          status: "pending",
          priority: input.priority ?? "medium",
          type: input.type ?? "task",
          category: input.category ?? (input.subject_id ? "academic" : "personal"),
          due_date: input.due_date ?? null,
          estimated_minutes: input.estimated_minutes ?? null,
          subject_id: input.subject_id ?? null,
        }));

        const { data, error } = await supabase.from("tasks").insert(newTasks).select();
        if (!error && data) {
          setState((prev) => ({ ...prev, tasks: [...prev.tasks, ...data] }));
        }
      },

      deleteTask: async (id) => {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (!error) {
          setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
        }
      },

      deleteTasks: async (ids = []) => {
        const { error } = await supabase.from("tasks").delete().in("id", ids);
        if (!error) {
          const idSet = new Set(ids);
          setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => !idSet.has(t.id)) }));
        }
      },

      toggleTaskDone: async (id) => {
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;
        const newStatus = task.status === "done" ? "pending" : "done";

        const { error } = await supabase
          .from("tasks")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", id);

        if (!error) {
          setState((prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === id ? { ...t, status: newStatus } : t)),
          }));
        }
      },

      addNote: async (input) => {
        const userId = await getUserId();
        if (!userId) return;

        const { data, error } = await supabase
          .from("notes")
          .insert({ user_id: userId, title: input.title.trim(), content: input.content })
          .select()
          .single();

        if (!error && data) {
          setState((prev) => ({ ...prev, notes: [...prev.notes, data] }));
        }
      },

      addNotes: async (inputs) => {
        const userId = await getUserId();
        if (!userId) return;

        const newNotes = inputs.map((i) => ({
          user_id: userId,
          title: i.title.trim(),
          content: i.content,
        }));

        const { data, error } = await supabase.from("notes").insert(newNotes).select();
        if (!error && data) {
          setState((prev) => ({ ...prev, notes: [...prev.notes, ...data] }));
        }
      },

      updateNote: async (id, input) => {
        const { data, error } = await supabase
          .from("notes")
          .update({
            title: input.title.trim(),
            content: input.content,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single();

        if (!error && data) {
          setState((prev) => ({
            ...prev,
            notes: prev.notes.map((n) => (n.id === id ? data : n)),
          }));
        }
      },

      deleteNote: async (id) => {
        const { error } = await supabase.from("notes").delete().eq("id", id);
        if (!error) {
          setState((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) }));
        }
      },

      addWorkout: async (input) => {
        const userId = await getUserId();
        if (!userId) return;

        const { data, error } = await supabase
          .from("workouts")
          .insert({
            user_id: userId,
            activity_type: input.activity_type.trim(),
            title: input.title ?? null,
            date: input.date ?? todayKey(),
            duration_minutes: input.duration_minutes,
            notes: input.notes ?? null,
          })
          .select()
          .single();

        if (!error && data) {
          setState((prev) => ({ ...prev, workouts: [...prev.workouts, data] }));
        }
      },

      addWorkouts: async (inputs) => {
        const userId = await getUserId();
        if (!userId) return;

        const newWorkouts = inputs.map((input) => ({
          user_id: userId,
          activity_type: input.activity_type.trim(),
          title: input.title ?? null,
          date: input.date ?? todayKey(),
          duration_minutes: input.duration_minutes,
          notes: input.notes ?? null,
        }));

        const { data, error } = await supabase.from("workouts").insert(newWorkouts).select();
        if (!error && data) {
          setState((prev) => ({ ...prev, workouts: [...prev.workouts, ...data] }));
        }
      },

      deleteWorkout: async (id) => {
        const { error } = await supabase.from("workouts").delete().eq("id", id);
        if (!error) {
          setState((prev) => ({ ...prev, workouts: prev.workouts.filter((w) => w.id !== id) }));
        }
      },

      addHabit: async (input) => {
        const userId = await getUserId();
        if (!userId) return;

        const { data, error } = await supabase
          .from("habits")
          .insert({
            user_id: userId,
            name: input.name.trim(),
            emoji: input.emoji?.trim() || "✨",
            frequency: "daily",
          })
          .select()
          .single();

        if (!error && data) {
          setState((prev) => ({ ...prev, habits: [...prev.habits, data] }));
        }
      },

      addHabits: async (inputs) => {
        const userId = await getUserId();
        if (!userId) return;

        const newHabits = inputs.map((i) => ({
          user_id: userId,
          name: i.name.trim(),
          emoji: i.emoji?.trim() || "✨",
          frequency: "daily",
        }));

        const { data, error } = await supabase.from("habits").insert(newHabits).select();
        if (!error && data) {
          setState((prev) => ({ ...prev, habits: [...prev.habits, ...data] }));
        }
      },

      deleteHabit: async (id) => {
        const { error } = await supabase.from("habits").delete().eq("id", id);
        if (!error) {
          setState((prev) => ({
            ...prev,
            habits: prev.habits.filter((h) => h.id !== id),
            habitCompletions: prev.habitCompletions.filter((c) => c.habit_id !== id),
          }));
        }
      },

      toggleHabit: async (habitId) => {
        const userId = await getUserId();
        if (!userId) return;

        const today = todayKey();
        const existing = state.habitCompletions.find(
          (c) => c.habit_id === habitId && c.completed_on === today
        );

        if (existing) {
          const { error } = await supabase.from("habit_completions").delete().eq("id", existing.id);
          if (!error) {
            setState((prev) => ({
              ...prev,
              habitCompletions: prev.habitCompletions.filter((c) => c.id !== existing.id),
            }));
          }
        } else {
          const { data, error } = await supabase
            .from("habit_completions")
            .insert({ habit_id: habitId, user_id: userId, completed_on: today })
            .select()
            .single();

          if (!error && data) {
            setState((prev) => ({
              ...prev,
              habitCompletions: [...prev.habitCompletions, data],
            }));
          }
        }
      },

      addTransaction: async (input) => {
        const userId = await getUserId();
        if (!userId) return;

        const { data, error } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            type: input.type,
            amount: Number(input.amount),
            category: input.category.trim(),
            description: input.description ?? null,
            date: input.date ?? todayKey(),
          })
          .select()
          .single();

        if (!error && data) {
          setState((prev) => ({ ...prev, transactions: [...prev.transactions, data] }));
        }
      },

      addTransactions: async (inputs) => {
        const userId = await getUserId();
        if (!userId) return;

        const newTrans = inputs.map((i) => ({
          user_id: userId,
          type: i.type,
          amount: Number(i.amount),
          category: i.category.trim(),
          description: i.description ?? null,
          date: i.date ?? todayKey(),
        }));

        const { data, error } = await supabase.from("transactions").insert(newTrans).select();
        if (!error && data) {
          setState((prev) => ({ ...prev, transactions: [...prev.transactions, ...data] }));
        }
      },

      deleteTransaction: async (id) => {
        const { error } = await supabase.from("transactions").delete().eq("id", id);
        if (!error) {
          setState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
        }
      },

      setBudget: async (amount) => {
        setState((prev) => ({ ...prev, budget: amount }));
      },

      addGrade: async (input) => {
        const userId = await getUserId();
        if (!userId) return;

        const { data, error } = await supabase
          .from("grades")
          .insert({
            user_id: userId,
            subject_id: input.subject_id,
            task_id: input.task_id ?? null,
            title: input.title.trim(),
            score: Number(input.score),
            max_score: input.max_score ? Number(input.max_score) : 10,
            weight_percentage: input.weight_percentage != null ? Number(input.weight_percentage) : null,
            date: input.date ?? todayKey(),
            notes: input.notes ?? null,
          })
          .select()
          .single();

        if (!error && data) {
          setState((prev) => ({ ...prev, grades: [...prev.grades, data] }));
        }
      },

      addGrades: async (inputs) => {
        const userId = await getUserId();
        if (!userId) return;

        const newGrades = inputs.map((input) => ({
          user_id: userId,
          subject_id: input.subject_id,
          task_id: input.task_id ?? null,
          title: input.title.trim(),
          score: Number(input.score),
          max_score: input.max_score ? Number(input.max_score) : 10,
          weight_percentage: input.weight_percentage != null ? Number(input.weight_percentage) : null,
          date: input.date ?? todayKey(),
          notes: input.notes ?? null,
        }));

        const { data, error } = await supabase.from("grades").insert(newGrades).select();
        if (!error && data) {
          setState((prev) => ({ ...prev, grades: [...prev.grades, ...data] }));
        }
      },

      updateGrade: async (id, input) => {
        const { data, error } = await supabase
          .from("grades")
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();

        if (!error && data) {
          setState((prev) => ({
            ...prev,
            grades: prev.grades.map((g) => (g.id === id ? data : g)),
          }));
        }
      },

      deleteGrade: async (id) => {
        const { error } = await supabase.from("grades").delete().eq("id", id);
        if (!error) {
          setState((prev) => ({ ...prev, grades: prev.grades.filter((g) => g.id !== id) }));
        }
      },

      deleteGrades: async (ids = []) => {
        const { error } = await supabase.from("grades").delete().in("id", ids);
        if (!error) {
          const idSet = new Set(ids);
          setState((prev) => ({ ...prev, grades: prev.grades.filter((g) => !idSet.has(g.id)) }));
        }
      },
    };
  }, [state.subjects, state.tasks, state.habitCompletions]);

  const value = useMemo<DataContextValue>(() => {
    const finance = computeFinance(state.transactions, state.budget);
    return {
      data: { ...state, finance },
      hydrated,
      actions,
    };
  }, [state, hydrated, actions]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData debe usarse dentro de <DataProvider>.");
  }
  return ctx;
}
