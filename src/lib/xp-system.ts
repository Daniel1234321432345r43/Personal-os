"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useData } from "@/components/providers/data-provider";
import { localDayKey, todayKey } from "@/lib/format";
import { effectiveXpCap } from "@/lib/xp-cap";

// ─── Constantes ─────────────────────────────────────────────────────────────

export const XP_REWARDS = { task: 20, pomodoro: 25, habit: 5 } as const;
export const XP_COLORS = { task: "#16a34a", pomodoro: "#ea580c", habit: "#0ea5e9" } as const;
export const XP_LABELS = {
  task: "Tarea completada",
  pomodoro: "Pomodoro completado",
  habit: "Hábito completado",
  limit: "Límite diario alcanzado",
} as const;

export const LEVELS = [
  { name: "Brote", subtitle: "0 - 100 XP", required: 0, emoji: "🌱" },
  { name: "Planta joven", subtitle: "101 - 300 XP", required: 101, emoji: "🌿" },
  { name: "Árbol mediano", subtitle: "301 - 650 XP", required: 301, emoji: "🌳" },
  { name: "Árbol grande", subtitle: "651 - 1200 XP", required: 651, emoji: "🌲" },
  { name: "Secuoya final", subtitle: "1201+ XP", required: 1201, emoji: "🌲" },
] as const;

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type XpNotification = {
  id: string;
  value: number;
  color: string;
  label: string;
  limit: boolean;
};

export type SavedTree = {
  xp: number;
  level: number;
  xpByDay: Record<string, number>;
  lastCalculated: string;
};

// ─── Almacenamiento ──────────────────────────────────────────────────────────

const TREE_KEY = "nucleo:progress-tree:v6";
const CELEBRATED_KEY = "nucleo:xp-celebrated:v2";
const POMODORO_KEY = "nucleo:pomodoro-completions:v1";

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

export function emptyTree(): SavedTree {
  return { xp: 0, level: 0, xpByDay: {}, lastCalculated: yesterdayKey() };
}

function readTree(): SavedTree {
  if (typeof window === "undefined") return emptyTree();
  try {
    const parsed = JSON.parse(localStorage.getItem(TREE_KEY) ?? "null") as Partial<SavedTree> | null;
    if (parsed && typeof parsed.xp === "number") {
      return { ...emptyTree(), ...parsed, xpByDay: parsed.xpByDay ?? {} };
    }
  } catch { /* Estado inválido. */ }
  return emptyTree();
}

function writeTree(tree: SavedTree): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(TREE_KEY, JSON.stringify(tree)); } catch { /* noop */ }
}

function readCelebratedToday(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const today = todayKey();
    const parsed = JSON.parse(localStorage.getItem(CELEBRATED_KEY) ?? "[]") as unknown;
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id: unknown): id is string => typeof id === "string" && id.includes(`:${today}:`))
        : []
    );
  } catch { return new Set(); }
}

function writeCelebratedToday(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...set].slice(-200))); } catch { /* noop */ }
}

// ─── Cálculo ─────────────────────────────────────────────────────────────────

export function levelForXp(xp: number): number {
  return Math.max(0, LEVELS.reduce((current, item, index) => (xp >= item.required ? index : current), 0));
}

type DataSnapshot = ReturnType<typeof useData>["data"];

function getPomodoroCompletionsToday(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const today = todayKey();
    const stored = JSON.parse(localStorage.getItem(POMODORO_KEY) ?? "[]") as unknown;
    return Array.isArray(stored)
      ? stored.filter((v: unknown): v is string => typeof v === "string" && v.startsWith(`pomodoro:${today}:`))
      : [];
  } catch { return []; }
}

function xpForDay(data: DataSnapshot, key: string, pomodoroCount: number): number {
  const tasks = data.tasks.filter(
    (item) => item.status === "done" && item.type !== "study_session" && localDayKey(item.updated_at) === key
  );
  const habits = data.habitCompletions.filter((item) => item.completed_on === key);
  const missedHabits = key < todayKey()
    ? data.habits.filter((habit) => !habits.some((item) => item.habit_id === habit.id)).length
    : 0;
  const noWorkout = key < todayKey() && !data.workouts.some((item) => item.date === key) ? 10 : 0;
  const raw = tasks.length * XP_REWARDS.task + pomodoroCount * XP_REWARDS.pomodoro + habits.length * XP_REWARDS.habit - missedHabits * 15 - noWorkout;
  return Math.max(-25, Math.min(effectiveXpCap(), raw));
}

function recalculateTree(data: DataSnapshot, tree: SavedTree, pomodoroCount: number): SavedTree {
  const nextDays = { ...tree.xpByDay };
  const cursor = new Date(`${tree.lastCalculated}T00:00:00`);
  const today = new Date(`${todayKey()}T00:00:00`);
  while (cursor <= today) {
    const key = dayKey(cursor);
    if (key === todayKey() || nextDays[key] == null) {
      nextDays[key] = xpForDay(data, key, pomodoroCount);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  const xp = Math.max(0, Object.values(nextDays).reduce((sum, v) => sum + v, 0));
  return { xp, level: levelForXp(xp), xpByDay: nextDays, lastCalculated: todayKey() };
}

// ─── Store externo: una sola fuente de verdad ─────────────────────────────────
//
// XpToast y ProgressTree NO procesan eventos. Solo leen el store.
// Un único componente <XpEngine /> (montado en AppShell) procesa los datos
// y actualiza el store. Esto elimina el bug de doble procesamiento.

type XpStoreState = {
  tree: SavedTree;
  notifications: XpNotification[];
};

let storeState: XpStoreState = {
  tree: typeof window !== "undefined" ? readTree() : emptyTree(),
  notifications: [],
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): XpStoreState {
  return storeState;
}

function setStoreState(next: Partial<XpStoreState>) {
  storeState = { ...storeState, ...next };
  emitChange();
}

// ─── Motor: estado persistente entre renders ───────────────────────────────────

let celebratedSet = readCelebratedToday();
let currentTree = readTree();
let prevTaskStatus = new Map<string, string>();
let prevHabitKeys = new Set<string>();
let prevPomodoroSet = new Set<string>();

/**
 * Procesa todos los eventos de XP. Se llama UNA sola vez por cambio de datos
 * desde <XpEngine />, no desde los consumidores.
 */
function processXpEvents(data: DataSnapshot): void {
  const today = todayKey();
  const newNotifications: XpNotification[] = [];

  // ── 1. Detectar tareas que pasaron a "done" ──────────────────────────
  // Igual que los hábitos: comparamos el estado anterior con el actual.
  // Si antes era "pending" y ahora es "done", es un evento nuevo.
  const currentStatus = new Map<string, string>();
  for (const task of data.tasks) {
    currentStatus.set(task.id, task.status);

    const wasNotDone = prevTaskStatus.get(task.id) !== "done";
    const isDoneNow = task.status === "done";
    const isToday = localDayKey(task.updated_at) === today;

    if (isDoneNow && wasNotDone && isToday && task.type !== "study_session") {
      const eventId = `task:${today}:${task.id}`;
      if (!celebratedSet.has(eventId)) {
        celebratedSet.add(eventId);
        newNotifications.push({
          id: `${eventId}:${Date.now()}`,
          value: XP_REWARDS.task,
          color: XP_COLORS.task,
          label: XP_LABELS.task,
          limit: false,
        });
      }
    }
  }
  prevTaskStatus = currentStatus;

  // ── 2. Detectar Pomodoros nuevos ─────────────────────────────────────
  const pomodoroCompletions = getPomodoroCompletionsToday();
  for (const completion of pomodoroCompletions) {
    if (!prevPomodoroSet.has(completion) && !celebratedSet.has(completion)) {
      celebratedSet.add(completion);
      newNotifications.push({
        id: `${completion}:${Date.now()}`,
        value: XP_REWARDS.pomodoro,
        color: XP_COLORS.pomodoro,
        label: XP_LABELS.pomodoro,
        limit: false,
      });
    }
  }
  prevPomodoroSet = new Set(pomodoroCompletions);

  // ── 3. Detectar hábitos completados nuevos ──────────────────────────
  const nextHabitKeys = new Set<string>();
  for (const completion of data.habitCompletions) {
    const key = `${completion.habit_id}:${completion.completed_on}`;
    nextHabitKeys.add(key);

    if (completion.completed_on === today && !prevHabitKeys.has(key)) {
      const eventId = `habit:${today}:${completion.habit_id}`;
      if (!celebratedSet.has(eventId)) {
        celebratedSet.add(eventId);
        newNotifications.push({
          id: `${eventId}:${Date.now()}`,
          value: XP_REWARDS.habit,
          color: XP_COLORS.habit,
          label: XP_LABELS.habit,
          limit: false,
        });
      }
    }
  }
  prevHabitKeys = nextHabitKeys;

  // ── 4. Recalcular XP ─────────────────────────────────────────────────
  const next = recalculateTree(data, currentTree, pomodoroCompletions.length);
  writeTree(next);
  currentTree = next;

  // ── 5. Emitir cambios al store ───────────────────────────────────────
  if (newNotifications.length > 0) {
    writeCelebratedToday(celebratedSet);
    setStoreState({
      tree: currentTree,
      notifications: [...storeState.notifications, ...newNotifications.slice(0, 5)],
    });
  } else {
    setStoreState({ tree: currentTree });
  }
}

// ─── Componente motor: se monta UNA sola vez en AppShell ─────────────────────

/**
 * Componente invisible que procesa todos los eventos de XP.
 * Se monta una sola vez en AppShell. Ningún otro componente procesa eventos;
 * XpToast y ProgressTree solo leen el store.
 */
export function XpEngine() {
  const { data } = useData();

  // Procesar cuando cambian los datos. Como este componente se monta una sola
  // vez, processXpEvents se ejecuta una sola vez por cambio de datos.
  useEffect(() => {
    processXpEvents(data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tasks, data.habitCompletions, data.workouts, data.habits]);

  // Poll localStorage para Pomodoros (el evento "storage" no se dispara en la
  // misma pestaña donde se escribe).
  useEffect(() => {
    const interval = setInterval(() => {
      const pomodoros = getPomodoroCompletionsToday();
      if (pomodoros.length !== prevPomodoroSet.size) {
        processXpEvents(data);
      }
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return null;
}

// ─── Hook público: los consumidores solo leen ─────────────────────────────────

export type XpSystem = {
  tree: SavedTree;
  notifications: XpNotification[];
  dismissNotification: (id: string) => void;
};

/**
 * Hook de solo lectura. Lee el tree y las notificaciones del store global.
 * No procesa eventos — eso lo hace <XpEngine />.
 */
export function useXpSystem(): XpSystem {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const dismissNotification = useCallback((id: string) => {
    setStoreState({
      notifications: storeState.notifications.filter((n) => n.id !== id),
    });
  }, []);

  return {
    tree: state.tree,
    notifications: state.notifications,
    dismissNotification,
  };
}
