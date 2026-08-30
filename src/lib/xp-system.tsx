"use client";

import { useCallback, useSyncExternalStore } from "react";
import { effectiveXpCap } from "@/lib/xp-cap";
import { todayKey } from "@/lib/format";

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
  kind: "task" | "habit" | "pomodoro";
  value: number;
  color: string;
  label: string;
  limit: boolean;
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

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
