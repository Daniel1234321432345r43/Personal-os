"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  STATE_FIELD_OF_TABLE,
  SYNC_TABLES,
  TABLE_KEY_COLUMN,
  addTombstone,
  removeTombstone,
  filterTombstonedRows,
  mergePendingDeletes,
  normalizeDeletes,
  parsePendingDeletes,
  parseTombstoneRows,
  pickNewer,
  rowKey,
  serializePendingDeletes,
  tombstoneRows,
  withoutTombstonedRows,
  type DeleteInput,
  type SyncTable,
  type TombstoneEntry,
  type TombstoneMap,
} from "@/lib/sync-tombstones";
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
  PlannedExpense,
  SleepLog,
  SleepSettings,
} from "@/lib/types";
import { computeFinance, type DashboardData } from "@/lib/data";
import { todayKey } from "@/lib/format";
import { findSubjectByExactName, findSubjectByName, namesMatch } from "@/lib/subjects";
import { DEFAULT_SLEEP_SETTINGS, roundHours } from "@/lib/sleep";
import { awardXp, evaluateSleepXp } from "@/lib/xp-system";

const STORAGE_KEY = "nucleo:data:v1";
const STORAGE_VERSION = 1;
const USER_STORAGE_PREFIX = `${STORAGE_KEY}:user:`;
const PENDING_DELETES_PREFIX = `${STORAGE_KEY}:pending-deletes:`;
/** Clave de la versión anterior (solo ids de tareas); se migra al arrancar. */
const LEGACY_DELETED_TASKS_PREFIX = `${STORAGE_KEY}:deleted-tasks:`;

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
  plannedExpenses: PlannedExpense[];
  sleepLogs: SleepLog[];
  sleepSettings: SleepSettings | null;
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
export type PlannedExpenseInput = {
  amount: number | string;
  category: string;
  description?: string | null;
  date?: string | null;
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
export type SleepLogInput = {
  /** Día del despertar (YYYY-MM-DD). Por defecto, hoy. */
  date?: string;
  hours: number;
  bedtime?: string | null;
  wake_time?: string | null;
  quality?: number | null;
  notes?: string | null;
};
export type SleepSettingsInput = {
  target_hours: number;
  bedtime: string;
  wake_time: string;
  reminder_enabled?: boolean;
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
  addPlannedExpense: (input: PlannedExpenseInput) => void;
  addPlannedExpenses: (inputs: PlannedExpenseInput[]) => void;
  deletePlannedExpense: (id: string) => void;
  convertPlannedExpenseToTransaction: (id: string, date?: string) => void;
  addGrade: (input: GradeInput) => void;
  addGrades: (inputs: GradeInput[]) => void;
  updateGrade: (id: string, input: Partial<GradeInput>) => void;
  deleteGrade: (id: string) => void;
  deleteGrades: (ids?: string[], titles?: string[]) => void;
  /** Actualiza la autoevaluación (1-10) de una asignatura. */
  setSubjectRating: (subjectId: string, rating: number | null) => void;
  /**
   * Crea o actualiza el registro de sueño de una noche. Si ya existe el de esa
   * fecha, se actualiza (nunca se duplica). Una misma noche solo puntúa una vez.
   */
  saveSleepLog: (input: SleepLogInput) => void;
  deleteSleepLog: (date: string) => void;
  /** Objetivo de sueño (horas, hora de dormir/despertar y aviso). */
  setSleepSettings: (input: SleepSettingsInput) => void;
  /** Restablece de fábrica: borra todos los datos del usuario (local + nube). Conserva la config de IA/API key. */
  resetAll: () => Promise<{ ok: boolean; error?: string }>;
}


interface DataContextValue {
  data: DashboardData;
  hydrated: boolean;
  actions: DataActions;
  /**
   * Aviso de la última sincronización fallida con la nube. Antes un borrado
   * rechazado solo aparecía en la consola y el dato "resucitaba" al recargar:
   * ahora la app lo dice en pantalla.
   */
  syncError: string | null;
  clearSyncError: () => void;
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
    plannedExpenses: [],
    sleepLogs: [],
    sleepSettings: null,
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
    return {
      ...emptyState(),
      ...parsed.data,
      grades: parsed.data.grades || [],
      plannedExpenses: parsed.data.plannedExpenses || [],
      sleepLogs: parsed.data.sleepLogs || [],
      sleepSettings: parsed.data.sleepSettings || null,
    };
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

/**
 * Cola de borrados pendientes de confirmar en la nube, por usuario.
 *
 * Si el borrado remoto falla (sin conexión, sesión caducada…) la fila sigue en
 * Supabase. Estos borrados se reintentan al arrancar y al recuperar el foco, y
 * mientras tanto las lápidas en memoria impiden que la fila vuelva a entrar.
 */
function pendingDeletesKey(userId: string | null): string {
  return `${PENDING_DELETES_PREFIX}${userId ?? "local"}`;
}

function loadPendingDeletes(userId: string | null): TombstoneEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const entries = parsePendingDeletes(window.localStorage.getItem(pendingDeletesKey(userId)));
    // Migración: antes solo se anotaban ids de tareas, en otra clave.
    const legacyKey = `${LEGACY_DELETED_TASKS_PREFIX}${userId ?? "local"}`;
    const legacyRaw = window.localStorage.getItem(legacyKey);
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw);
        if (Array.isArray(legacy)) {
          for (const id of legacy) {
            if (typeof id === "string" && id) entries.push({ table: "tasks", key: id, deletedAt: Date.now() });
          }
        }
      } catch {
        // Datos antiguos corruptos: se descartan.
      }
      window.localStorage.removeItem(legacyKey);
    }
    return mergePendingDeletes(entries, []);
  } catch {
    return [];
  }
}

function savePendingDeletes(userId: string | null, entries: readonly TombstoneEntry[]) {
  if (typeof window === "undefined") return;
  try {
    if (entries.length === 0) window.localStorage.removeItem(pendingDeletesKey(userId));
    else window.localStorage.setItem(pendingDeletesKey(userId), serializePendingDeletes(entries));
  } catch {
    // Ignorar errores de cuota o serialización.
  }
}

/**
 * Mapa de lápidas (tabla::clave → instante del borrado) a partir de los
 * borrados conocidos, ya estén confirmados en la nube o pendientes.
 */
function tombstoneMapFrom(entries: readonly TombstoneEntry[]): TombstoneMap {
  const map: TombstoneMap = new Map();
  for (const entry of entries) addTombstone(map, entry.table, entry.key, entry.deletedAt);
  return map;
}

/** Cuántas claves se borran por petición (evita URLs gigantes en el borrado masivo). */
const DELETE_CHUNK_SIZE = 80;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Fusiona los datos remotos de Supabase con los locales.
 *
 * En un mismo id gana la versión modificada más recientemente (`updated_at`),
 * no siempre la remota: si no, un dispositivo con la copia antigua deshacía la
 * edición hecha en el otro. Solo se comparan filas con marca temporal; en el
 * resto (hábitos, entrenamientos…) sigue ganando la nube, como antes. Las filas
 * con lápida se quitan después, en `withoutTombstonedRows`.
 */
function mergeRemote(local: DataState, remote: DataState): DataState {
  const merge = <T extends { id: string }>(l: T[], r: T[]): T[] => {
    const map = new Map<string, T>();
    for (const item of l) map.set(item.id, item);
    for (const item of r) {
      const localItem = map.get(item.id);
      map.set(item.id, localItem ? pickNewer(localItem, item) : item);
    }
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
    plannedExpenses: merge(local.plannedExpenses, remote.plannedExpenses),
    // Los registros de sueño se identifican por FECHA, no por id: la misma noche
    // puede llegar con un id distinto desde Supabase (la fila la genera la BD,
    // que solo garantiza unicidad por usuario + fecha), así que se fusionan por
    // fecha para no acabar con dos filas de la misma noche.
    sleepLogs: mergeSleepLogs(local.sleepLogs, remote.sleepLogs),
    sleepSettings: remote.sleepSettings ?? local.sleepSettings,
  };
}

/** Fusiona noches por fecha (gana la modificada más recientemente, como el resto). */
function mergeSleepLogs(local: SleepLog[], remote: SleepLog[]): SleepLog[] {
  const byDate = new Map<string, SleepLog>();
  for (const log of local) byDate.set(log.date, log);
  for (const log of remote) {
    const localLog = byDate.get(log.date);
    byDate.set(log.date, localLog ? pickNewer(localLog, log) : log);
  }
  return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
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
        notifySyncError(label);
        return false;
      }
      console.info(`[Supabase diagnóstico] petición correcta: ${label}`);
      return true;
    },
    (error: unknown) => {
      console.error(`[Supabase] ${label}:`, error);
      notifySyncError(label);
      return false;
    },
  );
}

/**
 * Canal de avisos de sincronización. Las acciones no pueden bloquear la UI,
 * así que el provider registra aquí su setter y `syncSupabase` lo alimenta.
 */
let reportSyncError: ((message: string) => void) | null = null;

function notifySyncError(label: string) {
  reportSyncError?.(
    `No se han podido sincronizar los últimos cambios (${label}). ` +
      "Revisa tu conexión: siguen guardados en este dispositivo y se reintentará.",
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
    plannedExpenses: filter(state.plannedExpenses),
    sleepLogs: filter(state.sleepLogs),
    sleepSettings: state.sleepSettings,
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
    state.plannedExpenses,
    state.sleepLogs,
  ].some((items) => items.length > 0) || state.sleepSettings != null;
}

/** Sube datos locales en el orden correcto para respetar las claves foráneas. */
async function syncStateToSupabase(
  state: DataState,
  userId: string,
  tombstones: TombstoneMap,
): Promise<boolean> {
  // Las filas con lápida no se suben NUNCA: es lo que impide que un dispositivo
  // que conserva copias antiguas resucite lo que se ha borrado en otro.
  const keep = <T extends Record<string, unknown>>(table: SyncTable, rows: T[]): T[] =>
    filterTombstonedRows(table, rows, tombstones);

  const operations: Array<[string, unknown]> = [
    ["subjects", keep("subjects", state.subjects.map(({ id, name, color, self_rating, classroom_course_id, classroom_name, created_at }) => ({ id, user_id: userId, name, color, self_rating, classroom_course_id, classroom_name, created_at })))],
    ["habits", keep("habits", state.habits.map(({ id, name, emoji, frequency, created_at }) => ({ id, user_id: userId, name, emoji, frequency, created_at })))],
    ["tasks", keep("tasks", state.tasks.map(({ id, title, description, status, priority, type, category, due_date, start_time, remind_before_minutes, estimated_minutes, subject_id, classroom_id, session_index, total_sessions, parent_task_id, created_at, updated_at }) => ({ id, user_id: userId, title, description, status, priority, type, category, due_date, start_time: start_time ?? null, remind_before_minutes: remind_before_minutes ?? null, estimated_minutes, subject_id, classroom_id, session_index: session_index ?? null, total_sessions: total_sessions ?? null, parent_task_id: parent_task_id ?? null, created_at, updated_at })))],
    ["notes", keep("notes", state.notes.map(({ id, title, content, file_name, file_type, file_data, created_at, updated_at }) => ({ id, user_id: userId, title, content, file_name, file_type, file_data, created_at, updated_at })))],
    ["workouts", keep("workouts", state.workouts.map(({ id, activity_type, title, date, start_time, duration_minutes, notes, created_at }) => ({ id, user_id: userId, activity_type, title, date, start_time: start_time ?? null, duration_minutes, notes, created_at })))],
    ["transactions", keep("transactions", state.transactions.map(({ id, type, amount, category, description, date, created_at }) => ({ id, user_id: userId, type, amount, category, description, date, created_at })))],
    ["habit_completions", keep("habit_completions", state.habitCompletions.map(({ id, habit_id, completed_on }) => ({ id, user_id: userId, habit_id, completed_on })))],
    ["grades", keep("grades", state.grades.map(({ id, subject_id, task_id, title, score, max_score, weight_percentage, date, notes, created_at, updated_at }) => ({ id, user_id: userId, subject_id, task_id, title, score, max_score, weight_percentage, date, notes, created_at, updated_at })))],
    ["budgets", state.budget == null ? [] : [{ user_id: userId, month: `${todayKey().slice(0, 7)}-01`, amount: state.budget }]],
    ["planned_expenses", keep("planned_expenses", state.plannedExpenses.map(({ id, amount, category, description, date, is_completed, created_at }) => ({ id, user_id: userId, amount: Number(amount), category, description: description ?? null, date: date ?? null, is_completed: Boolean(is_completed), created_at })))],
    // El id NO se envía: la fila se identifica por (user_id, date) y así el
    // upsert no reescribe la clave primaria de la fila que ya existía.
    // `updated_at` sí viaja (la fila tiene esa columna): así la fusión sabe cuál
    // de las dos copias de la noche es la más reciente.
    ["sleep_logs", keep("sleep_logs", state.sleepLogs.map(({ date, bedtime, wake_time, hours, quality, notes, updated_at }) => ({ user_id: userId, date, bedtime: bedtime ?? null, wake_time: wake_time ?? null, hours: Number(hours), quality: quality ?? null, notes: notes ?? null, updated_at: updated_at ?? null })))],
    ["sleep_settings", state.sleepSettings
      ? [{
          user_id: userId,
          target_hours: Number(state.sleepSettings.target_hours),
          bedtime: state.sleepSettings.bedtime,
          wake_time: state.sleepSettings.wake_time,
          reminder_enabled: Boolean(state.sleepSettings.reminder_enabled),
        }]
      : []],
  ];

  const ON_CONFLICT: Record<string, string> = {
    budgets: "user_id,month",
    sleep_logs: "user_id,date",
    sleep_settings: "user_id",
  };

  let allSucceeded = true;
  for (const [table, rows] of operations) {
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const onConflict = ON_CONFLICT[table] ?? "id";
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
  // Ref al estado más reciente, para leer el estado actual de forma síncrona
  // dentro de las acciones (que se crean una sola vez con useMemo). Se
  // actualiza en un effect tras cada commit.
  const stateRef = useRef<DataState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const [hydrated, setHydrated] = useState(false);
  /** Último error de sincronización con la nube, para avisar en pantalla. */
  const [syncError, setSyncError] = useState<string | null>(null);
  /**
   * La primera sincronización con la nube ya terminó. Es estado (no ref) a
   * propósito: al pasar a true, el efecto de re-sincronización se ejecuta una
   * vez con el estado VIVO, así lo que se creó durante la carga también sube.
   */
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const syncedRef = useRef(false);
  /**
   * Lápidas conocidas (`tabla::clave` → instante del borrado). Salen de la
   * tabla `deleted_records` más los borrados locales sin confirmar, y son lo
   * que impide que una fila borrada en otro dispositivo vuelva a entrar.
   */
  const tombstonesRef = useRef<TombstoneMap>(new Map());
  /** Borrados locales pendientes de confirmar en la nube (cola de reintento). */
  const pendingDeletesRef = useRef<TombstoneEntry[]>([]);
  /** Canal de Realtime con los borrados que hacen los demás dispositivos. */
  const deleteChannelRef = useRef<{ unsubscribe: () => void } | null>(null);
  /** El aviso de "falta la migración de borrados" solo se muestra una vez. */
  const schemaHintShownRef = useRef(false);
  const syncErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Registro del canal de errores de sincronización (ver syncSupabase).
  useEffect(() => {
    reportSyncError = (message) => {
      setSyncError(message);
      if (syncErrorTimerRef.current) clearTimeout(syncErrorTimerRef.current);
      syncErrorTimerRef.current = setTimeout(() => setSyncError(null), 12_000);
    };
    return () => {
      reportSyncError = null;
      if (syncErrorTimerRef.current) clearTimeout(syncErrorTimerRef.current);
    };
  }, []);

  const clearSyncError = useCallback(() => setSyncError(null), []);

  /**
   * Sube los borrados pendientes y borra las filas de verdad.
   *
   * El orden importa: primero la lápida en `deleted_records`. Si se borrara la
   * fila sin dejar lápida y el otro dispositivo la tuviese en caché, la
   * resucitaría al subir su estado. Si algo falla, el borrado se queda en la
   * cola y se reintenta al arrancar o al volver a la app.
   */
  const flushPendingDeletes = useCallback(async (userId: string): Promise<boolean> => {
    const entries = pendingDeletesRef.current;
    if (entries.length === 0) return true;

    const marked = await syncSupabase(
      _supabase.from("deleted_records").upsert(tombstoneRows(entries, userId), {
        onConflict: "user_id,table_name,record_key",
      }),
      "registrar borrados",
    );
    // La fila se borra aunque la lápida falle. Así el borrado sigue siendo
    // efectivo en este dispositivo (su lápida local lo protege) y la cola se
    // reintenta hasta que la lápida llegue a la nube; sin la migración 00017
    // aplicada, el aviso en pantalla lo explica.
    const remaining: TombstoneEntry[] = marked ? [] : [...entries];
    for (const table of SYNC_TABLES) {
      const group = entries.filter((entry) => entry.table === table);
      if (group.length === 0) continue;
      for (const part of chunk(group, DELETE_CHUNK_SIZE)) {
        const removed = await syncSupabase(
          _supabase
            .from(table)
            .delete()
            .in(
              TABLE_KEY_COLUMN[table],
              part.map((entry) => entry.key),
            ),
          `borrar ${table}`,
        );
        if (!removed) remaining.push(...part);
      }
    }
    // Lo que queda pendiente son los borrados que fallaron MÁS los que se hayan
    // marcado mientras esta tanda iba en camino: esos nunca se descartan, porque
    // la cola es lo que reintenta el borrado.
    const processed = new Set(entries.map((entry) => `${entry.table}::${entry.key}`));
    const stillPending = pendingDeletesRef.current.filter(
      (entry) => !processed.has(`${entry.table}::${entry.key}`),
    );
    pendingDeletesRef.current = mergePendingDeletes(remaining, stillPending);
    savePendingDeletes(userId, pendingDeletesRef.current);
    return pendingDeletesRef.current.length === 0;
  }, []);

  /**
   * Marca filas como borradas: lápida en memoria (la hidratación y el envío a
   * la nube las ignoran desde ya), cola persistida y borrado compartido.
   */
  const markDeleted = useCallback(
    (inputs: DeleteInput[]) => {
      const entries = normalizeDeletes(inputs);
      if (entries.length === 0) return;
      for (const entry of entries) {
        addTombstone(tombstonesRef.current, entry.table, entry.key, entry.deletedAt);
      }
      pendingDeletesRef.current = mergePendingDeletes(pendingDeletesRef.current, entries);
      const userId = userIdRef.current;
      if (!userId) return; // invitado: solo localStorage
      savePendingDeletes(userId, pendingDeletesRef.current);
      void flushPendingDeletes(userId);
    },
    [flushPendingDeletes],
  );

  /**
   * Reabre una noche de sueño que se había borrado.
   *
   * `sleep_logs` es la única tabla que se identifica por una clave reutilizable
   * (la fecha): si se borra la noche del 18 y luego se registra otra vez, hay que
   * quitar su lápida (aquí y en la nube) o el filtro la descartaría para siempre
   * y los demás dispositivos seguirían viéndola borrada.
   */
  const reopenSleepLog = useCallback((date: string) => {
    const userId = userIdRef.current;
    const wasDeleted = removeTombstone(tombstonesRef.current, "sleep_logs", date);
    if (userId) {
      pendingDeletesRef.current = pendingDeletesRef.current.filter(
        (entry) => !(entry.table === "sleep_logs" && entry.key === date),
      );
      if (wasDeleted) savePendingDeletes(userId, pendingDeletesRef.current);
    }
    if (!wasDeleted || !userId) return;
    void syncSupabase(
      _supabase
        .from("deleted_records")
        .delete()
        .eq("user_id", userId)
        .eq("table_name", "sleep_logs")
        .eq("record_key", date),
      "reabrir noche de sueño",
    );
  }, []);

  /**
   * Relee las lápidas de la nube y quita del estado lo que ya está borrado.
   * Se llama al arrancar y cada vez que la app vuelve a primer plano: cubre el
   * caso de dos dispositivos abiertos a la vez, en el que el otro ha borrado
   * algo que este todavía no sabía (y podía volver a subir).
   */
  const refreshTombstones = useCallback(async (userId: string): Promise<void> => {
    const { data, error } = await _supabase
      .from("deleted_records")
      .select("table_name, record_key, deleted_at")
      .eq("user_id", userId);
    if (error) {
      console.error(`[Supabase] cargar borrados: ${error.message}`);
      if (!schemaHintShownRef.current) {
        schemaHintShownRef.current = true;
        reportSyncError?.(
          "Falta la tabla de borrados en Supabase: aplica la migración " +
            "00017_deleted_records.sql para que los borrados se sincronicen entre dispositivos.",
        );
      }
      return;
    }
    const map: TombstoneMap = new Map(tombstonesRef.current);
    for (const entry of parseTombstoneRows(data)) {
      addTombstone(map, entry.table, entry.key, entry.deletedAt);
    }
    tombstonesRef.current = map;
    // Si no se quita nada, `withoutTombstonedRows` devuelve el mismo objeto: no
    // hay render nuevo ni envío a la nube innecesario.
    setState((prev) => withoutTombstonedRows(prev, map));
  }, []);

  /** Avisos en vivo: un borrado en otro dispositivo desaparece aquí al momento. */
  const subscribeToDeletes = useCallback((userId: string) => {
    try {
      void deleteChannelRef.current?.unsubscribe();
      deleteChannelRef.current = _supabase
        .channel(`deleted-records:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "deleted_records",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const entries = parseTombstoneRows([payload.new]);
            if (entries.length === 0) return;
            for (const entry of entries) {
              addTombstone(tombstonesRef.current, entry.table, entry.key, entry.deletedAt);
            }
            setState((prev) => withoutTombstonedRows(prev, tombstonesRef.current));
          },
        )
        .subscribe();
    } catch (error) {
      console.warn("[Supabase] no se pudo escuchar los borrados en vivo:", error);
    }
  }, []);

  // Cargar desde localStorage una sola vez al montar (evita mismatch de hidratación).
  useEffect(() => {
    // La lectura depende de window y debe ejecutarse después de hidratar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    // Los borrados del invitado también se leen aquí (sin nube, solo local).
    pendingDeletesRef.current = loadPendingDeletes(null);
    tombstonesRef.current = tombstoneMapFrom(pendingDeletesRef.current);
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
      pendingDeletesRef.current = loadPendingDeletes(userId);
      tombstonesRef.current = tombstoneMapFrom(pendingDeletesRef.current);
      setInitialSyncDone(false);
      // Lo primero de todo: saber qué se ha borrado en otros dispositivos
      // (antes se fusionaba a ciegas y los borrados volvían) y reintentar los
      // borrados que este dispositivo no pudo confirmar.
      await refreshTombstones(userId);
      subscribeToDeletes(userId);
      if (pendingDeletesRef.current.length > 0) void flushPendingDeletes(userId);

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
        const pendingSynced =
          !hasRecords(pending) ||
          await syncStateToSupabase(pending, userId, tombstonesRef.current);

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
          _supabase.from("planned_expenses").select("*").eq("user_id", userId),
          _supabase.from("sleep_logs").select("*").eq("user_id", userId),
          _supabase.from("sleep_settings").select("*").eq("user_id", userId).maybeSingle(),
        ]);

        const labels = ["subjects", "tasks", "notes", "workouts", "habits", "habit_completions", "transactions", "grades", "budgets", "planned_expenses", "sleep_logs", "sleep_settings"];
        results.forEach((result, index) => {
          if (result.error) {
            console.error(`[Supabase] cargar ${labels[index]}: ${result.error.message}`);
          }
        });

        const [subjects, tasks, notes, workouts, habits, habitCompletions, transactions, grades, budgetRow, plannedExpensesRows, sleepLogRows, sleepSettingsRow] = results.map(
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
          plannedExpenses: (plannedExpensesRows as Record<string, unknown>[]).map((p) => ({
            ...p,
            amount: Number(p.amount),
            date: normDate(p.date),
            is_completed: Boolean(p.is_completed),
          } as unknown as PlannedExpense)),
          sleepLogs: (sleepLogRows as Record<string, unknown>[]).map((s) => ({
            ...s,
            date: normDate(s.date) ?? "",
            bedtime: typeof s.bedtime === "string" && s.bedtime.length >= 5 ? s.bedtime.slice(0, 5) : null,
            wake_time: typeof s.wake_time === "string" && s.wake_time.length >= 5 ? s.wake_time.slice(0, 5) : null,
            hours: Number(s.hours),
            quality: s.quality == null ? null : Number(s.quality),
          } as unknown as SleepLog)),
          sleepSettings: sleepSettingsRow && !Array.isArray(sleepSettingsRow)
            ? {
                target_hours: Number((sleepSettingsRow as { target_hours: number }).target_hours),
                bedtime: String((sleepSettingsRow as { bedtime: string }).bedtime).slice(0, 5),
                wake_time: String((sleepSettingsRow as { wake_time: string }).wake_time).slice(0, 5),
                reminder_enabled: Boolean((sleepSettingsRow as { reminder_enabled: boolean }).reminder_enabled),
                updated_at: (sleepSettingsRow as { updated_at?: string }).updated_at,
              }
            : null,
        };

        const nextState = mergeRemote(savedUserState, mergeRemote(pending, remote));

        // Fusión NO destructiva: la nube entra, pero el estado vivo gana en
        // conflicto y conserva lo que aún no ha llegado a la nube. Antes se
        // hacía `setState(nextState)` con una foto tomada ANTES de las
        // consultas, así que lo que el usuario (o el Secretario IA) creaba
        // mientras la app cargaba desaparecía… y al volver desde Supabase
        // parecía una tarea fantasma; un borrado hecho en esa ventana
        // resucitaba igual. El estado resultante lo persiste el efecto de
        // guardado, que escribe en la clave del usuario ya autenticado.
        setState((prev) =>
          withoutTombstonedRows(mergeRemote(nextState, prev), tombstonesRef.current),
        );
        if (pendingSynced && hasRecords(pending)) window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        // Fin de la carga inicial: al pasar a true, el efecto de
        // re-sincronización sube el estado final (incluido lo creado durante
        // la ventana de hidratación, que ese efecto se saltó).
        setInitialSyncDone(true);
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
        tombstonesRef.current = new Map();
        pendingDeletesRef.current = [];
        void deleteChannelRef.current?.unsubscribe();
        deleteChannelRef.current = null;
        setState(localOnly(loadState()));
        return;
      }
      if (session?.user) void syncUser(session.user.id);
    });
    return () => {
      subscription.subscription.unsubscribe();
      void deleteChannelRef.current?.unsubscribe();
      deleteChannelRef.current = null;
    };
  }, [hydrated, refreshTombstones, flushPendingDeletes, subscribeToDeletes]);

  // Guardar cada sesión en su propia clave. La clave global solo representa
  // el modo invitado y no debe mezclar datos entre cuentas del mismo navegador.
  useEffect(() => {
    if (!hydrated) return;
    saveState(state, userIdRef.current ? userStorageKey(userIdRef.current) : STORAGE_KEY);
  }, [state, hydrated]);

  // Reintentar la sincronización con el estado ya calculado. Esto cubre las
  // acciones masivas y evita depender de valores asignados dentro de setState.
  useEffect(() => {
    if (!hydrated || !userIdRef.current || !initialSyncDone) return;
    void syncStateToSupabase(state, userIdRef.current, tombstonesRef.current);
  }, [state, hydrated, initialSyncDone]);

  // Al volver a la app (cambiar de pestaña, desbloquear el móvil) se releen las
  // lápidas: si otro dispositivo ha borrado algo mientras tanto, se quita aquí
  // antes de que este dispositivo pueda volver a subirlo.
  useEffect(() => {
    if (!hydrated) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const userId = userIdRef.current;
      if (!userId) return;
      void refreshTombstones(userId);
      if (pendingDeletesRef.current.length > 0) void flushPendingDeletes(userId);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [hydrated, refreshTombstones, flushPendingDeletes]);

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

    /** Resuelve ids reales a partir de ids o títulos de calificaciones. */
    const resolveGradeIds = (ids?: string[], titles?: string[]): string[] => {
      const resolved = new Set<string>((ids || []).filter(Boolean));
      const titleSet = new Set(
        (titles || []).map((t) => t.trim().toLowerCase()).filter(Boolean),
      );
      if (titleSet.size > 0) {
        for (const grade of stateRef.current.grades) {
          if (titleSet.has(grade.title.trim().toLowerCase())) resolved.add(grade.id);
        }
      }
      return [...resolved];
    };

    /** Resuelve ids reales a partir de títulos (exactos o con coincidencia clara). */
    const resolveTaskIdsByTitles = (titles: string[]): string[] => {
      const queries = titles.map((t) => t.trim()).filter(Boolean);
      if (queries.length === 0) return [];
      return stateRef.current.tasks
        .filter((task) => queries.some((q) => namesMatch(q, task.title)))
        .map((task) => task.id);
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
              { id, user_id: userId, name: input.name.trim(), color, self_rating: null, classroom_course_id: null, classroom_name: null, created_at: iso } as Subject,
            ],
          };
        });
        if (userId !== "local") {
          void syncSupabase(_supabase.from("subjects").insert({ id, user_id: userId, name: input.name.trim(), color, self_rating: null, created_at: iso }), "guardar asignatura");
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
            // Una asignatura ya existente con diminutivo ("mates" →
            // "Matemáticas") no se vuelve a crear. Se exige coincidencia
            // estricta: crear "Historia" existiendo "Historia del Arte" es
            // legítimo.
            const exists = findSubjectByExactName(
              trimmed,
              prev.subjects.concat(newSubjects),
            );
            if (!exists) {
              const colorIndex = (prev.subjects.length + newSubjects.length) % DEFAULT_COLORS.length;
              const id = newId();
              newSubjects.push({
                id, user_id: userId, name: trimmed,
                color: input.color || DEFAULT_COLORS[colorIndex],
                self_rating: null, classroom_course_id: null, classroom_name: null, created_at: iso,
              } as Subject);
            }
          });
          if (newSubjects.length === 0) return prev;
          createdSubjects = newSubjects;
          return { ...prev, subjects: [...prev.subjects, ...newSubjects] };
        });
        if (userId !== "local" && createdSubjects.length > 0) {
          void syncSupabase(
            _supabase.from("subjects").insert(createdSubjects.map(({ id, name, color, self_rating, classroom_course_id, classroom_name, created_at }) => ({ id, user_id: userId, name, color, self_rating, classroom_course_id, classroom_name, created_at }))),
            "guardar asignaturas",
          );
        }
      },

      deleteSubject: (id) => {
        // Las notas de la asignatura desaparecen con ella (la FK remota es
        // `on delete cascade`), así que se marcan también: si no, el otro
        // dispositivo intentaría volver a subirlas y daría error de clave ajena.
        const gradeIds = stateRef.current.grades
          .filter((g) => g.subject_id === id)
          .map((g) => g.id);
        setState((prev) => ({
          ...prev,
          subjects: prev.subjects.filter((s) => s.id !== id),
          tasks: prev.tasks.map((t) => (t.subject_id === id ? { ...t, subject_id: null } : t)),
          grades: prev.grades.filter((g) => g.subject_id !== id),
        }));
        markDeleted([
          { table: "subjects", key: id },
          ...gradeIds.map((key) => ({ table: "grades" as const, key })),
        ]);
      },

      deleteSubjects: (ids, names) => {
        let deletedSubjectIds: string[] = [];
        let deletedGradeIds: string[] = [];
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
          deletedGradeIds = prev.grades
            .filter((g) => deletedIds.has(g.subject_id))
            .map((g) => g.id);
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
          markDeleted([
            ...deletedSubjectIds.map((key) => ({ table: "subjects" as const, key })),
            ...deletedGradeIds.map((key) => ({ table: "grades" as const, key })),
          ]);
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
            // "mates" debe reutilizar "Matemáticas", no crear otra asignatura.
            const found = findSubjectByName(trimmed, prev.subjects);
            if (found) {
              resolvedSubjectId = found.id;
            } else {
              const id = newId();
              const colorIndex = (prev.subjects.length + newSubjects.length) % DEFAULT_COLORS.length;
              const sub: Subject = {
                id, user_id: userId, name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                self_rating: null, classroom_course_id: null, classroom_name: null, created_at: iso,
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
                _supabase.from("subjects").insert(newSubjects.map(({ id, name, color, self_rating, classroom_course_id, classroom_name, created_at }) => ({ id, user_id: userId, name, color, self_rating, classroom_course_id, classroom_name, created_at }))),
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
              // Emparejar diminutivos ("mates" → "Matemáticas") para no duplicar.
              const found = findSubjectByName(trimmed, allSubjects);
              if (found) return found.id;

              const colorIndex = allSubjects.length % DEFAULT_COLORS.length;
              const id = newId();
              const createdSub: Subject = {
                id, user_id: userId, name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                self_rating: null, classroom_course_id: null, classroom_name: null, created_at: iso,
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
                _supabase.from("subjects").insert(createdSubjects.map(({ id, name, color, self_rating, classroom_course_id, classroom_name, created_at }) => ({ id, user_id: userId, name, color, self_rating, classroom_course_id, classroom_name, created_at }))),
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
        markDeleted([{ table: "tasks", key: id }]);
      },

      deleteTasks: (ids, titles) => {
        // Los títulos se resuelven a ids reales: un borrado por título
        // ("borra la tarea de mates") debe llegar a la nube con su lápida, o el
        // otro dispositivo la devolverá al subir su copia.
        const resolvedIds = new Set<string>((ids || []).filter(Boolean));
        for (const id of resolveTaskIdsByTitles(titles || [])) resolvedIds.add(id);
        if (resolvedIds.size === 0) return;
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.filter((t) => !resolvedIds.has(t.id)),
        }));
        markDeleted([...resolvedIds].map((key) => ({ table: "tasks" as const, key })));
      },

      toggleTaskDone: (id) => {
        // Leer el estado actual de forma síncrona para saber si la tarea se
        // está completando (no descompletando) y otorgar XP en ese momento.
        const currentTask = stateRef.current.tasks.find((t) => t.id === id);
        const completing = currentTask ? currentTask.status !== "done" : false;

        setState((prev) => {
          const task = prev.tasks.find((t) => t.id === id);
          if (!task) return prev;
          const newStatus: Task["status"] = task.status === "done" ? "pending" : "done";
          const updated_at = nowIso();          void syncSupabase(_supabase.from("tasks").update({ status: newStatus, updated_at, reminder_sent: false }).eq("id", id), "actualizar tarea");
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === id ? { ...t, status: newStatus, updated_at, reminder_sent: false } : t,
            ),
          };
        });

        // Toda tarea completada da +20 XP (incluidas las sesiones de estudio).
        // El Pomodoro da +25 por separado al terminar la sesión del temporizador:
        // son dos eventos independientes, nunca se cuenta dos veces la misma acción.
        if (completing && currentTask) {
          awardXp("task", id);
        }
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
        markDeleted([{ table: "notes", key: id }]);
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
        markDeleted([{ table: "workouts", key: id }]);
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
        // Los días marcados de ese hábito se van con él (cascade en la nube),
        // así que se marcan también para que el otro dispositivo no los reenvíe.
        const completionIds = stateRef.current.habitCompletions
          .filter((c) => c.habit_id === id)
          .map((c) => c.id);
        setState((prev) => ({
          ...prev,
          habits: prev.habits.filter((h) => h.id !== id),
          habitCompletions: prev.habitCompletions.filter((c) => c.habit_id !== id),
        }));
        markDeleted([
          { table: "habits", key: id },
          ...completionIds.map((key) => ({ table: "habit_completions" as const, key })),
        ]);
      },

      toggleHabit: (habitId) => {
        // ¿Ya estaba completado hoy? Si no, se está completando ahora → XP.
        const existingToday = stateRef.current.habitCompletions.find(
          (c) => c.habit_id === habitId && c.completed_on === todayKey(),
        );
        const completing = !existingToday;

        setState((prev) => {
          const today = todayKey();
          const userId = uid();
          const existing = prev.habitCompletions.find(
            (c) => c.habit_id === habitId && c.completed_on === today,
          );
          if (existing) {
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

        // Desmarcar un día es un borrado: necesita lápida, o el dispositivo que
        // todavía tiene la marca la volvería a subir y reaparecería.
        if (existingToday) {
          markDeleted([{ table: "habit_completions", key: existingToday.id }]);
        }

        if (completing) {
          awardXp("habit", habitId);
        }
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
        markDeleted([{ table: "transactions", key: id }]);
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

      addPlannedExpense: (input) => {
        const id = newId();
        const iso = nowIso();
        const userId = uid();
        const newPlanned: PlannedExpense = {
          id,
          user_id: userId,
          amount: Number(input.amount),
          category: input.category.trim(),
          description: input.description?.trim() || null,
          date: input.date ?? null,
          is_completed: false,
          created_at: iso,
        };
        setState((prev) => ({
          ...prev,
          plannedExpenses: [...prev.plannedExpenses, newPlanned],
        }));
        if (userId !== "local") {
          void syncSupabase(
            _supabase.from("planned_expenses").insert(newPlanned),
            "guardar gasto planificado",
          );
        }
      },

      addPlannedExpenses: (inputs) => {
        const iso = nowIso();
        const userId = uid();
        const newPlannedList: PlannedExpense[] = inputs.map((input) => ({
          id: newId(),
          user_id: userId,
          amount: Number(input.amount),
          category: input.category.trim(),
          description: input.description?.trim() || null,
          date: input.date ?? null,
          is_completed: false,
          created_at: iso,
        }));
        setState((prev) => ({
          ...prev,
          plannedExpenses: [...prev.plannedExpenses, ...newPlannedList],
        }));
        if (userId !== "local" && newPlannedList.length > 0) {
          void syncSupabase(
            _supabase.from("planned_expenses").insert(newPlannedList),
            "guardar gastos planificados",
          );
        }
      },

      deletePlannedExpense: (id) => {
        setState((prev) => ({
          ...prev,
          plannedExpenses: prev.plannedExpenses.filter((p) => p.id !== id),
        }));
        markDeleted([{ table: "planned_expenses", key: id }]);
      },

      convertPlannedExpenseToTransaction: (id, date) => {
        const target = stateRef.current.plannedExpenses.find((p) => p.id === id);
        if (!target) return;
        const txDate = date || target.date || todayKey();
        const txId = newId();
        const iso = nowIso();
        const userId = uid();
        const newTx: Transaction = {
          id: txId,
          user_id: userId,
          type: "expense",
          amount: target.amount,
          category: target.category,
          description: target.description,
          date: txDate,
          created_at: iso,
        };
        setState((prev) => ({
          ...prev,
          plannedExpenses: prev.plannedExpenses.filter((p) => p.id !== id),
          transactions: [...prev.transactions, newTx],
        }));
        if (userId !== "local") {
          void syncSupabase(
            _supabase.from("transactions").insert(newTx),
            "guardar transacción",
          );
        }
        // El gasto planificado pasa a ser un gasto real: su fila se borra (con
        // lápida) para que el otro dispositivo no la devuelva.
        markDeleted([{ table: "planned_expenses", key: id }]);
      },

      addGrade: (input) => {
        const iso = nowIso();
        const userId = uid();
        let createdSubject: Subject | null = null;
        let createdGrade: Grade | null = null;
        // Tarea que pasa a "done" al enlazarle esta nota (se premia con XP
        // igual que si se hubiera marcado a mano, una sola vez por tarea).
        let completedTaskId: string | null = null;
        setState((prev) => {
          let resolvedSubjectId = input.subject_id ?? null;
          const newSubjects: Subject[] = [];

          if (!resolvedSubjectId && input.subject_name?.trim()) {
            const trimmed = input.subject_name.trim();
            const found = findSubjectByName(trimmed, prev.subjects);
            if (found) {
              resolvedSubjectId = found.id;
            } else {
              const id = newId();
              const colorIndex = (prev.subjects.length + newSubjects.length) % DEFAULT_COLORS.length;
              const createdSub: Subject = {
                id, user_id: userId, name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                self_rating: null, classroom_course_id: null, classroom_name: null, created_at: iso,
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
              id, user_id: userId, name: "General",color: DEFAULT_COLORS[0],
                self_rating: null, classroom_course_id: null, classroom_name: null, created_at: iso,
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
              if (foundTask.status !== "done") completedTaskId = foundTask.id;
              updatedTasks = prev.tasks.map(
                (t) =>
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
        // +20 XP por completar la tarea desde su calificación (una única vez).
        if (completedTaskId) awardXp("task", completedTaskId);

        if (userId !== "local") {
          const subjectToSave = createdSubject as Subject | null;
          const gradeToSave = createdGrade as unknown as Grade;
          void (async () => {
            if (subjectToSave) {
              const subjectResult = await syncSupabase(
                _supabase.from("subjects").insert({ id: subjectToSave.id, user_id: userId, name: subjectToSave.name, color: subjectToSave.color, self_rating: null, created_at: subjectToSave.created_at }),
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
        // Tareas que pasan a "done" al enlazarles estas calificaciones.
        let completedTaskIds: string[] = [];
        setState((prev) => {
          const newSubjects: Subject[] = [];
          const allSubjects = [...prev.subjects];
          let updatedTasks = [...prev.tasks];
          const completedIds: string[] = [];

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
              // Mismo criterio que en las tareas: no duplicar por un diminutivo.
              const found = findSubjectByName(trimmed, allSubjects);
              if (found) return found.id;

              const colorIndex = allSubjects.length % DEFAULT_COLORS.length;
              const id = newId();
              const createdSub: Subject = {
                id, user_id: userId, name: trimmed,
                color: DEFAULT_COLORS[colorIndex],
                self_rating: null, classroom_course_id: null, classroom_name: null, created_at: iso,
              };
              allSubjects.push(createdSub);
              newSubjects.push(createdSub);
              return createdSub.id;
            }
            if (allSubjects.length > 0) return allSubjects[0].id;

            const id = newId();
            const createdSub: Subject = {
              id, user_id: userId, name: "General",color: DEFAULT_COLORS[0],
                self_rating: null, classroom_course_id: null, classroom_name: null, created_at: iso,
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
                if (foundTask.status !== "done") completedIds.push(foundTask.id);
                updatedTasks = updatedTasks.map(
                  (t) =>
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
          completedTaskIds = completedIds;
          return {
            ...prev,
            subjects: [...prev.subjects, ...newSubjects],
            tasks: updatedTasks,
            grades: [...prev.grades, ...newGrades],
          };
        });
        // +20 XP por cada tarea completada desde su calificación (una vez cada una).
        for (const completed of completedTaskIds) awardXp("task", completed);

        if (userId !== "local" && createdGrades.length > 0) {
          void (async () => {
            if (createdSubjects.length > 0) {
              const subjectResult = await syncSupabase(
                _supabase.from("subjects").insert(createdSubjects.map(({ id, name, color, self_rating, classroom_course_id, classroom_name, created_at }) => ({ id, user_id: userId, name, color, self_rating, classroom_course_id, classroom_name, created_at }))),
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
        markDeleted([{ table: "grades", key: id }]);
      },

      deleteGrades: (ids, titles) => {
        // Este borrado no llegaba a la nube: al recargar, las notas volvían (el
        // mismo fantasma que tenían las tareas). Ahora resuelve ids y se propaga.
        const resolvedIds = resolveGradeIds(ids, titles);
        if (resolvedIds.length === 0) return;
        setState((prev) => ({
          ...prev,
          grades: prev.grades.filter((g) => !resolvedIds.includes(g.id)),
        }));
        markDeleted(resolvedIds.map((key) => ({ table: "grades" as const, key })));
      },

      setSubjectRating: (subjectId, rating) => {
        const userId = uid();
        setState((prev) => ({
          ...prev,
          subjects: prev.subjects.map((s) =>
            s.id === subjectId ? { ...s, self_rating: rating } : s,
          ),
        }));
        if (userId !== "local") {
          void syncSupabase(
            _supabase.from("subjects").update({ self_rating: rating }).eq("id", subjectId),
            "guardar autoevaluación",
          );
        }
      },

      saveSleepLog: (input) => {
        const date = input.date || todayKey();
        const hours = roundHours(Number(input.hours));
        if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return;

        // Si esa noche se había borrado, este registro la reabre.
        reopenSleepLog(date);

        const iso = nowIso();
        const userId = uid();
        const bedtime = input.bedtime || null;
        const wakeTime = input.wake_time || null;
        const quality = input.quality ?? null;
        const notes = input.notes?.trim() || null;

        setState((prev) => {
          const existing = prev.sleepLogs.find((log) => log.date === date);
          if (existing) {
            // Ya hay una noche con esa fecha: se actualiza en su sitio.
            return {
              ...prev,
              sleepLogs: prev.sleepLogs.map((log) =>
                log.date === date
                  ? { ...log, bedtime, wake_time: wakeTime, hours, quality, notes, updated_at: iso }
                  : log,
              ),
            };
          }
          const newLog: SleepLog = {
            id: newId(),
            user_id: userId,
            date,
            bedtime,
            wake_time: wakeTime,
            hours,
            quality,
            notes,
            created_at: iso,
            updated_at: iso,
          };
          return { ...prev, sleepLogs: [newLog, ...prev.sleepLogs] };
        });

        if (userId !== "local") {
          void syncSupabase(
            _supabase
              .from("sleep_logs")
              .upsert(
                { user_id: userId, date, bedtime, wake_time: wakeTime, hours, quality, notes, updated_at: iso },
                { onConflict: "user_id,date" },
              ),
            "guardar sueño",
          );
        }

        // XP de la noche: +15 (objetivo), +5 (casi), 0 (insuficiente) o -5 (muy
        // corta). Se evalúa aquí, al registrar la noche, y nunca dos veces por
        // fecha (aunque se edite o se recargue la app).
        const target =
          stateRef.current.sleepSettings?.target_hours ?? DEFAULT_SLEEP_SETTINGS.target_hours;
        evaluateSleepXp(date, hours, target);
      },

      deleteSleepLog: (date) => {
        setState((prev) => ({
          ...prev,
          sleepLogs: prev.sleepLogs.filter((log) => log.date !== date),
        }));
        // La clave de una noche es su fecha: la lápida también, así el otro
        // dispositivo no la vuelve a subir. Si más adelante se registra otra vez
        // esa noche, su `updated_at` es posterior y la lápida ya no aplica.
        markDeleted([{ table: "sleep_logs", key: date }]);
      },

      setSleepSettings: (input) => {
        const userId = uid();
        const targetHours = roundHours(Number(input.target_hours));
        const settings: SleepSettings = {
          target_hours:
            Number.isFinite(targetHours) && targetHours > 0 && targetHours <= 24
              ? targetHours
              : DEFAULT_SLEEP_SETTINGS.target_hours,
          bedtime: input.bedtime || DEFAULT_SLEEP_SETTINGS.bedtime,
          wake_time: input.wake_time || DEFAULT_SLEEP_SETTINGS.wake_time,
          reminder_enabled: input.reminder_enabled ?? true,
          updated_at: nowIso(),
        };
        setState((prev) => ({ ...prev, sleepSettings: settings }));
        if (userId !== "local") {
          void syncSupabase(
            _supabase
              .from("sleep_settings")
              .upsert(
                {
                  user_id: userId,
                  target_hours: settings.target_hours,
                  bedtime: settings.bedtime,
                  wake_time: settings.wake_time,
                  reminder_enabled: settings.reminder_enabled,
                },
                { onConflict: "user_id" },
              ),
            "guardar objetivo de sueño",
          );
        }
      },

      resetAll: async () => {
        const userId = userIdRef.current;

        // 0. Marcar como borradas TODAS las filas actuales antes de vaciar la
        //    nube: si no, el otro dispositivo (con sus copias en caché) volvería
        //    a subirlas y el "borrado de todo" se desharía solo.
        if (userId && userId !== "local") {
          const entries: DeleteInput[] = [];
          const fields = stateRef.current as unknown as Record<string, unknown>;
          for (const table of SYNC_TABLES) {
            const rows = fields[STATE_FIELD_OF_TABLE[table]];
            if (!Array.isArray(rows)) continue;
            for (const row of rows as Array<Record<string, unknown>>) {
              const key = rowKey(table, row);
              if (key) entries.push({ table, key });
            }
          }
          markDeleted(entries);
        }

        // 1. Vaciar el estado local (las vistas se quedan vacías al instante).
        setState(emptyState());

        // 2. Limpiar localStorage de datos (invitado + usuario). NO se toca
        //    "nucleo:ai-settings:v1": ahí vive la API key del usuario.
        try {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(STORAGE_KEY);
            window.localStorage.removeItem("nucleo:progress-tree:v2");
            window.localStorage.removeItem("nucleo:progress-tree:v3");
            if (userId) window.localStorage.removeItem(userStorageKey(userId));
            // La clave antigua de lápidas (solo tareas) se limpia; los borrados
            // de ahora los lleva la cola `pending-deletes`, que en este momento
            // guarda el borrado de todo lo que había.
            window.localStorage.removeItem(`${LEGACY_DELETED_TASKS_PREFIX}${userId ?? "local"}`);
          }
        } catch {
          // Ignorar errores de cuota/acceso.
        }

        // 3. Borrar todos los registros del usuario en Supabase. El estado
        //    vacío hace que el efecto de re-sincronización no vuelva a subir
        //    nada, y el borrado remoto evita que los datos reaparezcan al
        //    recargar (el merge local<->remoto se haría con datos vacíos).
        if (!userId || userId === "local") return { ok: true };

        const TABLES = [
          "subjects",
          "tasks",
          "notes",
          "workouts",
          "habits",
          "habit_completions",
          "transactions",
          "grades",
          "budgets",
          "planned_expenses",
          "sleep_logs",
          "sleep_settings",
          "tree_progress",
          "tree_xp_events",
        ] as const;

        let ok = true;
        for (const table of TABLES) {
          const { error } = await _supabase.from(table).delete().eq("user_id", userId);
          if (error) {
            console.error(`[Supabase] reset: borrar ${table}: ${error.message}`);
            ok = false;
          }
        }
        return ok ? { ok: true } : { ok: false, error: "Hubo errores borrando algunos datos en la nube." };
      },
    };
  }, [markDeleted, reopenSleepLog]);

  const value = useMemo<DataContextValue>(() => {
    const finance = computeFinance(
      state.transactions,
      state.budget,
      state.plannedExpenses,
    );
    return {
      data: { ...state, finance },
      hydrated,
      actions,
      syncError,
      clearSyncError,
    };
  }, [state, hydrated, actions, syncError, clearSyncError]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData debe usarse dentro de <DataProvider>.");
  }
  return ctx;
}