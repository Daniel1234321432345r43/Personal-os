/**
 * Borrados que viajan entre dispositivos ("lápidas") y fusión por fecha.
 *
 * El problema: la sincronización es "estado local ∪ nube" por id y cada
 * dispositivo sube su estado completo. Un móvil que borra 3 tareas las quita de
 * Supabase, pero el ordenador conserva su copia en caché, la vuelve a fusionar
 * (la unión la devuelve) y la sube otra vez: el borrado resucita y al final los
 * dos dispositivos creen que las tareas siguen existiendo.
 *
 * La solución: borrar no es solo hacer desaparecer la fila, sino dejar una
 * lápida (`public.deleted_records`) que todos los dispositivos leen. Una fila
 * con lápida se descarta al fusionar Y no se vuelve a subir, así que ningún
 * dispositivo puede resucitarla. Las lápidas se propagan en vivo por Realtime.
 *
 * Una fila con lápida se descarta siempre; para volver a usar una misma clave
 * (una noche de sueño, que se identifica por fecha) hay que quitar la lápida a
 * propósito. Las demás tablas usan ids nuevos al crear, así que no chocan.
 *
 * Este módulo es puro a propósito: no depende ni de React ni de Supabase, de
 * modo que se puede probar con `node scripts/test-sync-tombstones.mjs`.
 */

/** Tablas que se sincronizan por filas y que por tanto pueden llevar lápida. */
export const SYNC_TABLES = [
  "subjects",
  "tasks",
  "notes",
  "workouts",
  "habits",
  "habit_completions",
  "transactions",
  "grades",
  "planned_expenses",
  "sleep_logs",
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

/**
 * Columna con la que se identifica cada fila. Casi todas usan `id`, pero
 * `sleep_logs` se identifica por fecha (`unique (user_id, date)`): la app nunca
 * envía el id de esa tabla, porque la fila la genera la base de datos.
 */
export const TABLE_KEY_COLUMN: Record<SyncTable, string> = {
  subjects: "id",
  tasks: "id",
  notes: "id",
  workouts: "id",
  habits: "id",
  habit_completions: "id",
  transactions: "id",
  grades: "id",
  planned_expenses: "id",
  sleep_logs: "date",
};

export function isSyncTable(value: unknown): value is SyncTable {
  return typeof value === "string" && (SYNC_TABLES as readonly string[]).includes(value);
}

/**
 * Campo del estado en memoria para cada tabla. Casi siempre coincide, pero
 * `habit_completions` se llama `habitCompletions` en la app (camelCase).
 */
export const STATE_FIELD_OF_TABLE: Record<SyncTable, string> = {
  subjects: "subjects",
  tasks: "tasks",
  notes: "notes",
  workouts: "workouts",
  habits: "habits",
  habit_completions: "habitCompletions",
  transactions: "transactions",
  grades: "grades",
  planned_expenses: "plannedExpenses",
  sleep_logs: "sleepLogs",
};

/** Un borrado pendiente de confirmar (o ya confirmado) para una fila. */
export interface TombstoneEntry {
  table: SyncTable;
  key: string;
  /** Instante (ms) del borrado, para comparar con la marca temporal de la fila. */
  deletedAt: number;
}

/** Borrado tal y como lo pide una acción (la fecha se pone sola si no se da). */
export interface DeleteInput {
  table: SyncTable;
  key: string;
  deletedAt?: number;
}

/** Completa los borrados con su instante y elimina duplicados. */
export function normalizeDeletes(inputs: readonly DeleteInput[]): TombstoneEntry[] {
  return mergePendingDeletes(
    inputs.map((input) => ({
      table: input.table,
      key: input.key,
      deletedAt: input.deletedAt ?? Date.now(),
    })),
    [],
  );
}

/** `tabla::clave` → instante del borrado (ms). */
export type TombstoneMap = Map<string, number>;

export function tombstoneKey(table: SyncTable, key: string): string {
  return `${table}::${key}`;
}

/** Clave de una fila (su `id`, o su fecha en sleep_logs). */
export function rowKey(
  table: SyncTable,
  row: Record<string, unknown> | null | undefined,
): string | null {
  if (!row) return null;
  const raw = row[TABLE_KEY_COLUMN[table]];
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (typeof raw === "number") return String(raw);
  return null;
}

/** Marca temporal de una fila en ms (`updated_at` o, si no, `created_at`). */
export function rowTimestamp(row: Record<string, unknown> | null | undefined): number | null {
  if (!row) return null;
  for (const field of ["updated_at", "created_at"] as const) {
    const raw = row[field];
    if (typeof raw === "string" && raw.length > 0) {
      const parsed = Date.parse(raw);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
}

/**
 * Anota un borrado. Si ya había lápida para esa clave se conserva la MÁS
 * reciente: si algo se borra, se vuelve a crear y se borra otra vez, la lápida
 * válida es la última.
 */
export function addTombstone(
  map: TombstoneMap,
  table: SyncTable,
  key: string,
  deletedAt: number = Date.now(),
): TombstoneMap {
  const id = tombstoneKey(table, key);
  const previous = map.get(id);
  map.set(id, previous == null ? deletedAt : Math.max(previous, deletedAt));
  return map;
}

/**
 * ¿Esta fila está borrada según las lápidas conocidas?
 *
 * Es deliberadamente estricto (no compara horas): si hay lápida para esa clave,
 * la fila está borrada, punto. Comparar la hora del borrado con la de la fila
 * dejaría la puerta abierta a que un reloj adelantado (o un dispositivo con la
 * hora mal) resucitara justo la fila que se acaba de borrar. La única forma de
 * que una clave borrada vuelva a existir es quitando su lápida a propósito
 * (ver `removeTombstone` y `reopenSleepLog` en el provider).
 */
export function isRowDeleted(
  table: SyncTable,
  row: Record<string, unknown>,
  map: TombstoneMap,
): boolean {
  const key = rowKey(table, row);
  if (key == null) return false;
  return map.has(tombstoneKey(table, key));
}

/**
 * Quita una lápida (por ejemplo al volver a registrar una noche de sueño).
 * Devuelve `true` si existía, para saber si hay que limpiarla también en la nube.
 */
export function removeTombstone(map: TombstoneMap, table: SyncTable, key: string): boolean {
  return map.delete(tombstoneKey(table, key));
}

/** Filtra las filas con lápida de una colección. */
export function filterTombstonedRows<R extends Record<string, unknown>>(
  table: SyncTable,
  rows: readonly R[],
  map: TombstoneMap,
): R[] {
  if (map.size === 0 || rows.length === 0) return rows as R[];
  return rows.filter((row) => !isRowDeleted(table, row, map));
}

/**
 * Quita del estado todas las filas con lápida. Devuelve el MISMO objeto si no
 * cambia nada, para que React no vuelva a renderizar ni se dispare otro envío a
 * la nube.
 */
export function withoutTombstonedRows<S extends object>(state: S, map: TombstoneMap): S {
  if (map.size === 0) return state;
  const changes: Record<string, unknown> = {};
  let changed = false;
  const fields = state as unknown as Record<string, unknown>;
  for (const table of SYNC_TABLES) {
    const field = STATE_FIELD_OF_TABLE[table];
    const rows = fields[field];
    if (!Array.isArray(rows)) continue;
    const kept = filterTombstonedRows(table, rows as Record<string, unknown>[], map);
    if (kept.length !== rows.length) {
      changed = true;
      changes[field] = kept;
    }
  }
  return changed ? ({ ...state, ...changes } as unknown as S) : state;
}

/**
 * Fusiona dos versiones de la misma fila. Gana la modificada más recientemente
 * (`updated_at`); si no hay marcas temporales comparables, gana la remota, como
 * antes. Sin esto, un dispositivo con la copia antigua pisaba la edición hecha
 * en el otro (las ediciones también se "deshacían" al abrir el segundo equipo).
 */
export function pickNewer<T extends object>(local: T, remote: T): T {
  const localStamp = rowTimestamp(local as Record<string, unknown>);
  const remoteStamp = rowTimestamp(remote as Record<string, unknown>);
  if (localStamp != null && remoteStamp != null && localStamp > remoteStamp) return local;
  return remote;
}

/** Filas para `upsert` en `public.deleted_records`. */
export function tombstoneRows(entries: readonly TombstoneEntry[], userId: string) {
  return entries.map((entry) => ({
    user_id: userId,
    table_name: entry.table,
    record_key: entry.key,
    deleted_at: new Date(entry.deletedAt).toISOString(),
  }));
}

/** Interpreta las filas de `public.deleted_records`. */
export function parseTombstoneRows(rows: unknown): TombstoneEntry[] {
  if (!Array.isArray(rows)) return [];
  const entries: TombstoneEntry[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (!isSyncTable(record.table_name)) continue;
    const key = record.record_key;
    if (typeof key !== "string" || key.length === 0) continue;
    const parsed = typeof record.deleted_at === "string" ? Date.parse(record.deleted_at) : NaN;
    entries.push({
      table: record.table_name,
      key,
      deletedAt: Number.isNaN(parsed) ? Date.now() : parsed,
    });
  }
  return entries;
}

/** Deduplica borrados quedándose con la fecha más reciente de cada clave. */
export function mergePendingDeletes(
  first: readonly TombstoneEntry[],
  second: readonly TombstoneEntry[],
): TombstoneEntry[] {
  const byKey = new Map<string, TombstoneEntry>();
  for (const entry of [...first, ...second]) {
    const id = tombstoneKey(entry.table, entry.key);
    const previous = byKey.get(id);
    if (!previous || entry.deletedAt > previous.deletedAt) byKey.set(id, entry);
  }
  return [...byKey.values()];
}

export function serializePendingDeletes(entries: readonly TombstoneEntry[]): string {
  return JSON.stringify(
    entries.map((entry) => ({ table: entry.table, key: entry.key, deletedAt: entry.deletedAt })),
  );
}

/** Lee la cola persistida de borrados pendientes. Tolera datos corruptos. */
export function parsePendingDeletes(raw: string | null): TombstoneEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries: TombstoneEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      if (!isSyncTable(record.table)) continue;
      if (typeof record.key !== "string" || record.key.length === 0) continue;
      const deletedAt = typeof record.deletedAt === "number" ? record.deletedAt : Date.now();
      entries.push({ table: record.table, key: record.key, deletedAt });
    }
    return mergePendingDeletes(entries, []);
  } catch {
    return [];
  }
}
