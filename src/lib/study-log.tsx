"use client";

import { useMemo, useSyncExternalStore } from "react";
import { todayKey } from "@/lib/format";

/**
 * Registro de estudio compartido por cuenta.
 *
 * Cada pomodoro de trabajo completado añade una sesión aquí: cuántos minutos y
 * a qué tarea (o a ninguna). De este único registro salen todas las métricas
 * de estudio: minutos totales, de hoy, de la semana y por tarea.
 *
 * Se sincroniza con la nube (tabla `study_sessions`, migración 00018) para que
 * lo estudiado en el ordenador se vea en el móvil de la misma cuenta. El
 * registro es de SOLO-AÑADIR y cada sesión lleva un id generado aquí, así que
 * la fusión es idempotente: subir o bajar lo mismo dos veces no duplica nada.
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

// ─── Sincronización con la nube ──────────────────────────────────────────────
//
// El registro es de solo-añadir, así que se sincroniza con dos cursores:
//   · `pulledUpTo`: hasta qué instante (completedAt) ya se leyó de la nube.
//   · `pushedUpTo`: hasta qué instante ya está subido.
// Cada dispositivo lleva los suyos; el id de cada sesión evita duplicados al
// fusionar. Así lo estudiado en el ordenador aparece en el móvil (y al revés)
// sin reenviar el historial entero cada vez.

const SYNC_API = "/api/study/sessions";
const SYNC_STATE_KEY = "nucleo:study-log:sync:v1";
/** Solape al pedir novedades: si algo se subía mientras se pedía, vuelve otra vez. */
const PULL_OVERLAP_MS = 12 * 60 * 60 * 1000;

interface SyncState {
  pushedUpTo: string | null;
  pulledUpTo: string | null;
}

const EMPTY_SYNC_STATE: SyncState = { pushedUpTo: null, pulledUpTo: null };

function readSyncState(): SyncState {
  if (typeof window === "undefined") return EMPTY_SYNC_STATE;
  try {
    const parsed = JSON.parse(
      localStorage.getItem(SYNC_STATE_KEY) ?? "null",
    ) as Partial<SyncState> | null;
    return {
      pushedUpTo: typeof parsed?.pushedUpTo === "string" ? parsed.pushedUpTo : null,
      pulledUpTo: typeof parsed?.pulledUpTo === "string" ? parsed.pulledUpTo : null,
    };
  } catch {
    return EMPTY_SYNC_STATE;
  }
}

function writeSyncState(state: SyncState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignorar errores de acceso.
  }
}

/** Convierte las sesiones de la API en sesiones del registro (o descarta lo raro). */
function parseRemoteSessions(raw: unknown): StudySession[] {
  if (!Array.isArray(raw)) return [];
  const out: StudySession[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const s = item as Record<string, unknown>;
    if (
      typeof s.id !== "string" ||
      typeof s.minutes !== "number" ||
      typeof s.date !== "string" ||
      typeof s.completedAt !== "string"
    ) {
      continue;
    }
    out.push({
      id: s.id,
      taskId: typeof s.taskId === "string" && s.taskId ? s.taskId : null,
      minutes: s.minutes,
      date: s.date,
      completedAt: s.completedAt,
    });
  }
  return out;
}

/** Instante más reciente de una lista no vacía de sesiones. */
function latestCompletedAt(sessions: readonly StudySession[]): string {
  return sessions.reduce(
    (max, s) => (s.completedAt > max ? s.completedAt : max),
    sessions[0].completedAt,
  );
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
/** `startStudyLogSync` se ejecuta una sola vez por carga de la app. */
let syncStarted = false;

/** Sube las sesiones que la nube todavía no tiene. */
async function pushStudySessions(): Promise<void> {
  const { pushedUpTo } = readSyncState();
  const pending = pushedUpTo
    ? storeSessions.filter((s) => s.completedAt > pushedUpTo)
    : [...storeSessions];
  if (pending.length === 0) return;

  try {
    const res = await fetch(SYNC_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessions: pending }),
    });
    if (!res.ok) return;
  } catch {
    return;
  }

  // El cursor solo avanza cuando el servidor ha confirmado: si la subida falla
  // (sin red, sesión caducada…), la próxima sincronización las reintenta.
  writeSyncState({ ...readSyncState(), pushedUpTo: latestCompletedAt(pending) });
}

/** Sube lo nuevo con un pequeño retardo para agrupar ráfagas de pomodoros. */
function schedulePush(): void {
  if (typeof window === "undefined") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushStudySessions();
  }, 600);
}

/**
 * Fusiona el registro local con el de la nube: baja lo estudiado en otros
 * dispositivos y sube lo de este. Se llama al abrir la app y cada vez que
 * vuelve a primer plano. Sin sesión (401) o sin red se queda lo local.
 */
export async function syncStudyLog(): Promise<void> {
  if (typeof window === "undefined") return;
  const state = readSyncState();

  const since = state.pulledUpTo
    ? new Date(
        new Date(state.pulledUpTo).getTime() - PULL_OVERLAP_MS,
      ).toISOString()
    : null;
  let remote: StudySession[] = [];
  try {
    const res = await fetch(
      `${SYNC_API}${since ? `?since=${encodeURIComponent(since)}` : ""}`,
    );
    if (!res.ok) return;
    const payload = (await res.json()) as { sessions?: unknown } | null;
    remote = parseRemoteSessions(payload?.sessions);
  } catch {
    return;
  }

  if (remote.length > 0) {
    // La fusión por id es idempotente: el solape y los reintentos no duplican.
    const byId = new Map<string, StudySession>();
    for (const s of storeSessions) byId.set(s.id, s);
    for (const s of remote) byId.set(s.id, s);
    const merged = [...byId.values()]
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt))
      .slice(-STORAGE_LIMIT);
    storeSessions = merged;
    writeSessions(merged);
    writeSyncState({ ...readSyncState(), pulledUpTo: latestCompletedAt(remote) });
    emit();
  } else if (state.pulledUpTo === null) {
    // Primera sincronización con la nube vacía: se marca el punto de partida
    // para no volver a pedir el historial entero en cada apertura.
    writeSyncState({ ...readSyncState(), pulledUpTo: new Date().toISOString() });
  }

  await pushStudySessions();
}

/**
 * Arranca la sincronización del registro: una fusión al montar y otra cada vez
 * que la app vuelve a primer plano. Idempotente (React puede montar dos veces).
 */
export function startStudyLogSync(): void {
  if (typeof window === "undefined" || syncStarted) return;
  syncStarted = true;
  void syncStudyLog();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void syncStudyLog();
  });
}

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
  // El tiempo estudiado es compartido: viaja a la nube (con retardo, agrupado).
  schedulePush();
  return session;
}

/**
 * Borra todo el historial de estudio. Se usa en "Restablecer todo": limpia
 * también la nube, o el registro volvería al abrir la app en otro dispositivo.
 */
export function resetStudyLog(): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar errores de acceso.
    }
    try {
      localStorage.removeItem(SYNC_STATE_KEY);
    } catch {
      // Ignorar errores de acceso.
    }
  }
  storeSessions = [];
  emit();
  void fetch(SYNC_API, { method: "DELETE" }).catch(() => {
    // Sin red o sin sesión: la nube se quedará como estaba.
  });
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
