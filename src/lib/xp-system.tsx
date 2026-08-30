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
  xpToday: number;
  lastDate: string;
};

type XpSystem = {
  tree: SavedTree;
  notifications: XpNotification[];
  dismissNotification: (id: string) => void;
};

const XpContext = createContext<XpSystem>({
  tree: { xp: 0, level: 0, xpToday: 0, lastDate: "" },
  notifications: [],
  dismissNotification: () => {},
});

// ─── Hook público ─────────────────────────────────────────────────────────────

export function useXpSystem(): XpSystem {
  return useContext(XpContext);
}

export function levelForXp(xp: number): number {
  return Math.max(0, LEVELS.reduce((current, item, index) => (xp >= item.required ? index : current), 0));
}

// ─── Almacenamiento ──────────────────────────────────────────────────────────

const TREE_KEY = "nucleo:progress-tree:v7";
const CELEBRATED_KEY = "nucleo:xp-celebrated:v3";
const POMODORO_KEY = "nucleo:pomodoro-completions:v1";

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyTree(): SavedTree {
  return { xp: 0, level: 0, xpToday: 0, lastDate: yesterdayKey() };
}

function readTree(): SavedTree {
  if (typeof window === "undefined") return emptyTree();
  try {
    const parsed = JSON.parse(localStorage.getItem(TREE_KEY) ?? "null") as Partial<SavedTree> | null;
    if (parsed && typeof parsed.xp === "number") {
      return {
        xp: parsed.xp ?? 0,
        level: parsed.level ?? 0,
        xpToday: parsed.xpToday ?? 0,
        lastDate: parsed.lastDate ?? yesterdayKey(),
      };
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

// ─── Provider: motor + estado ─────────────────────────────────────────────────

type DataSnapshot = ReturnType<typeof useData>["data"];

export function XpProvider({ children }: { children: ReactNode }) {
  const { data } = useData();
  const [tree, setTree] = useState<SavedTree>(() => readTree());
  const [notifications, setNotifications] = useState<XpNotification[]>([]);

  // Refs persistentes entre renders para detectar transiciones.
  const prevTaskStatus = useRef<Map<string, string>>(new Map());
  const prevHabitKeys = useRef<Set<string>>(new Set());
  const prevPomodoroCount = useRef(0);
  const celebrated = useRef<Set<string>>(readCelebratedToday());

  // Sumar XP respetando el límite diario.
  const addXp = useCallback((value: number): { overLimit: boolean } => {
    const today = todayKey();
    setTree((prev) => {
      // Resetear xpToday si cambió el día.
      const current = prev.lastDate !== today
        ? { ...prev, xpToday: 0, lastDate: today }
        : prev;

      if (current.xpToday >= effectiveXpCap()) {
        return { ...current, level: levelForXp(current.xp) };
      }

      const spaceLeft = effectiveXpCap() - current.xpToday;
      const gained = Math.min(value, spaceLeft);
      const newXp = current.xp + gained;
      const newXpToday = current.xpToday + gained;

      const next = {
        ...current,
        xp: newXp,
        xpToday: newXpToday,
        level: levelForXp(newXp),
        lastDate: today,
      };
      writeTree(next);
      return next;
    });
    // No podemos saber el overLimit exacto aquí porque setTree es async,
    // pero lo calculamos con el tree actual.
    return { overLimit: false };
  }, []);

  // Procesar eventos cuando cambian los datos.
  useEffect(() => {
    const today = todayKey();
    const newNotifications: XpNotification[] = [];
    console.log("[XP-DEBUG] useEffect disparado", {
      tasks: data.tasks.length,
      habits: data.habitCompletions.length,
      prevTasks: prevTaskStatus.current.size,
      prevHabits: prevHabitKeys.current.size,
    });

    // ── 1. Detectar tareas que pasaron a "done" ──────────────────────
    const currentStatus = new Map<string, string>();
    for (const task of data.tasks) {
      currentStatus.set(task.id, task.status);

      const wasNotDone = prevTaskStatus.current.get(task.id) !== "done";
      const isDoneNow = task.status === "done";
      const isToday = localDayKey(task.updated_at) === today;

      if (isDoneNow && wasNotDone && isToday && task.type !== "study_session") {
        console.log("[XP-DEBUG] ✅ Tarea completada detectada", { id: task.id, title: task.title });
        const eventId = `task:${today}:${task.id}`;
        if (!celebrated.current.has(eventId)) {
          celebrated.current.add(eventId);
          addXp(XP_REWARDS.task);
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
    prevTaskStatus.current = currentStatus;

    // ── 2. Detectar Pomodoros nuevos ──────────────────────────────────
    const pomodoros = getPomodoroCompletionsToday();
    if (pomodoros.length !== prevPomodoroCount.current) {
      for (const completion of pomodoros) {
        if (!celebrated.current.has(completion)) {
          celebrated.current.add(completion);
          addXp(XP_REWARDS.pomodoro);
          newNotifications.push({
            id: `${completion}:${Date.now()}`,
            value: XP_REWARDS.pomodoro,
            color: XP_COLORS.pomodoro,
            label: XP_LABELS.pomodoro,
            limit: false,
          });
        }
      }
    }
    prevPomodoroCount.current = pomodoros.length;

    // ── 3. Detectar hábitos completados nuevos ────────────────────────
    const nextHabitKeys = new Set<string>();
    for (const completion of data.habitCompletions) {
      const key = `${completion.habit_id}:${completion.completed_on}`;
      nextHabitKeys.add(key);

      if (completion.completed_on === today && !prevHabitKeys.current.has(key)) {
        console.log("[XP-DEBUG] ✅ Hábito completado detectado", { id: completion.habit_id });
        const eventId = `habit:${today}:${completion.habit_id}`;
        if (!celebrated.current.has(eventId)) {
          celebrated.current.add(eventId);
          addXp(XP_REWARDS.habit);
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
    prevHabitKeys.current = nextHabitKeys;

    // ── 4. Guardar y emitir ───────────────────────────────────────────
    if (newNotifications.length > 0) {
      console.log("[XP-DEBUG] Emitiendo notificaciones", newNotifications.length, newNotifications);
      writeCelebratedToday(celebrated.current);
      setNotifications((prev) => [...prev, ...newNotifications.slice(0, 5)]);
    } else {
      console.log("[XP-DEBUG] No hay notificaciones nuevas");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tasks, data.habitCompletions, data.workouts, data.habits]);

  // Poll localStorage para Pomodoros cada 1s.
  useEffect(() => {
    const interval = setInterval(() => {
      const pomodoros = getPomodoroCompletionsToday();
      if (pomodoros.length !== prevPomodoroCount.current) {
        const today = todayKey();
        const newNotifications: XpNotification[] = [];
        for (const completion of pomodoros) {
          if (!celebrated.current.has(completion)) {
            celebrated.current.add(completion);
            addXp(XP_REWARDS.pomodoro);
            newNotifications.push({
              id: `${completion}:${Date.now()}`,
              value: XP_REWARDS.pomodoro,
              color: XP_COLORS.pomodoro,
              label: XP_LABELS.pomodoro,
              limit: false,
            });
          }
        }
        prevPomodoroCount.current = pomodoros.length;
        if (newNotifications.length > 0) {
          writeCelebratedToday(celebrated.current);
          setNotifications((prev) => [...prev, ...newNotifications.slice(0, 5)]);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addXp]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Sincronizar con Supabase cuando cambia el XP.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/tree/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xp: tree.xp, level: tree.level }),
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [tree.xp, tree.level]);

  const value = useMemo<XpSystem>(
    () => ({ tree, notifications, dismissNotification }),
    [tree, notifications, dismissNotification]
  );

  return <XpContext.Provider value={value}>{children}</XpContext.Provider>;
}

// ─── Componente motor (compatibilidad: ya no hace nada, lo hace el Provider) ─

export function XpEngine() {
  // El motor ahora vive dentro de XpProvider. Este componente existe solo
  // para compatibilidad con AppShell, pero no hace nada.
  return null;
}
