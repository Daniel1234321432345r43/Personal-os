"use client";

import { useMemo, useSyncExternalStore } from "react";
import { todayKey } from "@/lib/format";

/**
 * Registro de estudio del dispositivo.
 *
 * Cada pomodoro de trabajo completado añade una sesión aquí: cuántos minutos y
 * a qué tarea (o a ninguna). De este único registro salen todas las métricas
 * de estudio: minutos totales, de hoy, de la semana y por tarea.
 *
 * Igual que el sistema de XP, vive SOLO en este dispositivo (localStorage): no
 * forma parte del estado sincronizado con la nube, así que no necesita ni tabla
 * nueva en Supabase ni migración.
 */

const STORAGE_KEY = "nucleo:study-log:v1";
/** Tope de sesiones guardadas (FIFO: se descartan las más antiguas). */
const STORAGE_LIMIT = 5000;

export interface StudySession {
  id: string;
  /** Tarea a la que se dedicó el tiempo, o null si fue estudio sin tarea. */
  taskId: string | null;
  /** Minutos estudiados (entero positivo). */
  minutes: number;
  /** Día local en el que se completó (YYYY-MM-DD). */
  date: string;
  /** Instante ISO del registro, para desempates y orden. */
  completedAt: string;
}

// ─── Utilidades puras ────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Lunes de la semana a la que pertenece `dateKey` (YYYY-MM-DD). Se usa la misma
 * convención que el calendario: la semana empieza en lunes.
 */
export function weekStartKey(dateKey: string = todayKey()): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay(); // 0 = Domingo
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(dateKey, offset);
}

/** Suma total de minutos de las sesiones dadas. */
export function sumMinutes(sessions: readonly StudySession[]): number {
  return sessions.reduce((acc, s) => acc + s.minutes, 0);
}

/** Minutos estudiados desde `startKey` (inclusive). */
export function minutesSince(
  sessions: readonly StudySession[],
  startKey: string,
): number {
  return sumMinutes(sessions.filter((s) => s.date >= startKey));
}

/** Minutos acumulados por tarea (`taskId` → minutos). */
export function minutesByTask(
  sessions: readonly StudySession[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    if (!s.taskId) continue;
    map.set(s.taskId, (map.get(s.taskId) ?? 0) + s.minutes);
  }
  return map;
}

/** Minutos acumulados por día (`YYYY-MM-DD` → minutos). */
export function minutesByDate(
  sessions: readonly StudySession[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of sessions) {
    map.set(s.date, (map.get(s.date) ?? 0) + s.minutes);
  }
  return map;
}

// ─── Almacenamiento ──────────────────────────────────────────────────────────

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `study-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readSessions(): StudySession[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StudySession => {
      if (!item || typeof item !== "object") return false;
      const s = item as Record<string, unknown>;
      return (
        typeof s.id === "string" &&
        typeof s.minutes === "number" &&
        typeof s.date === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeSessions(sessions: readonly StudySession[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(-STORAGE_LIMIT)));
  } catch {
    // Ignorar errores de cuota o serialización.
  }
}

// ─── Store global (módulo) ───────────────────────────────────────────────────
// Mismo patrón que el sistema de XP: un único snapshot con referencia estable,
// reemplazado en cada cambio para que useSyncExternalStore detecte la novedad.

let storeSessions: StudySession[] = typeof window !== "undefined" ? readSessions() : [];

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): StudySession[] {
  return storeSessions;
}

const EMPTY_SESSIONS: StudySession[] = [];

function getServerSnapshot(): StudySession[] {
  return EMPTY_SESSIONS;
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Registra tiempo estudiado. Se llama al completar cada pomodoro de trabajo.
 * Devuelve la sesión creada (o null si no había minutos que registrar).
 */
export function logStudySession(input: {
  taskId?: string | null;
  minutes: number;
  date?: string;
}): StudySession | null {
  const minutes = Math.round(input.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;

  const session: StudySession = {
    id: newId(),
    taskId: input.taskId ?? null,
    minutes,
    date: input.date ?? todayKey(),
    completedAt: new Date().toISOString(),
  };

  storeSessions = [...storeSessions, session].slice(-STORAGE_LIMIT);
  writeSessions(storeSessions);
  emit();
  return session;
}

/** Borra todo el historial de estudio (se usa en "Restablecer todo"). */
export function resetStudyLog(): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar errores de acceso.
    }
  }
  storeSessions = [];
  emit();
}

/**
 * Hook de lectura. Devuelve las sesiones y todas las métricas derivadas, ya
 * recalculadas cuando se registra un pomodoro nuevo.
 */
export function useStudyLog() {
  const sessions = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const derived = useMemo(() => {
    const startOfWeek = weekStartKey();
    return {
      sessions,
      totalMinutes: sumMinutes(sessions),
      minutesToday: sumMinutes(sessions.filter((s) => s.date === todayKey())),
      minutesThisWeek: minutesSince(sessions, startOfWeek),
      weekStart: startOfWeek,
      byTask: minutesByTask(sessions),
      byDate: minutesByDate(sessions),
    };
  }, [sessions]);

  return derived;
}
