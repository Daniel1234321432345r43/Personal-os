"use client";

import { useCallback, useSyncExternalStore } from "react";
import { effectiveXpCap } from "@/lib/xp-cap";
import { todayKey } from "@/lib/format";
import type { Habit, HabitCompletion } from "@/lib/types";

// ─── Constantes ─────────────────────────────────────────────────────────────

export const XP_REWARDS = { task: 20, pomodoro: 25, habit: 5 } as const;

/** XP que se resta por cada hábito no completado el día anterior. */
export const HABIT_PENALTY = 15;

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
  kind: "task" | "habit" | "pomodoro";
  value: number;
  color: string;
  label: string;
  limit: boolean;
  /** true cuando el XP se resta (penalización por hábito no completado). */
  penalty?: boolean;
};

export type SavedTree = {
  xp: number;
  level: number;
  xpToday: number;
  lastDate: string;
};

// ─── Almacenamiento ──────────────────────────────────────────────────────────

const TREE_KEY = "nucleo:progress-tree:v8";
// Claves de versiones anteriores: el XP acumulado no debe perderse al
// actualizar la app, así que readTree() intenta migrarlo si la clave nueva
// aún no existe.
const LEGACY_TREE_KEYS = [
  "nucleo:progress-tree:v7", // misma forma { xp, level, xpToday, lastDate }
  "nucleo:progress-tree:v6",
  "nucleo:progress-tree:v5",
  "nucleo:progress-tree:v4", // forma antigua { xp, level, lastCalculated, xpByDay }
];
const CELEBRATED_KEY = "nucleo:xp-celebrated:v4";

// Penalización diaria: cada día, por cada hábito que no se completó el día
// anterior se restan 15 XP. Se guarda la fecha del último día ya revisado para
// no volver a penalizar el mismo día en cada recarga.
const HABIT_PENALTY_KEY = "nucleo:xp-habit-penalty:v1";

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Suma/resta días a una clave de fecha (YYYY-MM-DD). */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function emptyTree(): SavedTree {
  return { xp: 0, level: 0, xpToday: 0, lastDate: yesterdayKey() };
}

function readTree(): SavedTree {
  if (typeof window === "undefined") return emptyTree();

  // Forma normalizada para cualquier versión guardada.
  const normalize = (parsed: Partial<SavedTree>): SavedTree => ({
    xp: typeof parsed.xp === "number" ? parsed.xp : 0,
    level: typeof parsed.level === "number" ? parsed.level : levelForXp(parsed.xp ?? 0),
    xpToday: parsed.xpToday ?? 0,
    lastDate: parsed.lastDate ?? yesterdayKey(),
  });

  // 1) Clave actual.
  try {
    const parsed = JSON.parse(localStorage.getItem(TREE_KEY) ?? "null") as Partial<SavedTree> | null;
    if (parsed && typeof parsed.xp === "number") return normalize(parsed);
  } catch { /* Estado inválido. */ }

  // 2) Migración desde versiones anteriores (conserva el XP acumulado).
  for (const key of LEGACY_TREE_KEYS) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<SavedTree> | null;
      if (parsed && typeof parsed.xp === "number") return normalize(parsed);
    } catch { /* Siguiente clave. */ }
  }

  return emptyTree();
}

function writeTree(tree: SavedTree): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(TREE_KEY, JSON.stringify(tree)); } catch { /* noop */ }
}

function readCelebrated(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem(CELEBRATED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch { return new Set(); }
}

function writeCelebrated(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...set].slice(-300))); } catch { /* noop */ }
}

/** Último día (yesterday) cuya penalización de hábitos ya se aplicó. */
function readPenaltyDate(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(HABIT_PENALTY_KEY); } catch { return null; }
}

function writePenaltyDate(dateStr: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(HABIT_PENALTY_KEY, dateStr); } catch { /* noop */ }
}

// ─── Nivel ───────────────────────────────────────────────────────────────────

export function levelForXp(xp: number): number {
  return Math.max(0, LEVELS.reduce((current, item, index) => (xp >= item.required ? index : current), 0));
}

// ─── Store global (módulo) ───────────────────────────────────────────────────
//
// El sistema completo es DIRECTO: cuando el usuario completa una tarea, un
// hábito o un Pomodoro, el manejador de la acción llama a awardXp() en ese
// mismo instante. No hay useEffect que detecte transiciones, no hay polling,
// no hay motores. Cada acción → una llamada → un toast + XP.

const celebrated: Set<string> = typeof window !== "undefined" ? readCelebrated() : new Set();

// Un único objeto de estado con referencia estable: cada cambio reemplaza el
// objeto completo, así useSyncExternalStore detecta el cambio sin bucles.
let storeState: { tree: SavedTree; notifications: XpNotification[] } = {
  tree: typeof window !== "undefined" ? readTree() : emptyTree(),
  notifications: [],
};

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot() {
  return storeState;
}

// Estado para SSR e hidratación: debe ser estático y coincidir en servidor y
// cliente, o React fallará la hidratación. Después de hidratar, React cambia
// automáticamente a getSnapshot() con los valores reales de localStorage.
const EMPTY_STORE_STATE: { tree: SavedTree; notifications: XpNotification[] } = {
  tree: emptyTree(),
  notifications: [],
};

function getServerSnapshot() {
  return EMPTY_STORE_STATE;
}

// ─── API pública ─────────────────────────────────────────────────────────────

export type XpKind = keyof typeof XP_REWARDS;

/**
 * Otorga XP y emite un toast. Se llama DIRECTAMENTE desde el manejador de la
 * acción (toggleTaskDone, toggleHabit, Pomodoro). Cada evento solo se premia
 * una vez por día (deduplicación por id en localStorage).
 */
export function awardXp(kind: XpKind, eventId: string): void {
  const today = todayKey();
  const dedupId = `${kind}:${today}:${eventId}`;

  // Ya premiado hoy: no duplicar ni avisar.
  if (celebrated.has(dedupId)) return;
  celebrated.add(dedupId);
  writeCelebrated(celebrated);

  const current = storeState.tree;

  // Reiniciar el contador diario si cambió el día.
  let base = current;
  if (base.lastDate !== today) {
    base = { ...base, xpToday: 0, lastDate: today };
  }

  const value = XP_REWARDS[kind];
  let gained = 0;
  let overLimit = false;

  if (base.xpToday < effectiveXpCap()) {
    gained = Math.min(value, effectiveXpCap() - base.xpToday);
    overLimit = gained < value;
    const newXp = base.xp + gained;
    base = {
      ...base,
      xp: newXp,
      xpToday: base.xpToday + gained,
      level: levelForXp(newXp),
      lastDate: today,
    };
    writeTree(base);
  } else {
    overLimit = true;
  }

  const notification: XpNotification = {
    id: `${dedupId}:${Date.now()}`,
    kind,
    value,
    color: XP_COLORS[kind],
    label: overLimit ? XP_LABELS.limit : XP_LABELS[kind],
    limit: overLimit,
  };

  storeState = {
    tree: base,
    notifications: [...storeState.notifications, notification].slice(-6),
  };

  emit();
}

export function dismissNotification(id: string): void {
  storeState = {
    ...storeState,
    notifications: storeState.notifications.filter((n) => n.id !== id),
  };
  emit();
}

/**
 * Reinicia el progreso del árbol: elimina el XP, el nivel, el contador
 * diario, las penalizaciones y las celebraciones guardadas (solo en este
 * dispositivo, igual que el resto del sistema de XP) y notifica a los
 * suscriptores para que el árbol vuelva a la fase inicial al instante.
 */
export function resetTree(): void {
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(TREE_KEY); } catch { /* noop */ }
    for (const key of LEGACY_TREE_KEYS) {
      try { localStorage.removeItem(key); } catch { /* noop */ }
    }
    try { localStorage.removeItem(CELEBRATED_KEY); } catch { /* noop */ }
    try { localStorage.removeItem(HABIT_PENALTY_KEY); } catch { /* noop */ }
  }
  celebrated.clear();
  storeState = { tree: emptyTree(), notifications: [] };
  emit();
}

/**
 * Penalización diaria por hábitos no completados. Se llama cuando la app se
 * abre (o cambia el día) con los hábitos y sus completados. Por cada hábito
 * que no se completó el día anterior se restan HABIT_PENALTY de XP. Se graba
 * la fecha del último día revisado para que cada día se penalice una sola vez
 * y no se pierda XP en cada recarga.
 *
 * La penalización no baja de 0 XP y el resto de recompensas siguen intactas:
 * es una resta puntual, no toca el límite diario de premios.
 */
export function applyHabitPenalty(habits: Habit[], completions: HabitCompletion[]): void {
  if (typeof window === "undefined") return;
  if (habits.length === 0) return;

  const today = todayKey();
  const yesterday = addDays(today, -1);
  const last = readPenaltyDate();

  // Ya está todo al día (no hay días pendientes de revisar).
  if (last !== null && last >= yesterday) return;

  // Primera vez: solo se penaliza ayer, no todo el histórico acumulado.
  const startDay = last === null ? yesterday : addDays(last, 1);

  // Contar hábitos no completados día a día hasta ayer inclusive.
  const missedIds = new Set<string>();
  let totalPenalty = 0;
  let cursor = startDay;
  while (cursor <= yesterday) {
    const doneToday = new Set(
      completions.filter((c) => c.completed_on === cursor).map((c) => c.habit_id),
    );
    for (const habit of habits) {
      if (!doneToday.has(habit.id)) {
        missedIds.add(habit.id);
        totalPenalty += HABIT_PENALTY;
      }
    }
    cursor = addDays(cursor, 1);
  }

  // Marcar el día como revisado aunque no haya penalización, para no repetir.
  writePenaltyDate(yesterday);

  if (totalPenalty <= 0) return;

  const current = storeState.tree;
  const newXp = Math.max(0, current.xp - totalPenalty);
  const base = { ...current, xp: newXp, level: levelForXp(newXp) };
  writeTree(base);

  const notification: XpNotification = {
    id: `penalty:${yesterday}:${Date.now()}`,
    kind: "habit",
    value: totalPenalty,
    color: "#dc2626",
    label:
      missedIds.size === 1
        ? "Hábito no completado"
        : `${missedIds.size} hábitos no completados`,
    limit: false,
    penalty: true,
  };

  storeState = {
    tree: base,
    notifications: [...storeState.notifications, notification].slice(-6),
  };
  emit();
}

/**
 * Hook de lectura. XpToast y ProgressTree lo usan para ver el árbol y las
 * notificaciones. Se actualiza al instante porque awardXp() notifica a todos
 * los suscriptores.
 */
export function useXpSystem() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const dismiss = useCallback((id: string) => dismissNotification(id), []);

  return {
    tree: state.tree,
    notifications: state.notifications,
    dismissNotification: dismiss,
  };
}
