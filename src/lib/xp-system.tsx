"use client";

import { useCallback, useSyncExternalStore } from "react";
import { effectiveXpCap } from "@/lib/xp-cap";
import { formatDuration, todayKey } from "@/lib/format";
import { SLEEP_LEVEL_LABEL, sleepLevel, type SleepLevel } from "@/lib/sleep";
import type { Habit, HabitCompletion } from "@/lib/types";

// ─── Constantes ─────────────────────────────────────────────────────────────

// La XP va ligada al TIEMPO invertido, no a completar la tarea: cada pomodoro
// de trabajo completado da 10 XP (una tarea de 3 h da mucho más que una de 10
// min porque acumula más pomodoros). `task` se conserva para el tipo y los
// colores, pero ya no se otorga al marcar una tarea como hecha.
export const XP_REWARDS = { task: 20, pomodoro: 10, habit: 5, sleep: 15 } as const;

/**
 * XP del módulo de Sueño según el cumplimiento del objetivo de horas
 * (mismos niveles que usan las gráficas, para que color y XP coincidan):
 *   perfect (verde)  → +15    partial (amarillo) → +5
 *   low     (naranja) → 0     bad     (rojo)     → −5
 */
export const SLEEP_XP: Record<SleepLevel, number> = {
  perfect: 15,
  partial: 5,
  low: 0,
  bad: -5,
};

/** XP que se resta por cada hábito no completado el día anterior. */
export const HABIT_PENALTY = 15;

export const XP_COLORS = { task: "#16a34a", pomodoro: "#ea580c", habit: "#0ea5e9", sleep: "#7c3aed" } as const;
export const XP_LABELS = {
  task: "Tarea completada",
  pomodoro: "Pomodoro completado",
  habit: "Hábito completado",
  sleep: "Noche registrada",
  limit: "Límite diario alcanzado",
} as const;

export const LEVELS = [
  { name: "Brote", article: "un", subtitle: "0 - 100 XP", required: 0, emoji: "🌱" },
  { name: "Planta joven", article: "una", subtitle: "101 - 300 XP", required: 101, emoji: "🌿" },
  { name: "Árbol mediano", article: "un", subtitle: "301 - 650 XP", required: 301, emoji: "🌳" },
  { name: "Árbol grande", article: "un", subtitle: "651 - 1200 XP", required: 651, emoji: "🌲" },
  { name: "Secuoya final", article: "una", subtitle: "1201+ XP", required: 1201, emoji: "🌲" },
] as const;

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type XpNotification = {
  id: string;
  kind: "task" | "habit" | "pomodoro" | "sleep";
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
  /**
   * Último total que este dispositivo sabe que está guardado en la nube.
   * `null` = este dispositivo todavía no ha sincronizado nunca el árbol (ver
   * `syncTreeProgress`).
   */
  syncedXp: number | null;
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

// Los eventos irrepetibles (tareas completadas y noches de sueño) se premian
// UNA sola vez en la vida del dispositivo, no una vez al día. Antes las tareas
// se deduplicaban por día y además había un detector que miraba `updated_at`
// para "recuperar" tareas completadas: como el trigger `tasks_set_updated_at`
// de Supabase reescribe esa fecha en cada sincronización, al abrir la app todas
// las tareas ya hechas volvían a parecer completadas hoy y regalaban su XP otra
// vez. Este registro va aparte y nunca se recorta por día.
// (La clave de almacenamiento conserva el nombre original para no perder el
// registro ya guardado en los dispositivos que usan la app.)
const TASK_CREDITS_KEY = "nucleo:xp-task-credits:v1";
/** Tope del registro de eventos irrepetibles (FIFO: se descartan los más viejos). */
const TASK_CREDITS_LIMIT = 2000;

// Última fase cuyo aviso de crecimiento ya se mostró al abrir el árbol. Se
// guarda por separado del XP para que el aviso salga solo la primera vez que
// se abre el panel en cada fase nueva, aunque la app se haya recargado.
const SEEN_LEVEL_KEY = "nucleo:tree-seen-level:v1";

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
  return { xp: 0, level: 0, xpToday: 0, lastDate: yesterdayKey(), syncedXp: null };
}

function readTree(): SavedTree {
  if (typeof window === "undefined") return emptyTree();

  // Forma normalizada para cualquier versión guardada.
  const normalize = (parsed: Partial<SavedTree>): SavedTree => ({
    xp: typeof parsed.xp === "number" ? parsed.xp : 0,
    level: typeof parsed.level === "number" ? parsed.level : levelForXp(parsed.xp ?? 0),
    xpToday: parsed.xpToday ?? 0,
    lastDate: parsed.lastDate ?? yesterdayKey(),
    syncedXp: typeof parsed.syncedXp === "number" ? parsed.syncedXp : null,
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

/** Eventos (tareas y noches) cuyo XP ya se otorgó una sola vez. */
function readTaskCredits(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem(TASK_CREDITS_KEY) ?? "[]") as unknown;
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [],
    );
  } catch { return new Set(); }
}

function writeTaskCredits(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TASK_CREDITS_KEY, JSON.stringify([...set].slice(-TASK_CREDITS_LIMIT)));
  } catch { /* noop */ }
}

/** Última fase cuyo aviso de crecimiento ya se mostró (0 si nunca). */
export function readSeenLevel(): number {
  if (typeof window === "undefined") return 0;
  try {
    const parsed = Number(localStorage.getItem(SEEN_LEVEL_KEY));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  } catch { return 0; }
}

export function writeSeenLevel(level: number): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SEEN_LEVEL_KEY, String(level)); } catch { /* noop */ }
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
const taskCredits: Set<string> = typeof window !== "undefined" ? readTaskCredits() : new Set();

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

// ─── Sincronización con la nube ──────────────────────────────────────────────
//
// El XP es un contador COMPARTIDO por cuenta: la nube guarda un único total por
// usuario (`tree_progress`) y aquí solo viaja el DELTA ganado en este
// dispositivo desde la última subida correcta (`syncedXp`). Antes cada
// dispositivo subía su total local y el último en abrir la app borraba el del
// otro, así que el XP no viajaba entre el móvil y el ordenador.
//
// Con el delta, dos dispositivos no se pisan (lo ganado en uno se suma a lo que
// ya había) y las penalizaciones también se propagan, porque van dentro del
// delta aunque no sean eventos.

const TREE_API = "/api/tree/progress";
/** Avisos compartidos de tareas completadas en otros dispositivos. */
const XP_EVENTS_API = "/api/xp/events";

let uploadTimer: ReturnType<typeof setTimeout> | null = null;
/** `startXpSync` se ejecuta una sola vez por carga de la app. */
let syncStarted = false;

/** Sube el total actual de este dispositivo. Al confirmarse, queda sincronizado. */
async function uploadTree(): Promise<boolean> {
  const uploaded = storeState.tree.xp;
  try {
    const res = await fetch(TREE_API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xp: uploaded, level: levelForXp(uploaded) }),
    });
    if (!res.ok) return false;
  } catch {
    return false;
  }
  // Se relee el árbol VIVO: puede haber ganado XP mientras la petición iba en
  // camino, y eso todavía no está en la nube.
  const next: SavedTree = { ...storeState.tree, syncedXp: uploaded };
  writeTree(next);
  storeState = { ...storeState, tree: next };
  return true;
}

/** Sube el XP con un pequeño retardo para agrupar ráfagas de premios. */
function scheduleUpload(): void {
  if (typeof window === "undefined") return;
  if (uploadTimer) clearTimeout(uploadTimer);
  uploadTimer = setTimeout(() => {
    uploadTimer = null;
    void uploadTree();
  }, 600);
}

/**
 * Fusiona el XP local con el de la nube. Se llama al abrir la app y cada vez
 * que vuelve a primer plano, así el XP ganado en el ordenador aparece en el
 * móvil en cuanto se abre. Sin sesión (401) o sin red se queda lo local.
 */
export async function syncTreeProgress(): Promise<void> {
  if (typeof window === "undefined") return;
  let remoteXp: number;
  try {
    const res = await fetch(TREE_API);
    if (!res.ok) return;
    const payload = (await res.json()) as { xp?: unknown } | null;
    const xp = payload?.xp;
    remoteXp =
      typeof xp === "number" && Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  } catch {
    return;
  }

  const local = storeState.tree;
  const base =
    local.syncedXp === null
      // Primer contacto de este dispositivo con la nube: se fusiona tomando el
      // mayor, para no sumar dos veces el mismo trabajo hecho antes de que
      // existiera la sincronización (cada dispositivo ya tenía su XP propio).
      ? Math.max(local.xp, remoteXp)
      // Ya sincronizado alguna vez: encima del total remoto solo va lo ganado
      // (o restado) aquí desde la última subida correcta.
      : Math.max(0, remoteXp + (local.xp - local.syncedXp));

  if (base !== local.xp) {
    const next: SavedTree = { ...local, xp: base, level: levelForXp(base) };
    writeTree(next);
    storeState = { ...storeState, tree: next };
    emit();
  }
  // Deja la nube y `syncedXp` al día con el resultado de la fusión.
  await uploadTree();
}

// ─── Avisos de tareas completadas en otros dispositivos ──────────────────────
//
// El XP del árbol ya viaja por deltas, pero un aviso ("+20 XP · Tarea
// completada") es un ACONTECIMIENTO, no un total: para poder mostrarlo en el
// móvil después de completar la tarea en el ordenador hay que dejar constancia
// compartida. Se anota en `tree_xp_events` a través de /api/xp/events (ver esa
// ruta: NO suma XP allí) y cada dispositivo avisa de lo que aún no conocía.

/** Último aviso remoto ya visto por ESTE dispositivo (ISO). */
const REMOTE_SEEN_KEY = "nucleo:xp-remote-seen:v1";

interface RemoteTaskEvent {
  taskId: string;
  xp: number;
  createdAt: string;
}

/**
 * Anota en la nube que esta tarea se ha completado, para que el resto de
 * dispositivos puedan avisar de ello. No suma XP: el total del árbol viaja
 * aparte con `uploadTree`.
 */
function publishTaskCompletion(taskId: string, xp: number): void {
  void fetch(XP_EVENTS_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, xp }),
  }).catch(() => {
    // Sin red: los otros dispositivos no verán el aviso (el XP sí llega).
  });
}

function readRemoteSeen(): string | null {
  if (typeof window === "undefined") return null;
  try { return localStorage.getItem(REMOTE_SEEN_KEY); } catch { return null; }
}

function writeRemoteSeen(iso: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(REMOTE_SEEN_KEY, iso); } catch { /* noop */ }
}

function parseRemoteEvents(raw: unknown): RemoteTaskEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: RemoteTaskEvent[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const xp = Number(e.xp);
    if (
      typeof e.taskId !== "string" ||
      !e.taskId ||
      typeof e.createdAt !== "string" ||
      !Number.isFinite(xp)
    ) {
      continue;
    }
    events.push({ taskId: e.taskId, xp: Math.max(0, Math.round(xp)), createdAt: e.createdAt });
  }
  return events;
}

/**
 * Muestra los avisos de tareas completadas en otro dispositivo (mensajito
 * dentro de la app, sin tocar la XP: en el dispositivo donde se completó ya se
 * otorgó, y aquí llega dentro del total al fusionar).
 */
async function syncRemoteCelebrations(): Promise<void> {
  if (typeof window === "undefined") return;
  const cursor = readRemoteSeen();

  let events: RemoteTaskEvent[];
  let serverNow: string | null;
  try {
    const res = await fetch(
      `${XP_EVENTS_API}${cursor ? `?since=${encodeURIComponent(cursor)}` : ""}`,
    );
    if (!res.ok) return;
    const payload = (await res.json()) as { events?: unknown; now?: unknown } | null;
    events = parseRemoteEvents(payload?.events);
    serverNow = typeof payload?.now === "string" ? payload.now : null;
  } catch {
    return;
  }

  // Primera consulta de este dispositivo: solo se marca el punto de partida
  // (un móvil recién instalado no debe soltar un aluvión con todo lo completado
  // desde siempre). Si todavía no hay eventos, se usa el reloj del servidor;
  // así el primer aviso de verdad sí se ve.
  if (cursor === null) {
    const baseline =
      events.length > 0
        ? events.reduce((max, e) => (e.createdAt > max ? e.createdAt : max), events[0].createdAt)
        : (serverNow ?? new Date().toISOString());
    writeRemoteSeen(baseline);
    return;
  }

  if (events.length === 0) return;

  const newest = events.reduce(
    (max, e) => (e.createdAt > max ? e.createdAt : max),
    events[0].createdAt,
  );

  const fresh = events.filter((e) => !taskCredits.has(`task:${e.taskId}`));
  writeRemoteSeen(newest);
  if (fresh.length === 0) return;

  const notifications: XpNotification[] = fresh.map((e) => {
    // Se apunta como evento conocido para no repetir el aviso en cada apertura
    // (ni volver a premiar esa tarea aquí).
    taskCredits.add(`task:${e.taskId}`);
    return {
      id: `remote:task:${e.taskId}:${e.createdAt}`,
      kind: "task",
      value: e.xp,
      color: XP_COLORS.task,
      label: "Completada en otro dispositivo",
      limit: false,
    };
  });
  writeTaskCredits(taskCredits);

  storeState = {
    ...storeState,
    notifications: [...storeState.notifications, ...notifications].slice(-6),
  };
  emit();
}

/**
 * Arranca la sincronización del XP: una fusión al montar y otra cada vez que
 * la app vuelve a primer plano. Idempotente (React puede montar dos veces).
 */
export function startXpSync(): void {
  if (typeof window === "undefined" || syncStarted) return;
  syncStarted = true;
  void syncTreeProgress();
  void syncRemoteCelebrations();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void syncTreeProgress();
      void syncRemoteCelebrations();
    }
  });
}

// ─── API pública ─────────────────────────────────────────────────────────────

export type XpKind = keyof typeof XP_REWARDS;

/** Opciones de un premio puntual (sueño con valor variable o penalización). */
export interface AwardXpOptions {
  /** XP a otorgar (o a restar, si `penalty` es true). Por defecto XP_REWARDS[kind]. */
  value?: number;
  /** true para RESTAR XP (noche muy por debajo del objetivo). */
  penalty?: boolean;
  /** Texto del aviso, para explicar el valor obtenido. */
  label?: string;
}

/**
 * Otorga XP y emite un toast. Se llama DIRECTAMENTE desde el manejador de la
 * acción (toggleTaskDone, addGrade(s), toggleHabit, saveSleepLog).
 *
 * Deduplicación por acción:
 * - Tareas y noches de sueño: una única vez por evento, para siempre (registro
 *   permanente). Aunque algo vuelva a pedirlo (recarga, sincronización, otro
 *   dispositivo), aquí no se otorga ni se muestra aviso.
 * - Hábitos y Pomodoro: una vez por evento y día (el mismo hábito cuenta cada
 *   día, pero no dos veces el mismo día).
 */
export function awardXp(
  kind: XpKind,
  eventId: string,
  options: AwardXpOptions = {},
): void {
  const today = todayKey();
  const penalized = options.penalty === true;

  if (kind === "task" || kind === "sleep") {
    // Eventos irrepetibles: el id del evento ya identifica la noche o la tarea.
    const onceId = `${kind}:${eventId}`;
    if (taskCredits.has(onceId)) return;
    taskCredits.add(onceId);
    writeTaskCredits(taskCredits);
  } else {
    const dedupId = `${kind}:${today}:${eventId}`;
    // Ya premiado hoy: no duplicar ni avisar.
    if (celebrated.has(dedupId)) return;
    celebrated.add(dedupId);
    writeCelebrated(celebrated);
  }

  const current = storeState.tree;

  // Reiniciar el contador diario si cambió el día.
  let base = current;
  if (base.lastDate !== today) {
    base = { ...base, xpToday: 0, lastDate: today };
  }

  const value = options.value ?? XP_REWARDS[kind];
  let gained = value;
  let overLimit = false;

  if (penalized) {
    // Las penalizaciones restan XP, no consumen el tope diario y nunca dejan
    // el árbol por debajo de 0.
    const newXp = Math.max(0, base.xp - value);
    gained = base.xp - newXp;
    base = { ...base, xp: newXp, level: levelForXp(newXp) };
    writeTree(base);
  } else if (base.xpToday < effectiveXpCap()) {
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
    id: `${kind}:${today}:${eventId}:${Date.now()}`,
    kind,
    value: penalized ? gained : value,
    color: penalized ? "#dc2626" : XP_COLORS[kind],
    label:
      options.label ?? (overLimit ? XP_LABELS.limit : XP_LABELS[kind]),
    limit: overLimit,
    penalty: penalized || undefined,
  };

  storeState = {
    tree: base,
    notifications: [...storeState.notifications, notification].slice(-6),
  };

  emit();
  // El XP es compartido: cada premio viaja a la nube (con retardo, agrupado).
  scheduleUpload();
  // Y las tareas completadas se anuncian a los demás dispositivos de la cuenta.
  if (kind === "task") publishTaskCompletion(eventId, value);
}

/**
 * Premia (o penaliza) una noche de sueño según el objetivo de horas del
 * usuario. Se llama al guardar el registro de esa noche; la deduplicación por
 * fecha garantiza que una misma noche solo puntúa una vez.
 */
export function evaluateSleepXp(
  dateKeyStr: string,
  hours: number,
  targetHours: number,
): void {
  const level = sleepLevel(hours, targetHours);
  const xp = SLEEP_XP[level];
  awardXp("sleep", dateKeyStr, {
    value: Math.abs(xp),
    penalty: xp < 0,
    label: `${SLEEP_LEVEL_LABEL[level]} · ${formatDuration(Math.round(hours * 60))} de ${targetHours} h`,
  });
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
 * diario, las penalizaciones y las celebraciones guardadas, lo propaga a la
 * nube (para que no vuelva al abrir la app en otro dispositivo) y notifica a
 * los suscriptores para que el árbol vuelva a la fase inicial al instante.
 */
export function resetTree(): void {
  if (typeof window !== "undefined") {
    try { localStorage.removeItem(TREE_KEY); } catch { /* noop */ }
    for (const key of LEGACY_TREE_KEYS) {
      try { localStorage.removeItem(key); } catch { /* noop */ }
    }
    try { localStorage.removeItem(CELEBRATED_KEY); } catch { /* noop */ }
    try { localStorage.removeItem(TASK_CREDITS_KEY); } catch { /* noop */ }
    try { localStorage.removeItem(HABIT_PENALTY_KEY); } catch { /* noop */ }
    try { localStorage.removeItem(SEEN_LEVEL_KEY); } catch { /* noop */ }
    try { localStorage.removeItem(REMOTE_SEEN_KEY); } catch { /* noop */ }
  }
  celebrated.clear();
  // Se vacía también el registro de tareas para que, tras reiniciar el
  // progreso, volver a completarlas vuelva a dar XP desde cero.
  taskCredits.clear();
  // `syncedXp: 0` (y no `null`) porque el reinicio también se propaga a la
  // nube: así el XP no vuelve al abrir la app en este ni en otro dispositivo.
  const reset: SavedTree = { ...emptyTree(), syncedXp: 0 };
  writeTree(reset);
  storeState = { tree: reset, notifications: [] };
  emit();
  void uploadTree();
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
  scheduleUpload();
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
