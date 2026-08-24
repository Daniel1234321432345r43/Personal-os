"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
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
const USER_STORAGE_PREFIX = `${STORAGE_KEY}:user:`;

const _supabase = createClient();

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
  start_time?: string | null;
  remind_before_minutes?: number | null;
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
  start_time?: string | null;
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

function loadState(storageKey = STORAGE_KEY): DataState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (parsed?.version !== STORAGE_VERSION || !parsed?.data) return emptyState();
    return { ...emptyState(), ...parsed.data, grades: parsed.data.grades || [] };
  } catch {
    return emptyState();
  }
}

function saveState(state: DataState, storageKey = STORAGE_KEY) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ version: STORAGE_VERSION, data: state }),
    );
  } catch {
    // Ignorar errores de cuota o serialización.
  }
}

/** Fusiona los datos remotos de Supabase con los locales. Remoto gana en conflicto. */
function mergeRemote(local: DataState, remote: DataState): DataState {
  const merge = <T extends { id: string }>(l: T[], r: T[]): T[] => {
    const map = new Map<string, T>();
    for (const item of l) map.set(item.id, item);
    for (const item of r) map.set(item.id, item);
    return Array.from(map.values());
  };
  return {
    subjects: merge(local.subjects, remote.subjects),
    tasks: merge(local.tasks, remote.tasks),
    notes: merge(local.notes, remote.notes),
    workouts: merge(local.workouts, remote.workouts),
    habits: merge(local.habits, remote.habits),
    habitCompletions: merge(local.habitCompletions, remote.habitCompletions),
    transactions: merge(local.transactions, remote.transactions),
    grades: merge(local.grades, remote.grades),
    budget: remote.budget ?? local.budget,
  };
}

/**
 * Ejecuta una operación remota sin bloquear la UI, pero deja el error visible.
 * Antes los errores se descartaban y parecía que los datos se habían guardado.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function syncSupabase(p: any, label = "operación") {
  if (!p || typeof p.then !== "function") {
    console.warn(`[Supabase diagnóstico] ${label}: no se creó la petición`);
    return Promise.resolve(false);
  }
  console.info(`[Supabase diagnóstico] petición iniciada: ${label}`);
  return p.then(
    (result: { error?: { message?: string } | null }) => {
      if (result?.error) {
        console.error(`[Supabase] ${label}: ${result.error.message || "error desconocido"}`);
        return false;
      }
      console.info(`[Supabase diagnóstico] petición correcta: ${label}`);
      return true;
    },
    (error: unknown) => {
      console.error(`[Supabase] ${label}:`, error);
      return false;
    },
  );
}

function userStorageKey(userId: string): string {
  return `${USER_STORAGE_PREFIX}${userId}`;
}

function localOnly(state: DataState): DataState {
  const filter = <T extends { user_id: string }>(items: T[]) =>
    items.filter((item) => item.user_id === "local");
  return {
    subjects: filter(state.subjects),
    tasks: filter(state.tasks),
    notes: filter(state.notes),
    workouts: filter(state.workouts),
    habits: filter(state.habits),
    habitCompletions: filter(state.habitCompletions),
    transactions: filter(state.transactions),
    grades: filter(state.grades),
    budget: state.budget,
  };
}

function hasRecords(state: DataState): boolean {
  return [
    state.subjects,
    state.tasks,
    state.notes,
    state.workouts,
    state.habits,
    state.habitCompletions,
    state.transactions,
    state.grades,
  ].some((items) => items.length > 0);
}

/** Sube datos locales en el orden correcto para respetar las claves foráneas. */
async function syncStateToSupabase(state: DataState, userId: string): Promise<boolean> {
  const operations: Array<[string, unknown]> = [
    ["subjects", state.subjects.map(({ id, name, color, classroom_course_id, classroom_name, created_at }) => ({ id, user_id: userId, name, color, classroom_course_id, classroom_name, created_at }))],
    ["habits", state.habits.map(({ id, name, emoji, frequency, created_at }) => ({ id, user_id: userId, name, emoji, frequency, created_at }))],
    ["tasks", state.tasks.map(({ id, title, description, status, priority, type, category, due_date, start_time, remind_before_minutes, estimated_minutes, subject_id, classroom_id, session_index, total_sessions, parent_task_id, created_at, updated_at }) => ({ id, user_id: userId, title, description, status, priority, type, category, due_date, start_time: start_time ?? null, remind_before_minutes: remind_before_minutes ?? null, estimated_minutes, subject_id, classroom_id, session_index: session_index ?? null, total_sessions: total_sessions ?? null, parent_task_id: parent_task_id ?? null, created_at, updated_at }))],
    ["notes", state.notes.map(({ id, title, content, file_name, file_type, file_data, created_at, updated_at }) => ({ id, user_id: userId, title, content, file_name, file_type, file_data, created_at, updated_at }))],
    ["workouts", state.workouts.map(({ id, activity_type, title, date, start_time, duration_minutes, notes, created_at }) => ({ id, user_id: userId, activity_type, title, date, start_time: start_time ?? null, duration_minutes, notes, created_at }))],
    ["transactions", state.transactions.map(({ id, type, amount, category, description, date, created_at }) => ({ id, user_id: userId, type, amount, category, description, date, created_at }))],
    ["habit_completions", state.habitCompletions.map(({ id, habit_id, completed_on }) => ({ id, user_id: userId, habit_id, completed_on }))],
    ["grades", state.grades.map(({ id, subject_id, task_id, title, score, max_score, weight_percentage, date, notes, created_at, updated_at }) => ({ id, user_id: userId, subject_id, task_id, title, score, max_score, weight_percentage, date, notes, created_at, updated_at }))],
    ["budgets", state.budget == null ? [] : [{ user_id: userId, month: `${todayKey().slice(0, 7)}-01`, amount: state.budget }]],
  ];

  let allSucceeded = true;
  for (const [table, rows] of operations) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const onConflict = table === "budgets" ? "user_id,month" : "id";
    const succeeded = await syncSupabase(
      _supabase.from(table).upsert(rows, { onConflict }),
      `guardar ${table}`,
    );
    if (!succeeded) allSucceeded = false;
  }
  return allSucceeded;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const syncedRef = useRef(false);
  const syncingUserRef = useRef(false);

  // Cargar desde localStorage una sola vez al montar (evita mismatch de hidratación).
  useEffect(() => {
    // La lectura depende de window y debe ejecutarse después de hidratar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setHydrated(true);
  }, []);

  // Esperar a que exista la sesión y sincronizar también si el OAuth termina
  // después de montar el proveedor. `getUser()` por sí solo podía ejecutarse
  // demasiado pronto y dejar todas las acciones en modo "local".
  useEffect(() => {
    if (!hydrated) return;

    const syncUser = async (userId: string) => {
      console.info("[Supabase diagnóstico] usuario autenticado:", userId);
      if (syncedRef.current && userIdRef.current === userId) return;
      syncedRef.current = true;
      userIdRef.current = userId;
      syncingUserRef.current = true;

      try {
        // Registrar la zona horaria real del navegador en el perfil. La Edge
        // Function send-reminders la usa para convertir la hora local (HH:MM)
        // de cada tarea en su instante UTC exacto; sin ella caería a UTC y
        // los avisos llegarían desplazados (p. ej. +2 h en Madrid en verano).
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          if (tz) {
            const { error: tzError } = await _supabase
              .from("users")
              .update({ timezone: tz })
              .eq("id", userId);
            if (tzError) {
              console.warn("[Supabase] no se pudo actualizar la zona horaria del perfil:", tzError.message);
            }
          }
        } catch (err) {
          console.warn("[Supabase] error actualizando la zona horaria del perfil:", err);
        }

        const guestState = localOnly(loadState());
        const userKey = userStorageKey(userId);
        const savedUserState = loadState(userKey);
        const pending = hasRecords(guestState) ? guestState : emptyState();
        const pendingSynced = !hasRecords(pending) || await syncStateToSupabase(pending, userId);

        const results = await Promise.all([
        _supabase.from("subjects").select("*").eq("user_id", userId),
        _supabase.from("tasks").select("*").eq("user_id", userId),
        _supabase.from("notes").select("*").eq("user_id", userId),
        _supabase.from("workouts").select("*").eq("user_id", userId),
        _supabase.from("habits").select("*").eq("user_id", userId),
        _supabase.from("habit_completions").select("*").eq("user_id", userId),
        _supabase.from("transactions").select("*").eq("user_id", userId),
        _supabase.from("grades").select("*").eq("user_id", userId),
        _supabase.from("budgets").select("amount").eq("user_id", userId).eq("month", `${todayKey().slice(0, 7)}-01`).maybeSingle(),
      ]);

      const labels = ["subjects", "tasks", "notes", "workouts", "habits", "habit_completions", "transactions", "grades", "budgets"];
      results.forEach((result, index) => {
        if (result.error) {
          console.error(`[Supabase] cargar ${labels[index]}: ${result.error.message}`);
        }
      });

      const [subjects, tasks, notes, workouts, habits, habitCompletions, transactions, grades, budgetRow] = results.map(
        (result) => result.data || [],
      );
      const normDate = (v: unknown): string | null =>
        typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null;
      const remote: DataState = {
        subjects: subjects as Subject[],
        tasks: (tasks as Record<string, unknown>[]).map((t) => ({
          ...t,
          due_date: normDate(t.due_date),
          start_time: typeof t.start_time === "string" && t.start_time.length >= 5
            ? t.start_time.slice(0, 5)
            : null,
          session_index: t.session_index ?? null,
          total_sessions: t.total_sessions ?? null,
          parent_task_id: t.parent_task_id ?? null,
        } as unknown as Task)),
        notes: notes as Note[],
        workouts: (workouts as Record<string, unknown>[]).map((w) => ({
          ...w,
          date: normDate(w.date),
          start_time: typeof w.start_time === "string" && w.start_time.length >= 5
            ? w.start_time.slice(0, 5)
            : null,
        } as unknown as Workout)),
        habits: habits as Habit[],
        habitCompletions: (habitCompletions as Record<string, unknown>[]).map((h) => ({ ...h, completed_on: normDate(h.completed_on) } as unknown as HabitCompletion)),
        transactions: (transactions as Record<string, unknown>[]).map((t) => ({ ...t, date: normDate(t.date) } as unknown as Transaction)),
        grades: grades as Grade[],
        budget: budgetRow && !Array.isArray(budgetRow)
          ? Number((budgetRow as { amount: number }).amount)
          : null,
      };

        const nextState = mergeRemote(savedUserState, mergeRemote(pending, remote));
        setState(nextState);
        saveState(nextState, userKey);
        if (pendingSynced && hasRecords(pending)) window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        syncingUserRef.current = false;
      }
    };

    const handleAuth = async () => {
      const configured = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      );
      let projectHost = "no disponible";
      try {
        projectHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host || "URL inválida";
      } catch {
        projectHost = "URL inválida";
      }
      console.info("[Supabase diagnóstico] cliente", { configured, projectHost });

      const { data: { user }, error } = await _supabase.auth.getUser();
      if (error) {
        console.error("[Supabase] comprobar sesión:", error.message);
      }
      console.info("[Supabase diagnóstico] sesión inicial:", user ? user.id : "ninguna");
      if (user) {
        try {
          await syncUser(user.id);
        } catch (error) {
          syncedRef.current = false;
          console.error("[Supabase] sincronización inicial fallida:", error);
        }
      }
    };

    void handleAuth();
    const { data: subscription } = _supabase.auth.onAuthStateChange((event, session) => {
      console.info(
        "[Supabase diagnóstico] cambio de autenticación:",
        event,
        session?.user?.id || "sin usuario",
      );
      if (event === "SIGNED_OUT") {
        userIdRef.current = null;
        syncedRef.current = false;
        setState(localOnly(loadState()));
        return;
      }
      if (session?.user) void syncUser(session.user.id);
    });
    return () => subscription.subscription.unsubscribe();
  }, [hydrated]);

  // Guardar cada sesión en su propia clave. La clave global solo representa
  // el modo invitado y no debe mezclar datos entre cuentas del mismo navegador.
  useEffect(() => {
    if (!hydrated) return;
    saveState(state, userIdRef.current ? userStorageKey(userIdRef.current) : STORAGE_KEY);
  }, [state, hydrated]);

  // Reintentar la sincronización con el estado ya calculado. Esto cubre las
  // acciones masivas y evita depender de valores asignados dentro de setState.
  useEffect(() => {
    if (!hydrated || !userIdRef.current || syncingUserRef.current) return;
    void syncStateToSupabase(state, userIdRef.current);
  }, [state, hydrated]);

  const actions = useMemo<DataActions>(() => {
    const DEFAULT_COLORS = [
      "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
      "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6",
    ];

    const uid = (): string => {
      if (!userIdRef.current) {
        console.warn("[Supabase diagnóstico] esta acción se está guardando solo en localStorage: no hay sesión");
      }
      return userIdRef.current || "local";
    };

    return {
      addSubject: (input) => {
        const iso = nowIso();
        const id = newId();
        const userId = uid();
        let color = input.color || DEFAULT_COLORS[0];
        setState((prev) => {
          color = input.color || DEFAULT_COLORS[prev.subjects.length % DEFAULT_COLORS.length];
          return {
            ...prev,
            subjects: [
              ...prev.subjects,
              { id, user_id: userId, name: input.name.trim(), color, classroom_course_id: null, classroom_name: null, created_at: iso } as Subject,
            ],
          };
        });
        if (userId !== "local") {
          void syncSupabase(_supabase.from("subjects").insert({ id, user_id: userId, name: input.name.trim(), color, created_at: iso }), "guardar asignatura");
        }
      },

      addSubjects: (inputs) => {
        const iso = nowIso();
        const userId = uid();
        let createdSubjects: Subject[] = [];
        setState((prev) => {
          const newSubjects: Subject[] = [];
          inputs.forEach((input) => {
            const trimmed = input.name.trim();
            if (!trimmed) return;
            const exists = prev.subjects
              .concat(newSubjects)
              .some((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase());
            if (!exists) {
              const colorIndex = (prev.subjects.length + newSubjects.length) % DEFAULT_COLORS.length;
              const id = newId();
              newSubjects.push({
                id, user_id: userId, name: trimmed,
                color: input.color || DEFAULT_COLORS[colorIndex],
                classroom_course_id: null, classroom_name: null, created_at: iso,
              } as Subject);
            }
          });
          if (newSubjects.length === 0) return prev;
          createdSubjects = newSubjects;
          return { ...prev, subjects: [...prev.subjects, ...newSubjects] };
        });
        if (userId !== "local" && createdSubjects.length > 0) {
          void syncSupabase(
            _supabase.from("subjects").insert(createdSubjects.map(({ id, name, color, classroom_course_id, classroom_name, created_at }) => ({ id, user_id: userId, name, color, classroom_course_id, classroom_name, created_at }))),
            "guardar asignaturas",
          );
        }
      },

      deleteSubject: (id) => {
        setState((prev) => ({
          ...prev,
          subjects: prev.subjects.filter((s) => s.id !== id),
          tasks: prev.tasks.map((t) => (t.subject_id === id ? { ...t, subject_id: null } : t)),
          grades: prev.grades.filter((g) => g.subject_id !== id),
        }));
        syncSupabase(_supabase.from("subjects").delete().eq("id", id));
      },

      deleteSubjects: (ids, names) => {
        let deletedSubjectIds: string[] = [];
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
          deletedSubjectIds = Array.from(deletedIds);
          return {
            ...prev,
            subjects: remainingSubjects,
            tasks: prev.tasks.map((t) =>
              t.subject_id && deletedIds.has(t.subject_id) ? { ...t, subject_id: null } : t,
            ),
            grades: prev.grades.filter((g) => !deletedIds.has(g.subject_id)),
          };
        });
        if (deletedSubjectIds.length > 0) {
          void syncSupabase(_supabase.from("subjects").delete().in("id", deletedSubjectIds), "borrar asignaturas");
        }
      },

      addTask: (input) => {
        const iso = nowIso();
        const userId = uid();
        let createdTasks: Task[] = [];
        let newSubjects: Subject[] = [];

        setState((prev) => {
          let resolvedSubjectId = input.subject_id ?? null;
          newSubjects = [];
          createdTasks = [];

          if (!resolvedSubjectId && input.subject_name?.trim()) {
            const trimmed = input.subject_name.trim();
            const found = prev.subjects.find(
              (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase(),
            );
            if (found) {
              resolvedSubjectId = found.id;
            } else {
              const id = newId();
              const colorIndex = (prev.subjects.length + newSubjects.length) % DEFAULT_COLORS.length;
              const sub: Subject = {
                id, user_id: userId, name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                classroom_course_id: null, classroom_name: null, created_at: iso,
              };
              newSubjects.push(sub);
              resolvedSubjectId = sub.id;
            }
          }

          if (input.session_dates && input.session_dates.length > 1) {
            const total = input.session_dates.length;
            const parentId = input.parent_task_id || newId();
            const cleanBaseTitle = input.title
              .replace(/\s*\d+\/\d+\s*$/, "")
              .replace(/\s*\(\d+\/\d+\)\s*$/, "")
              .trim();

            input.session_dates.forEach((dateStr, idx) => {
              createdTasks.push({
                id: newId(), user_id: userId,
                title: `${cleanBaseTitle} ${idx + 1}/${total}`,
                description: input.description ?? null,
                status: "pending", priority: input.priority ?? "medium",
                type: input.type ?? "study_session",
                category: input.category ?? (resolvedSubjectId ? "academic" : "personal"),
                due_date: dateStr || null,
                start_time: input.start_time ?? null,
                remind_before_minutes: input.remind_before_minutes ?? null,
                estimated_minutes: input.estimated_minutes ?? null,
                subject_id: resolvedSubjectId, classroom_id: null,
                session_index: idx + 1, total_sessions: total, parent_task_id: parentId,
                created_at: iso, updated_at: iso,
              } as Task);
            });
          } else {
            createdTasks.push({
              id: newId(), user_id: userId,
              title: input.title.trim(),
              description: input.description ?? null,
              status: "pending", priority: input.priority ?? "medium",
              type: input.type ?? "task",
              category: input.category ?? (resolvedSubjectId ? "academic" : "personal"),
              due_date: input.due_date ?? (input.session_dates?.[0] || null),
              start_time: input.start_time ?? null,
              remind_before_minutes: input.remind_before_minutes ?? null,
              estimated_minutes: input.estimated_minutes ?? null,
              subject_id: resolvedSubjectId, classroom_id: null,
              session_index: input.session_index ?? null,
              total_sessions: input.total_sessions ?? null,
              parent_task_id: input.parent_task_id ?? null,
              created_at: iso, updated_at: iso,
            } as Task);
          }

          return {
            ...prev,
            subjects: [...prev.subjects, ...newSubjects],
            tasks: [...prev.tasks, ...createdTasks],
          };
        });

        // Sync to Supabase. La asignatura creada automáticamente debe existir
        // antes que la tarea por la clave foránea subject_id.
        if (userId !== "local" && createdTasks.length > 0) {
          const rows = createdTasks.map((t: Task) => ({
            id: t.id,
            user_id: t.user_id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            type: t.type,
            category: t.category,
            due_date: t.due_date,
            start_time: t.start_time,
            remind_before_minutes: t.remind_before_minutes ?? null,
            estimated_minutes: t.estimated_minutes,
            subject_id: t.subject_id,
            classroom_id: t.classroom_id,
            session_index: t.session_index,
            total_sessions: t.total_sessions,
            parent_task_id: t.parent_task_id,
            created_at: t.created_at,
            updated_at: t.updated_at,
          }));
          void (async () => {
            if (newSubjects.length > 0) {
              const subjectResult = await syncSupabase(
                _supabase.from("subjects").insert(newSubjects.map(({ id, name, color, classroom_course_id, classroom_name, created_at }) => ({ id, user_id: userId, name, color, classroom_course_id, classroom_name, created_at }))),
                "guardar asignatura de tarea",
              );
              if (!subjectResult) return;
            }
            await syncSupabase(_supabase.from("tasks").insert(rows), "guardar tarea");
          })();
        }
      },

      addTasks: (inputs) => {
        const iso = nowIso();
        const userId = uid();
        let allNewTasks: Task[] = [];
        let createdSubjects: Subject[] = [];

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
              const id = newId();
              const createdSub: Subject = {
                id, user_id: userId, name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                classroom_course_id: null, classroom_name: null, created_at: iso,
              };
              allSubjects.push(createdSub);
              newSubjects.push(createdSub);
              return createdSub.id;
            }
            return null;
          };

          const newTasks: Task[] = [];

          inputs.forEach((input) => {
            const resolvedSubjectId = getOrAddSubjectId(input.subject_id, input.subject_name);

            if (input.session_dates && input.session_dates.length > 1) {
              const total = input.session_dates.length;
              const parentId = input.parent_task_id || newId();
              const cleanBaseTitle = input.title
                .replace(/\s*\d+\/\d+\s*$/, "")
                .replace(/\s*\(\d+\/\d+\)\s*$/, "")
                .trim();

              input.session_dates.forEach((dateStr, idx) => {
                newTasks.push({
                  id: newId(), user_id: userId,
                  title: `${cleanBaseTitle} ${idx + 1}/${total}`,
                  description: input.description ?? null,
                  status: "pending", priority: input.priority ?? "medium",
                  type: input.type ?? "study_session",
                  category: input.category ?? (resolvedSubjectId ? "academic" : "personal"),
                  due_date: dateStr || null,
                  start_time: input.start_time ?? null,
                  remind_before_minutes: input.remind_before_minutes ?? null,
                  estimated_minutes: input.estimated_minutes ?? null,
                  subject_id: resolvedSubjectId, classroom_id: null,
                  session_index: idx + 1, total_sessions: total, parent_task_id: parentId,
                  created_at: iso, updated_at: iso,
                } as Task);
              });
            } else {
              newTasks.push({
                id: newId(), user_id: userId,
                title: input.title.trim(),
                description: input.description ?? null,
                status: "pending", priority: input.priority ?? "medium",
                type: input.type ?? "task",
                category: input.category ?? (resolvedSubjectId ? "academic" : "personal"),
                due_date: input.due_date ?? (input.session_dates?.[0] || null),
                start_time: input.start_time ?? null,
                remind_before_minutes: input.remind_before_minutes ?? null,
                estimated_minutes: input.estimated_minutes ?? null,
                subject_id: resolvedSubjectId, classroom_id: null,
                session_index: input.session_index ?? null,
                total_sessions: input.total_sessions ?? null,
                parent_task_id: input.parent_task_id ?? null,
                created_at: iso, updated_at: iso,
              } as Task);
            }
          });

          allNewTasks = newTasks;
          createdSubjects = newSubjects;

          return {
            ...prev,
            subjects: [...prev.subjects, ...newSubjects],
            tasks: [...prev.tasks, ...newTasks],
          };
        });

        if (userId !== "local" && allNewTasks.length > 0) {
          const rows = allNewTasks.map((t: Task) => ({
            id: t.id,
            user_id: t.user_id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            type: t.type,
            category: t.category,
            due_date: t.due_date,
            start_time: t.start_time,
            remind_before_minutes: t.remind_before_minutes ?? null,
            estimated_minutes: t.estimated_minutes,
            subject_id: t.subject_id,
            classroom_id: t.classroom_id,
            session_index: t.session_index,
            total_sessions: t.total_sessions,
            parent_task_id: t.parent_task_id,
            created_at: t.created_at,
            updated_at: t.updated_at,
          }));
          void (async () => {
            if (createdSubjects.length > 0) {
              const subjectResult = await syncSupabase(
                _supabase.from("subjects").insert(createdSubjects.map(({ id, name, color, classroom_course_id, classroom_name, created_at }) => ({ id, user_id: userId, name, color, classroom_course_id, classroom_name, created_at }))),
                "guardar asignaturas de tareas",
              );
              if (!subjectResult) return;
            }
            await syncSupabase(_supabase.from("tasks").insert(rows), "guardar tareas");
          })();
        }
      },

      deleteTask: (id) => {
        setState((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
        syncSupabase(_supabase.from("tasks").delete().eq("id", id));
      },

      deleteTasks: (ids, titles) => {
        setState((prev) => {
          const idSet = new Set(ids || []);
          const titleSet = new Set((titles || []).map((t) => t.trim().toLowerCase()));
          return {
            ...prev,
            tasks: prev.tasks.filter(
              (t) => !idSet.has(t.id) && !titleSet.has(t.title.trim().toLowerCase()),
            ),
          };
        });
        if (ids?.length) syncSupabase(_supabase.from("tasks").delete().in("id", ids));
      },

      toggleTaskDone: (id) => {
        setState((prev) => {
          const task = prev.tasks.find((t) => t.id === id);
          if (!task) return prev;
          const newStatus: Task["status"] = task.status === "done" ? "pending" : "done";
          const updated_at = nowIso();          void syncSupabase(_supabase.from("tasks").update({ status: newStatus, updated_at }).eq("id", id), "actualizar tarea");
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === id ? { ...t, status: newStatus, updated_at } : t,
            ),
          };
        });
      },

      addNote: (input) => {
        const iso = nowIso();
        const id = newId();
        const userId = uid();
        setState((prev) => ({
          ...prev,
          notes: [
            ...prev.notes,
            { id, user_id: userId, title: input.title.trim(), content: input.content, file_name: input.file_name ?? null, file_type: input.file_type ?? null, file_data: input.file_data ?? null, created_at: iso, updated_at: iso } as Note,
          ],
        }));
        if (userId !== "local") {
          syncSupabase(_supabase.from("notes").insert({ id, user_id: userId, title: input.title.trim(), content: input.content, created_at: iso, updated_at: iso }));
        }
      },

      addNotes: (inputs) => {
        const iso = nowIso();
        const userId = uid();
        const newNotes = inputs.map((input) => ({ id: newId(), user_id: userId, title: input.title.trim(), content: input.content, file_name: input.file_name ?? null, file_type: input.file_type ?? null, file_data: input.file_data ?? null, created_at: iso, updated_at: iso } as Note));
        setState((prev) => ({ ...prev, notes: [...prev.notes, ...newNotes] }));
        if (userId !== "local" && newNotes.length > 0) {
          void syncSupabase(_supabase.from("notes").insert(newNotes), "guardar notas");
        }
      },

      updateNote: (id, input) => {
        setState((prev) => ({
          ...prev,
          notes: prev.notes.map((n) =>
            n.id === id
              ? { ...n, title: input.title.trim(), content: input.content, file_name: input.file_name ?? null, file_type: input.file_type ?? null, file_data: input.file_data ?? null, updated_at: nowIso() }
              : n,
          ),
        }));
        syncSupabase(
          _supabase.from("notes").update({ title: input.title.trim(), content: input.content, updated_at: new Date().toISOString() }).eq("id", id)
        );
      },

      deleteNote: (id) => {
        setState((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) }));
        syncSupabase(_supabase.from("notes").delete().eq("id", id));
      },

      addWorkout: (input) => {
        const iso = nowIso();
        const id = newId();
        const userId = uid();
        const date = input.date ?? todayKey();
        setState((prev) => ({
          ...prev,
          workouts: [
            ...prev.workouts,
            { id, user_id: userId, activity_type: input.activity_type.trim(), title: input.title ?? null, date, start_time: input.start_time ?? null, duration_minutes: input.duration_minutes, notes: input.notes ?? null, created_at: iso } as Workout,
          ],
        }));
        if (userId !== "local") {
          syncSupabase(_supabase.from("workouts").insert({ id, user_id: userId, activity_type: input.activity_type.trim(), title: input.title ?? null, date, start_time: input.start_time ?? null, duration_minutes: input.duration_minutes, notes: input.notes ?? null, created_at: iso }));
        }
      },

      addWorkouts: (inputs) => {
        const iso = nowIso();
        const userId = uid();
        const newWorkouts = inputs.map((input) => ({ id: newId(), user_id: userId, activity_type: input.activity_type.trim(), title: input.title ?? null, date: input.date ?? todayKey(), start_time: input.start_time ?? null, duration_minutes: input.duration_minutes, notes: input.notes ?? null, created_at: iso } as Workout));
        setState((prev) => ({ ...prev, workouts: [...prev.workouts, ...newWorkouts] }));
        if (userId !== "local" && newWorkouts.length > 0) {
          void syncSupabase(_supabase.from("workouts").insert(newWorkouts), "guardar entrenamientos");
        }
      },

      deleteWorkout: (id) => {
        setState((prev) => ({ ...prev, workouts: prev.workouts.filter((w) => w.id !== id) }));
        syncSupabase(_supabase.from("workouts").delete().eq("id", id));
      },

      addHabit: (input) => {
        const iso = nowIso();
        const id = newId();
        const userId = uid();
        const emoji = input.emoji?.trim() || "✨";
        setState((prev) => ({
          ...prev,
          habits: [
            ...prev.habits,
            { id, user_id: userId, name: input.name.trim(), emoji, frequency: "daily", created_at: iso } as Habit,
          ],
        }));
        if (userId !== "local") {
          syncSupabase(_supabase.from("habits").insert({ id, user_id: userId, name: input.name.trim(), emoji, frequency: "daily", created_at: iso }));
        }
      },

      addHabits: (inputs) => {
        const iso = nowIso();
        const userId = uid();
        const newHabits = inputs.map((input) => ({ id: newId(), user_id: userId, name: input.name.trim(), emoji: input.emoji?.trim() || "✨", frequency: "daily" as const, created_at: iso } as Habit));
        setState((prev) => ({ ...prev, habits: [...prev.habits, ...newHabits] }));
        if (userId !== "local" && newHabits.length > 0) {
          void syncSupabase(_supabase.from("habits").insert(newHabits), "guardar hábitos");
        }
      },

      deleteHabit: (id) => {
        setState((prev) => ({
          ...prev,
          habits: prev.habits.filter((h) => h.id !== id),
          habitCompletions: prev.habitCompletions.filter((c) => c.habit_id !== id),
        }));
        syncSupabase(_supabase.from("habits").delete().eq("id", id));
      },

      toggleHabit: (habitId) => {
        setState((prev) => {
          const today = todayKey();
          const userId = uid();
          const existing = prev.habitCompletions.find(
            (c) => c.habit_id === habitId && c.completed_on === today,
          );
          if (existing) {
            syncSupabase(_supabase.from("habit_completions").delete().eq("id", existing.id));
            return {
              ...prev,
              habitCompletions: prev.habitCompletions.filter((c) => c.id !== existing.id),
            };
          } else {
            const completion: HabitCompletion = {
              id: newId(), habit_id: habitId, user_id: userId, completed_on: today,
            };
            if (userId !== "local") {
              syncSupabase(_supabase.from("habit_completions").insert({ id: completion.id, habit_id: habitId, user_id: userId, completed_on: today }));
            }
            return {
              ...prev,
              habitCompletions: [...prev.habitCompletions, completion],
            };
          }
        });
      },

      addTransaction: (input) => {
        const iso = nowIso();
        const id = newId();
        const userId = uid();
        const date = input.date ?? todayKey();
        setState((prev) => ({
          ...prev,
          transactions: [
            ...prev.transactions,
            { id, user_id: userId, type: input.type, amount: Number(input.amount), category: input.category.trim(), description: input.description ?? null, date, created_at: iso } as Transaction,
          ],
        }));
        if (userId !== "local") {
          syncSupabase(_supabase.from("transactions").insert({ id, user_id: userId, type: input.type, amount: Number(input.amount), category: input.category.trim(), description: input.description ?? null, date, created_at: iso }));
        }
      },

      addTransactions: (inputs) => {
        const iso = nowIso();
        const userId = uid();
        const newTransactions = inputs.map((input) => ({ id: newId(), user_id: userId, type: input.type, amount: Number(input.amount), category: input.category.trim(), description: input.description ?? null, date: input.date ?? todayKey(), created_at: iso } as Transaction));
        setState((prev) => ({ ...prev, transactions: [...prev.transactions, ...newTransactions] }));
        if (userId !== "local" && newTransactions.length > 0) {
          void syncSupabase(_supabase.from("transactions").insert(newTransactions), "guardar transacciones");
        }
      },

      deleteTransaction: (id) => {
        setState((prev) => ({ ...prev, transactions: prev.transactions.filter((t) => t.id !== id) }));
        syncSupabase(_supabase.from("transactions").delete().eq("id", id));
      },

      setBudget: (amount) => {
        const userId = uid();
        setState((prev) => ({ ...prev, budget: amount }));
        if (userId !== "local") {
          void syncSupabase(
            amount == null
              ? _supabase.from("budgets").delete().eq("user_id", userId).eq("month", `${todayKey().slice(0, 7)}-01`)
              : _supabase.from("budgets").upsert({ user_id: userId, month: `${todayKey().slice(0, 7)}-01`, amount }, { onConflict: "user_id,month" }),
            "guardar presupuesto",
          );
        }
      },

      addGrade: (input) => {
        const iso = nowIso();
        const userId = uid();
        let createdSubject: Subject | null = null;
        let createdGrade: Grade | null = null;
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
              const id = newId();
              const colorIndex = (prev.subjects.length + newSubjects.length) % DEFAULT_COLORS.length;
              const createdSub: Subject = {
                id, user_id: userId, name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                classroom_course_id: null, classroom_name: null, created_at: iso,
              };
              newSubjects.push(createdSub);
              resolvedSubjectId = createdSub.id;
            }
          }

          if (!resolvedSubjectId && prev.subjects.length > 0) {
            resolvedSubjectId = prev.subjects[0].id;
          }

          if (!resolvedSubjectId) {
            const id = newId();
            const createdSub: Subject = {
              id, user_id: userId, name: "General",
              color: DEFAULT_COLORS[0],
              classroom_course_id: null, classroom_name: null, created_at: iso,
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
            id: newId(), user_id: userId,
            subject_id: resolvedSubjectId,
            task_id: resolvedTaskId,
            title: input.title.trim(),
            score: Number(input.score),
            max_score: input.max_score ? Number(input.max_score) : 10,
            weight_percentage: input.weight_percentage != null ? Number(input.weight_percentage) : null,
            date: input.date ?? todayKey(),
            notes: input.notes ?? null,
            created_at: iso, updated_at: iso,
          };

          createdSubject = newSubjects[0] ?? null;
          createdGrade = newGrade;
          return {
            ...prev,
            subjects: [...prev.subjects, ...newSubjects],
            tasks: updatedTasks,
            grades: [...prev.grades, newGrade],
          };
        });
        if (userId !== "local") {
          const subjectToSave = createdSubject as Subject | null;
          const gradeToSave = createdGrade as unknown as Grade;
          void (async () => {
            if (subjectToSave) {
              const subjectResult = await syncSupabase(
                _supabase.from("subjects").insert({ id: subjectToSave.id, user_id: userId, name: subjectToSave.name, color: subjectToSave.color, created_at: subjectToSave.created_at }),
                "guardar asignatura de calificación",
              );
              if (!subjectResult) return;
            }
            await syncSupabase(_supabase.from("grades").insert(gradeToSave), "guardar calificación");
          })();
        }
      },

      addGrades: (inputs) => {
        const iso = nowIso();
        const userId = uid();
        let createdSubjects: Subject[] = [];
        let createdGrades: Grade[] = [];
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
              const id = newId();
              const createdSub: Subject = {
                id, user_id: userId, name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                classroom_course_id: null, classroom_name: null, created_at: iso,
              };
              allSubjects.push(createdSub);
              newSubjects.push(createdSub);
              return createdSub.id;
            }
            if (allSubjects.length > 0) return allSubjects[0].id;

            const id = newId();
            const createdSub: Subject = {
              id, user_id: userId, name: "General",
              color: DEFAULT_COLORS[0],
              classroom_course_id: null, classroom_name: null, created_at: iso,
            };
            allSubjects.push(createdSub);
            newSubjects.push(createdSub);
            return createdSub.id;
          };

          const newGrades: Grade[] = [];

          inputs.forEach((input) => {
            const resolvedSubjectId = getOrAddSubjectId(input.subject_id, input.subject_name);

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
              id: newId(), user_id: userId,
              subject_id: resolvedSubjectId,
              task_id: resolvedTaskId,
              title: input.title.trim(),
              score: Number(input.score),
              max_score: input.max_score ? Number(input.max_score) : 10,
              weight_percentage: input.weight_percentage != null ? Number(input.weight_percentage) : null,
              date: input.date ?? todayKey(),
              notes: input.notes ?? null,
              created_at: iso, updated_at: iso,
            } as Grade);
          });

          createdSubjects = newSubjects;
          createdGrades = newGrades;
          return {
            ...prev,
            subjects: [...prev.subjects, ...newSubjects],
            tasks: updatedTasks,
            grades: [...prev.grades, ...newGrades],
          };
        });
        if (userId !== "local" && createdGrades.length > 0) {
          void (async () => {
            if (createdSubjects.length > 0) {
              const subjectResult = await syncSupabase(
                _supabase.from("subjects").insert(createdSubjects.map(({ id, name, color, classroom_course_id, classroom_name, created_at }) => ({ id, user_id: userId, name, color, classroom_course_id, classroom_name, created_at }))),
                "guardar asignaturas",
              );
              if (!subjectResult) return;
            }
            await syncSupabase(_supabase.from("grades").insert(createdGrades), "guardar calificaciones");
          })();
        }
      },

      updateGrade: (id, input) => {
        setState((prev) => ({
          ...prev,
          grades: prev.grades.map((g) =>
            g.id === id
              ? {
                  ...g,
                  ...(input.title !== undefined ? { title: input.title.trim() } : {}),
                  ...(input.score !== undefined ? { score: Number(input.score) } : {}),
                  ...(input.max_score !== undefined ? { max_score: Number(input.max_score) } : {}),
                  ...(input.weight_percentage !== undefined
                    ? { weight_percentage: input.weight_percentage != null ? Number(input.weight_percentage) : null }
                    : {}),
                  ...(input.date !== undefined ? { date: input.date } : {}),
                  ...(input.notes !== undefined ? { notes: input.notes } : {}),
                  ...(input.subject_id !== undefined ? { subject_id: input.subject_id! } : {}),
                  updated_at: nowIso(),
                }
              : g,
          ),
        }));
        // Try sync to Supabase grades table if it exists
        syncSupabase(_supabase.from("grades").update({ ...input, updated_at: new Date().toISOString() }).eq("id", id));
      },

      deleteGrade: (id) => {
        setState((prev) => ({ ...prev, grades: prev.grades.filter((g) => g.id !== id) }));
        syncSupabase(_supabase.from("grades").delete().eq("id", id));
      },

      deleteGrades: (ids, titles) => {
        setState((prev) => {
          const idSet = new Set(ids || []);
          const titleSet = new Set((titles || []).map((t) => t.trim().toLowerCase()));
          return {
            ...prev,
            grades: prev.grades.filter(
              (g) => !idSet.has(g.id) && !titleSet.has(g.title.trim().toLowerCase()),
            ),
          };
        });
      },
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