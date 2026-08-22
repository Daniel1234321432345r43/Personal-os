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

const STORAGE_KEY = "nucleo:data:v1";
const STORAGE_VERSION = 1;
const LOCAL_USER_ID = "local";

/** Estado crudo persistido en localStorage (sin el resumen de finanzas, que se calcula). */
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
  addSubject: (input: SubjectInput) => void;
  addSubjects: (inputs: SubjectInput[]) => void;
  deleteSubject: (id: string) => void;
  deleteSubjects: (ids?: string[], names?: string[]) => void;
  addTask: (input: TaskInput) => void;
  addTasks: (inputs: TaskInput[]) => void;
  deleteTask: (id: string) => void;
  deleteTasks: (ids?: string[], titles?: string[]) => void;
  toggleTaskDone: (id: string) => void;
  addNote: (input: NoteInput) => void;
  addNotes: (inputs: NoteInput[]) => void;
  updateNote: (id: string, input: NoteInput) => void;
  deleteNote: (id: string) => void;
  addWorkout: (input: WorkoutInput) => void;
  addWorkouts: (inputs: WorkoutInput[]) => void;
  deleteWorkout: (id: string) => void;
  addHabit: (input: HabitInput) => void;
  addHabits: (inputs: HabitInput[]) => void;
  deleteHabit: (id: string) => void;
  toggleHabit: (habitId: string) => void;
  addTransaction: (input: TransactionInput) => void;
  addTransactions: (inputs: TransactionInput[]) => void;
  deleteTransaction: (id: string) => void;
  setBudget: (amount: number | null) => void;
  addGrade: (input: GradeInput) => void;
  addGrades: (inputs: GradeInput[]) => void;
  updateGrade: (id: string, input: Partial<GradeInput>) => void;
  deleteGrade: (id: string) => void;
  deleteGrades: (ids?: string[], titles?: string[]) => void;
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

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function loadState(): DataState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== STORAGE_VERSION || !parsed?.data) return emptyState();
    return { ...emptyState(), ...parsed.data, grades: parsed.data.grades || [] };
  } catch {
    return emptyState();
  }
}

function saveState(state: DataState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: STORAGE_VERSION, data: state }),
    );
  } catch {
    // Ignorar errores de cuota o serialización.
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>(emptyState);
  const [hydrated, setHydrated] = useState(false);

  // Cargar desde localStorage una sola vez al montar (evita mismatch de hidratación).
  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  // Persistir en cada cambio (una vez hidratado).
  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  const actions = useMemo<DataActions>(() => {
    const DEFAULT_COLORS = [
      "#6366f1",
      "#0ea5e9",
      "#10b981",
      "#f59e0b",
      "#ef4444",
      "#ec4899",
      "#8b5cf6",
      "#14b8a6",
    ];

    return {
      addSubject: (input) => {
        const iso = nowIso();
        setState((prev) => ({
          ...prev,
          subjects: [
            ...prev.subjects,
            {
              id: newId(),
              user_id: LOCAL_USER_ID,
              name: input.name.trim(),
              color: input.color || DEFAULT_COLORS[prev.subjects.length % DEFAULT_COLORS.length],
              classroom_course_id: null,
              classroom_name: null,
              created_at: iso,
            },
          ],
        }));
      },

      addSubjects: (inputs) => {
        const iso = nowIso();
        setState((prev) => {
          const newSubjects: Subject[] = [];
          inputs.forEach((input) => {
            const trimmed = input.name.trim();
            if (!trimmed) return;
            const exists = prev.subjects
              .concat(newSubjects)
              .some((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase());
            if (!exists) {
              const colorIndex =
                (prev.subjects.length + newSubjects.length) % DEFAULT_COLORS.length;
              newSubjects.push({
                id: newId(),
                user_id: LOCAL_USER_ID,
                name: trimmed,
                color: input.color || DEFAULT_COLORS[colorIndex],
                classroom_course_id: null,
                classroom_name: null,
                created_at: iso,
              });
            }
          });
          if (newSubjects.length === 0) return prev;
          return {
            ...prev,
            subjects: [...prev.subjects, ...newSubjects],
          };
        });
      },

      deleteSubject: (id) =>
        setState((prev) => ({
          ...prev,
          subjects: prev.subjects.filter((s) => s.id !== id),
          tasks: prev.tasks.map((t) => (t.subject_id === id ? { ...t, subject_id: null } : t)),
          grades: prev.grades.filter((g) => g.subject_id !== id),
        })),

      deleteSubjects: (ids, names) =>
        setState((prev) => {
          const idSet = new Set(ids || []);
          const nameSet = new Set((names || []).map((n) => n.trim().toLowerCase()));
          const deletedIds = new Set<string>();
          const remainingSubjects = prev.subjects.filter((s) => {
            if (idSet.has(s.id) || nameSet.has(s.name.trim().toLowerCase())) {
              deletedIds.add(s.id);
              return false;
            }
            return true;
          });
          return {
            ...prev,
            subjects: remainingSubjects,
            tasks: prev.tasks.map((t) =>
              t.subject_id && deletedIds.has(t.subject_id) ? { ...t, subject_id: null } : t,
            ),
            grades: prev.grades.filter((g) => !deletedIds.has(g.subject_id)),
          };
        }),

      addTask: (input) => {
        const iso = nowIso();
        setState((prev) => {
          let resolvedSubjectId = input.subject_id ?? null;
          const newSubjects: Subject[] = [];

          if (!resolvedSubjectId && input.subject_name?.trim()) {
            const trimmed = input.subject_name.trim();
            const found = prev.subjects.find(
              (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase(),
            );
            if (found) {
              resolvedSubjectId = found.id;
            } else {
              const colorIndex =
                (prev.subjects.length + newSubjects.length) % DEFAULT_COLORS.length;
              const createdSub: Subject = {
                id: newId(),
                user_id: LOCAL_USER_ID,
                name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                classroom_course_id: null,
                classroom_name: null,
                created_at: iso,
              };
              newSubjects.push(createdSub);
              resolvedSubjectId = createdSub.id;
            }
          }

          const createdTasks: Task[] = [];

          if (input.session_dates && input.session_dates.length > 1) {
            const total = input.session_dates.length;
            const parentId = input.parent_task_id || newId();
            const cleanBaseTitle = input.title
              .replace(/\s*\d+\/\d+\s*$/, "")
              .replace(/\s*\(\d+\/\d+\)\s*$/, "")
              .trim();

            input.session_dates.forEach((dateStr, idx) => {
              createdTasks.push({
                id: newId(),
                user_id: LOCAL_USER_ID,
                title: `${cleanBaseTitle} ${idx + 1}/${total}`,
                description: input.description ?? null,
                status: "pending",
                priority: input.priority ?? "medium",
                type: input.type ?? "study_session",
                category: input.category ?? (resolvedSubjectId ? "academic" : "personal"),
                due_date: dateStr || null,
                estimated_minutes: input.estimated_minutes ?? null,
                subject_id: resolvedSubjectId,
                classroom_id: null,
                session_index: idx + 1,
                total_sessions: total,
                parent_task_id: parentId,
                created_at: iso,
                updated_at: iso,
              });
            });
          } else {
            createdTasks.push({
              id: newId(),
              user_id: LOCAL_USER_ID,
              title: input.title.trim(),
              description: input.description ?? null,
              status: "pending",
              priority: input.priority ?? "medium",
              type: input.type ?? "task",
              category: input.category ?? (resolvedSubjectId ? "academic" : "personal"),
              due_date: input.due_date ?? (input.session_dates?.[0] || null),
              estimated_minutes: input.estimated_minutes ?? null,
              subject_id: resolvedSubjectId,
              classroom_id: null,
              session_index: input.session_index ?? null,
              total_sessions: input.total_sessions ?? null,
              parent_task_id: input.parent_task_id ?? null,
              created_at: iso,
              updated_at: iso,
            });
          }

          return {
            ...prev,
            subjects: [...prev.subjects, ...newSubjects],
            tasks: [...prev.tasks, ...createdTasks],
          };
        });
      },

      addTasks: (inputs) => {
        const iso = nowIso();
        setState((prev) => {
          const newSubjects: Subject[] = [];
          const allSubjects = [...prev.subjects];

          const getOrAddSubjectId = (
            subjectId?: string | null,
            subjectName?: string | null,
          ): string | null => {
            if (subjectId) {
              const found = allSubjects.find((s) => s.id === subjectId);
              if (found) return found.id;
            }
            if (subjectName && subjectName.trim()) {
              const trimmed = subjectName.trim();
              const found = allSubjects.find(
                (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase(),
              );
              if (found) return found.id;

              const colorIndex = allSubjects.length % DEFAULT_COLORS.length;
              const createdSub: Subject = {
                id: newId(),
                user_id: LOCAL_USER_ID,
                name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                classroom_course_id: null,
                classroom_name: null,
                created_at: iso,
              };
              allSubjects.push(createdSub);
              newSubjects.push(createdSub);
              return createdSub.id;
            }
            return null;
          };

          const newTasks: Task[] = [];

          inputs.forEach((input) => {
            const resolvedSubjectId = getOrAddSubjectId(
              input.subject_id,
              input.subject_name,
            );

            if (input.session_dates && input.session_dates.length > 1) {
              const total = input.session_dates.length;
              const parentId = input.parent_task_id || newId();
              const cleanBaseTitle = input.title
                .replace(/\s*\d+\/\d+\s*$/, "")
                .replace(/\s*\(\d+\/\d+\)\s*$/, "")
                .trim();

              input.session_dates.forEach((dateStr, idx) => {
                newTasks.push({
                  id: newId(),
                  user_id: LOCAL_USER_ID,
                  title: `${cleanBaseTitle} ${idx + 1}/${total}`,
                  description: input.description ?? null,
                  status: "pending",
                  priority: input.priority ?? "medium",
                  type: input.type ?? "study_session",
                  category: input.category ?? (resolvedSubjectId ? "academic" : "personal"),
                  due_date: dateStr || null,
                  estimated_minutes: input.estimated_minutes ?? null,
                  subject_id: resolvedSubjectId,
                  classroom_id: null,
                  session_index: idx + 1,
                  total_sessions: total,
                  parent_task_id: parentId,
                  created_at: iso,
                  updated_at: iso,
                });
              });
            } else {
              newTasks.push({
                id: newId(),
                user_id: LOCAL_USER_ID,
                title: input.title.trim(),
                description: input.description ?? null,
                status: "pending",
                priority: input.priority ?? "medium",
                type: input.type ?? "task",
                category: input.category ?? (resolvedSubjectId ? "academic" : "personal"),
                due_date: input.due_date ?? (input.session_dates?.[0] || null),
                estimated_minutes: input.estimated_minutes ?? null,
                subject_id: resolvedSubjectId,
                classroom_id: null,
                session_index: input.session_index ?? null,
                total_sessions: input.total_sessions ?? null,
                parent_task_id: input.parent_task_id ?? null,
                created_at: iso,
                updated_at: iso,
              });
            }
          });

          return {
            ...prev,
            subjects: [...prev.subjects, ...newSubjects],
            tasks: [...prev.tasks, ...newTasks],
          };
        });
      },

      deleteTask: (id) =>
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== id),
        })),

      deleteTasks: (ids, titles) =>
        setState((prev) => {
          const idSet = new Set(ids || []);
          const titleSet = new Set((titles || []).map((t) => t.trim().toLowerCase()));
          return {
            ...prev,
            tasks: prev.tasks.filter(
              (t) =>
                !idSet.has(t.id) &&
                !titleSet.has(t.title.trim().toLowerCase()),
            ),
          };
        }),

      toggleTaskDone: (id) =>
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: t.status === "done" ? "pending" : "done",
                  updated_at: nowIso(),
                }
              : t,
          ),
        })),

      addNote: (input) => {
        const iso = nowIso();
        setState((prev) => ({
          ...prev,
          notes: [
            ...prev.notes,
            {
              id: newId(),
              user_id: LOCAL_USER_ID,
              title: input.title.trim(),
              content: input.content,
              file_name: input.file_name ?? null,
              file_type: input.file_type ?? null,
              file_data: input.file_data ?? null,
              created_at: iso,
              updated_at: iso,
            },
          ],
        }));
      },

      addNotes: (inputs) => {
        const iso = nowIso();
        setState((prev) => ({
          ...prev,
          notes: [
            ...prev.notes,
            ...inputs.map((input) => ({
              id: newId(),
              user_id: LOCAL_USER_ID,
              title: input.title.trim(),
              content: input.content,
              file_name: input.file_name ?? null,
              file_type: input.file_type ?? null,
              file_data: input.file_data ?? null,
              created_at: iso,
              updated_at: iso,
            })),
          ],
        }));
      },

      updateNote: (id, input) =>
        setState((prev) => ({
          ...prev,
          notes: prev.notes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  title: input.title.trim(),
                  content: input.content,
                  file_name: input.file_name ?? null,
                  file_type: input.file_type ?? null,
                  file_data: input.file_data ?? null,
                  updated_at: nowIso(),
                }
              : n,
          ),
        })),

      deleteNote: (id) =>
        setState((prev) => ({
          ...prev,
          notes: prev.notes.filter((n) => n.id !== id),
        })),

      addWorkout: (input) => {
        const iso = nowIso();
        setState((prev) => ({
          ...prev,
          workouts: [
            ...prev.workouts,
            {
              id: newId(),
              user_id: LOCAL_USER_ID,
              activity_type: input.activity_type.trim(),
              title: input.title ?? null,
              date: input.date ?? todayKey(),
              duration_minutes: input.duration_minutes,
              notes: input.notes ?? null,
              created_at: iso,
            },
          ],
        }));
      },

      addWorkouts: (inputs) => {
        const iso = nowIso();
        setState((prev) => ({
          ...prev,
          workouts: [
            ...prev.workouts,
            ...inputs.map((input) => ({
              id: newId(),
              user_id: LOCAL_USER_ID,
              activity_type: input.activity_type.trim(),
              title: input.title ?? null,
              date: input.date ?? todayKey(),
              duration_minutes: input.duration_minutes,
              notes: input.notes ?? null,
              created_at: iso,
            })),
          ],
        }));
      },

      deleteWorkout: (id) =>
        setState((prev) => ({
          ...prev,
          workouts: prev.workouts.filter((w) => w.id !== id),
        })),

      addHabit: (input) => {
        const iso = nowIso();
        setState((prev) => ({
          ...prev,
          habits: [
            ...prev.habits,
            {
              id: newId(),
              user_id: LOCAL_USER_ID,
              name: input.name.trim(),
              emoji: input.emoji?.trim() || "✨",
              frequency: "daily",
              created_at: iso,
            },
          ],
        }));
      },

      addHabits: (inputs) => {
        const iso = nowIso();
        setState((prev) => ({
          ...prev,
          habits: [
            ...prev.habits,
            ...inputs.map((input) => ({
              id: newId(),
              user_id: LOCAL_USER_ID,
              name: input.name.trim(),
              emoji: input.emoji?.trim() || "✨",
              frequency: "daily" as const,
              created_at: iso,
            })),
          ],
        }));
      },

      deleteHabit: (id) =>
        setState((prev) => ({
          ...prev,
          habits: prev.habits.filter((h) => h.id !== id),
          habitCompletions: prev.habitCompletions.filter(
            (c) => c.habit_id !== id,
          ),
        })),

      toggleHabit: (habitId) =>
        setState((prev) => {
          const today = todayKey();
          const existing = prev.habitCompletions.some(
            (c) => c.habit_id === habitId && c.completed_on === today,
          );
          const habitCompletions = existing
            ? prev.habitCompletions.filter(
                (c) => !(c.habit_id === habitId && c.completed_on === today),
              )
            : [
                ...prev.habitCompletions,
                {
                  id: newId(),
                  habit_id: habitId,
                  user_id: LOCAL_USER_ID,
                  completed_on: today,
                },
              ];
          return { ...prev, habitCompletions };
        }),

      addTransaction: (input) => {
        const iso = nowIso();
        setState((prev) => ({
          ...prev,
          transactions: [
            ...prev.transactions,
            {
              id: newId(),
              user_id: LOCAL_USER_ID,
              type: input.type,
              amount: Number(input.amount),
              category: input.category.trim(),
              description: input.description ?? null,
              date: input.date ?? todayKey(),
              created_at: iso,
            },
          ],
        }));
      },

      addTransactions: (inputs) => {
        const iso = nowIso();
        setState((prev) => ({
          ...prev,
          transactions: [
            ...prev.transactions,
            ...inputs.map((input) => ({
              id: newId(),
              user_id: LOCAL_USER_ID,
              type: input.type,
              amount: Number(input.amount),
              category: input.category.trim(),
              description: input.description ?? null,
              date: input.date ?? todayKey(),
              created_at: iso,
            })),
          ],
        }));
      },

      deleteTransaction: (id) =>
        setState((prev) => ({
          ...prev,
          transactions: prev.transactions.filter((t) => t.id !== id),
        })),

      setBudget: (amount) =>
        setState((prev) => ({ ...prev, budget: amount })),

      addGrade: (input) => {
        const iso = nowIso();
        setState((prev) => {
          let resolvedSubjectId = input.subject_id ?? null;
          const newSubjects: Subject[] = [];

          if (!resolvedSubjectId && input.subject_name?.trim()) {
            const trimmed = input.subject_name.trim();
            const found = prev.subjects.find(
              (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase(),
            );
            if (found) {
              resolvedSubjectId = found.id;
            } else {
              const colorIndex =
                (prev.subjects.length + newSubjects.length) % DEFAULT_COLORS.length;
              const createdSub: Subject = {
                id: newId(),
                user_id: LOCAL_USER_ID,
                name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                classroom_course_id: null,
                classroom_name: null,
                created_at: iso,
              };
              newSubjects.push(createdSub);
              resolvedSubjectId = createdSub.id;
            }
          }

          if (!resolvedSubjectId && prev.subjects.length > 0) {
            resolvedSubjectId = prev.subjects[0].id;
          }

          if (!resolvedSubjectId) {
            // Si no hay ninguna asignatura, crear una General
            const createdSub: Subject = {
              id: newId(),
              user_id: LOCAL_USER_ID,
              name: "General",
              color: DEFAULT_COLORS[0],
              classroom_course_id: null,
              classroom_name: null,
              created_at: iso,
            };
            newSubjects.push(createdSub);
            resolvedSubjectId = createdSub.id;
          }

          let resolvedTaskId = input.task_id ?? null;
          let updatedTasks = prev.tasks;

          if (!resolvedTaskId && input.task_title?.trim()) {
            const trimmedTask = input.task_title.trim().toLowerCase();
            const foundTask = prev.tasks.find(
              (t) => t.title.trim().toLowerCase() === trimmedTask,
            );
            if (foundTask) {
              resolvedTaskId = foundTask.id;
              updatedTasks = prev.tasks.map((t) =>
                t.id === foundTask.id ? { ...t, status: "done" as const, updated_at: iso } : t,
              );
            }
          }

          const newGrade: Grade = {
            id: newId(),
            user_id: LOCAL_USER_ID,
            subject_id: resolvedSubjectId,
            task_id: resolvedTaskId,
            title: input.title.trim(),
            score: Number(input.score),
            max_score: input.max_score ? Number(input.max_score) : 10,
            weight_percentage:
              input.weight_percentage != null ? Number(input.weight_percentage) : null,
            date: input.date ?? todayKey(),
            notes: input.notes ?? null,
            created_at: iso,
            updated_at: iso,
          };

          return {
            ...prev,
            subjects: [...prev.subjects, ...newSubjects],
            tasks: updatedTasks,
            grades: [...prev.grades, newGrade],
          };
        });
      },

      addGrades: (inputs) => {
        const iso = nowIso();
        setState((prev) => {
          const newSubjects: Subject[] = [];
          const allSubjects = [...prev.subjects];
          let updatedTasks = [...prev.tasks];

          const getOrAddSubjectId = (
            subjectId?: string | null,
            subjectName?: string | null,
          ): string => {
            if (subjectId) {
              const found = allSubjects.find((s) => s.id === subjectId);
              if (found) return found.id;
            }
            if (subjectName && subjectName.trim()) {
              const trimmed = subjectName.trim();
              const found = allSubjects.find(
                (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase(),
              );
              if (found) return found.id;

              const colorIndex = allSubjects.length % DEFAULT_COLORS.length;
              const createdSub: Subject = {
                id: newId(),
                user_id: LOCAL_USER_ID,
                name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                classroom_course_id: null,
                classroom_name: null,
                created_at: iso,
              };
              allSubjects.push(createdSub);
              newSubjects.push(createdSub);
              return createdSub.id;
            }
            if (allSubjects.length > 0) return allSubjects[0].id;

            const createdSub: Subject = {
              id: newId(),
              user_id: LOCAL_USER_ID,
              name: "General",
              color: DEFAULT_COLORS[0],
              classroom_course_id: null,
              classroom_name: null,
              created_at: iso,
            };
            allSubjects.push(createdSub);
            newSubjects.push(createdSub);
            return createdSub.id;
          };

          const newGrades: Grade[] = [];

          inputs.forEach((input) => {
            const resolvedSubjectId = getOrAddSubjectId(
              input.subject_id,
              input.subject_name,
            );

            let resolvedTaskId = input.task_id ?? null;
            if (!resolvedTaskId && input.task_title?.trim()) {
              const trimmedTask = input.task_title.trim().toLowerCase();
              const foundTask = updatedTasks.find(
                (t) => t.title.trim().toLowerCase() === trimmedTask,
              );
              if (foundTask) {
                resolvedTaskId = foundTask.id;
                updatedTasks = updatedTasks.map((t) =>
                  t.id === foundTask.id ? { ...t, status: "done" as const, updated_at: iso } : t,
                );
              }
            }

            newGrades.push({
              id: newId(),
              user_id: LOCAL_USER_ID,
              subject_id: resolvedSubjectId,
              task_id: resolvedTaskId,
              title: input.title.trim(),
              score: Number(input.score),
              max_score: input.max_score ? Number(input.max_score) : 10,
              weight_percentage:
                input.weight_percentage != null ? Number(input.weight_percentage) : null,
              date: input.date ?? todayKey(),
              notes: input.notes ?? null,
              created_at: iso,
              updated_at: iso,
            });
          });

          return {
            ...prev,
            subjects: [...prev.subjects, ...newSubjects],
            tasks: updatedTasks,
            grades: [...prev.grades, ...newGrades],
          };
        });
      },

      updateGrade: (id, input) =>
        setState((prev) => ({
          ...prev,
          grades: prev.grades.map((g) =>
            g.id === id
              ? {
                  ...g,
                  ...(input.title !== undefined ? { title: input.title.trim() } : {}),
                  ...(input.score !== undefined ? { score: Number(input.score) } : {}),
                  ...(input.max_score !== undefined
                    ? { max_score: Number(input.max_score) }
                    : {}),
                  ...(input.weight_percentage !== undefined
                    ? {
                        weight_percentage:
                          input.weight_percentage != null
                            ? Number(input.weight_percentage)
                            : null,
                      }
                    : {}),
                  ...(input.date !== undefined ? { date: input.date } : {}),
                  ...(input.notes !== undefined ? { notes: input.notes } : {}),
                  ...(input.subject_id !== undefined ? { subject_id: input.subject_id! } : {}),
                  updated_at: nowIso(),
                }
              : g,
          ),
        })),

      deleteGrade: (id) =>
        setState((prev) => ({
          ...prev,
          grades: prev.grades.filter((g) => g.id !== id),
        })),

      deleteGrades: (ids, titles) =>
        setState((prev) => {
          const idSet = new Set(ids || []);
          const titleSet = new Set((titles || []).map((t) => t.trim().toLowerCase()));
          return {
            ...prev,
            grades: prev.grades.filter(
              (g) => !idSet.has(g.id) && !titleSet.has(g.title.trim().toLowerCase()),
            ),
          };
        }),
    };
  }, []);

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
