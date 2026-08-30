"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useData } from "@/components/providers/data-provider";
import { localDayKey, todayKey } from "@/lib/format";
import { effectiveXpCap } from "@/lib/xp-cap";

// ─── Constantes ─────────────────────────────────────────────────────────────

export const XP_REWARDS = {
  task: 20,
  pomodoro: 25,
  habit: 5,
} as const;

export const XP_COLORS = {
  task: "#16a34a",
  pomodoro: "#ea580c",
  habit: "#0ea5e9",
} as const;

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

const TREE_KEY = "nucleo:progress-tree:v5";
const CELEBRATED_KEY = "nucleo:xp-celebrated:v1";
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
  try {
    localStorage.setItem(TREE_KEY, JSON.stringify(tree));
  } catch { /* Almacenamiento no disponible. */ }
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
  try {
    localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...set].slice(-200)));
  } catch { /* Almacenamiento no disponible. */ }
}

// ─── Cálculo de XP ───────────────────────────────────────────────────────────

export function levelForXp(xp: number): number {
  return Math.max(0, LEVELS.reduce((current, item, index) => (xp >= item.required ? index : current), 0));
}

type DataSnapshot = ReturnType<typeof useData>["data"];

/**
 * Calcula el XP de un día concreto. Los días pasados ya están fijos en
 * tree.xpByDay, por lo que borrar una tarea después no resta el XP histórico.
 */
export function xpForDay(data: DataSnapshot, key: string, pomodoroCount: number): number {
  const tasks = data.tasks.filter(
    (item) =>
      item.status === "done" &&
      item.type !== "study_session" &&
      localDayKey(item.updated_at) === key
  );
  const habits = data.habitCompletions.filter((item) => item.completed_on === key);

  const missedHabits = key < todayKey()
    ? data.habits.filter((habit) => !habits.some((item) => item.habit_id === habit.id)).length
    : 0;
  const noWorkout = key < todayKey() && !data.workouts.some((item) => item.date === key) ? 10 : 0;

  const raw =
    tasks.length * XP_REWARDS.task +
    pomodoroCount * XP_REWARDS.pomodoro +
    habits.length * XP_REWARDS.habit -
    missedHabits * 15 -
    noWorkout;

  return Math.max(-25, Math.min(effectiveXpCap(), raw));
}

function recalculateTree(
  data: DataSnapshot,
  tree: SavedTree,
  pomodoroCount: number
): SavedTree {
  const nextDays = { ...tree.xpByDay };
  const cursor = new Date(`${tree.lastCalculated}T00:00:00`);
  const today = new Date(`${todayKey()}T00:00:00`);

  while (cursor <= today) {
    const key = dayKey(cursor);
    // Los días pasados ya están fijos. Solo se recalcula hoy.
    if (key === todayKey() || nextDays[key] == null) {
      nextDays[key] = xpForDay(data, key, pomodoroCount);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const xp = Math.max(0, Object.values(nextDays).reduce((sum, v) => sum + v, 0));

  return { xp, level: levelForXp(xp), xpByDay: nextDays, lastCalculated: todayKey() };
}

// ─── Store global compartido ──────────────────────────────────────────────────
// XpToast y ProgressTree llaman a useXpSystem() por separado, pero deben
// compartir el MISMO estado. Este store global garantiza que ambos componentes
// vean los mismos datos y notificaciones.

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

// ─── Instancia única del motor de XP ──────────────────────────────────────────
// Se inicializa una sola vez. Usa refs para recordar el estado previo de cada
// tarea/hábito y detectar transiciones reales (no → done).

let engineInitialized = false;
let prevTaskStatus = new Map<string, string>();
let prevHabitKeys = new Set<string>();
let prevPomodoroSet = new Set<string>();
let celebratedSet = readCelebratedToday();
let currentTree = readTree();
let lastProcessedKey = "";

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

function processXpEvents(data: DataSnapshot): void {
  const today = todayKey();
  const newNotifications: XpNotification[] = [];

  // ── 1. Detectar tareas que pasaron a "done" ──────────────────────────
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
        const currentTodayXp = currentTree.xpByDay[today] ?? 0;
        const isOverLimit = currentTodayXp >= effectiveXpCap();
        newNotifications.push({
          id: `${eventId}:${Date.now()}`,
          value: XP_REWARDS.task,
          color: XP_COLORS.task,
          label: isOverLimit ? XP_LABELS.limit : XP_LABELS.task,
          limit: isOverLimit,
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
      const currentTodayXp = currentTree.xpByDay[today] ?? 0;
      const isOverLimit = currentTodayXp >= effectiveXpCap();
      newNotifications.push({
        id: `${completion}:${Date.now()}`,
        value: XP_REWARDS.pomodoro,
        color: XP_COLORS.pomodoro,
        label: isOverLimit ? XP_LABELS.limit : XP_LABELS.pomodoro,
        limit: isOverLimit,
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
        const currentTodayXp = currentTree.xpByDay[today] ?? 0;
        const isOverLimit = currentTodayXp >= effectiveXpCap();
        newNotifications.push({
          id: `${eventId}:${Date.now()}`,
          value: XP_REWARDS.habit,
          color: XP_COLORS.habit,
          label: isOverLimit ? XP_LABELS.limit : XP_LABELS.habit,
          limit: isOverLimit,
        });
      }
    }
  }
  prevHabitKeys = nextHabitKeys;

  // ── 4. Recalcular XP ─────────────────────────────────────────────────
  const pomodoroCount = pomodoroCompletions.length;
  const next = recalculateTree(data, currentTree, pomodoroCount);

  if (next.xp !== currentTree.xp || next.level !== currentTree.level) {
    writeTree(next);
    currentTree = next;
  } else {
    writeTree(next);
    currentTree = next;
  }

  // ── 5. Emitir notificaciones y guardar estado ───────────────────────
  if (newNotifications.length > 0) {
    writeCelebratedToday(celebratedSet);
    setStoreState({
      tree: currentTree,
      notifications: [...storeState.notifications, ...newNotifications.slice(0, 5)],
    });
  } else if (next.xp !== storeState.tree.xp || next.level !== storeState.tree.level) {
    setStoreState({ tree: currentTree });
  }

  lastProcessedKey = today;
}

function initEngine(data: DataSnapshot): () => void {
  // Procesar eventos cuando cambian los datos.
  processXpEvents(data);

  // Escuchar cambios en localStorage de Pomodoros (para detectar sesiones
  // completadas desde el componente Pomodoro que escribe en localStorage).
  let storageHandler: ((e: StorageEvent) => void) | null = null;
  if (typeof window !== "undefined") {
    storageHandler = (e: StorageEvent) => {
      if (e.key === POMODORO_KEY) {
        processXpEvents(data);
      }
    };
    window.addEventListener("storage", storageHandler);
  }

  return () => {
    if (storageHandler && typeof window !== "undefined") {
      window.removeEventListener("storage", storageHandler);
    }
  };
}

// ─── Hook público ─────────────────────────────────────────────────────────────

export type XpSystem = {
  tree: SavedTree;
  notifications: XpNotification[];
  dismissNotification: (id: string) => void;
};

/**
 * Hook central que gestiona todo el sistema de XP y notificaciones.
 * Usa useSyncExternalStore para que todos los componentes compartan el mismo
 * estado. Detecta tareas/hábitos/Pomodoros completados en tiempo real, emite
 * notificaciones inmediatas y actualiza el XP siempre (incluso con el panel
 * cerrado). El XP histórico persiste aunque se borren las tareas después.
 */
export function useXpSystem(): XpSystem {
  const { data } = useData();
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Procesar eventos cada vez que cambian los datos de la app.
  useEffect(() => {
    // Si es la primera vez, inicializar el motor.
    if (!engineInitialized) {
      engineInitialized = true;
    }
    processXpEvents(data);

    // También escuchar cambios en localStorage de Pomodoros.
    const handler = (e: StorageEvent) => {
      if (e.key === POMODORO_KEY) {
        processXpEvents(data);
      }
    };
    window.addEventListener("storage", handler);
    cleanupRef.current = () => window.removeEventListener("storage", handler);

    return () => {
      window.removeEventListener("storage", handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tasks, data.habitCompletions, data.workouts, data.habits]);

  // Poll localStorage para Pomodoros cada 2s (el evento "storage" no se
  // dispara en la misma pestaña donde se escribe).
  useEffect(() => {
    const interval = setInterval(() => {
      const pomodoros = getPomodoroCompletionsToday();
      if (pomodoros.length !== prevPomodoroSet.size) {
        processXpEvents(data);
      }
    }, 2000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

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
