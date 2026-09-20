// Pruebas de src/lib/sync-tombstones.ts
// Reproduce el fallo que se veía con dos dispositivos: borras 3 tareas en el
// móvil, abres el ordenador y las 3 siguen ahí (y encima las vuelve a subir a
// Supabase), así que al volver al móvil reaparecen.
// Ejecutar: node scripts/test-sync-tombstones.mjs
import {
  TABLE_KEY_COLUMN,
  addTombstone,
  filterTombstonedRows,
  isRowDeleted,
  mergePendingDeletes,
  normalizeDeletes,
  parsePendingDeletes,
  parseTombstoneRows,
  pickNewer,
  removeTombstone,
  rowKey,
  serializePendingDeletes,
  withoutTombstonedRows,
} from "../src/lib/sync-tombstones.ts";

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}`);
  }
}

const CREATED = "2026-09-20T09:00:00.000Z";
const DELETED = Date.parse("2026-09-20T10:00:00.000Z");
const task = (id, title, stamp = CREATED) => ({
  id,
  user_id: "u1",
  title,
  created_at: stamp,
  updated_at: stamp,
});
/** Igual que `tombstoneMapFrom` del provider. */
const tombstoneMap = (entries) => {
  const map = new Map();
  for (const entry of entries) addTombstone(map, entry.table, entry.key, entry.deletedAt);
  return map;
};
/** Igual que `mergeRemote` del provider (unión por id, la más nueva gana). */
const mergeById = (local, remote) => {
  const map = new Map(local.map((row) => [row.id, row]));
  for (const row of remote) {
    const existing = map.get(row.id);
    map.set(row.id, existing ? pickNewer(existing, row) : row);
  }
  return [...map.values()];
};
/** Cómo sube el provider: se filtran las filas con lápida antes del upsert. */
const pushPayload = (table, rows, tombstones) => filterTombstonedRows(table, rows, tombstones);

console.log("\n— El escenario de los dos dispositivos —");
const cuatroTareas = ["mates", "lengua", "historia", "física"].map((s, i) => task(`t${i}`, s));
const borradas = ["t0", "t1", "t2"];
const borradoMovil = normalizeDeletes(
  borradas.map((key) => ({ table: "tasks", key, deletedAt: DELETED })),
);
const lapidas = tombstoneMap(borradoMovil);
const nubeTrasElBorrado = cuatroTareas.filter((t) => !borradas.includes(t.id));

const ordenadorAlAbrir = withoutTombstonedRows(
  { tasks: mergeById(cuatroTareas, nubeTrasElBorrado) },
  lapidas,
);
assert(
  ordenadorAlAbrir.tasks.length === 1 && ordenadorAlAbrir.tasks[0].id === "t3",
  "el ordenador que abre después ya no ve las 3 tareas borradas en el móvil",
);
const subidaOrdenador = pushPayload("tasks", ordenadorAlAbrir.tasks, lapidas);
assert(subidaOrdenador.length === 1, "y no las vuelve a subir a Supabase");
assert(
  mergeById(nubeTrasElBorrado, subidaOrdenador).length === 1,
  "en la nube siguen solo las tareas vivas (no resucita ninguna)",
);
const movilAlVolver = withoutTombstonedRows(
  { tasks: mergeById(cuatroTareas, nubeTrasElBorrado) },
  lapidas,
);
assert(
  movilAlVolver.tasks.length === 1,
  "al volver al móvil tampoco reaparecen (antes volvían las cuatro)",
);
assert(
  pushPayload("tasks", [{ id: "t0", title: "mates", created_at: CREATED }, ...subidaOrdenador], lapidas)
    .length === 1,
  "aunque se cuele una copia antigua, el envío la descarta",
);

console.log("\n— Aviso en vivo (Realtime), sin recargar —");
const movilConLaAppAbierta = { tasks: cuatroTareas };
const trasElAviso = withoutTombstonedRows(
  movilConLaAppAbierta,
  tombstoneMap(
    parseTombstoneRows([
      { table_name: "tasks", record_key: "t1", deleted_at: "2026-09-20T10:00:00.000Z" },
    ]),
  ),
);
assert(trasElAviso.tasks.length === 3, "un borrado de la nube quita la fila al instante");
assert(
  withoutTombstonedRows(movilConLaAppAbierta, new Map()) === movilConLaAppAbierta,
  "sin lápidas el estado no cambia de identidad (no hay render ni envío extra)",
);
const soloOtraFila = { tasks: [task("t9", "química")] };
assert(withoutTombstonedRows(soloOtraFila, lapidas) === soloOtraFila, "las filas sin lápida ni se tocan");

console.log("\n— Borrado total (resetAll) —");
const todoBorrado = tombstoneMap(
  normalizeDeletes([
    ...cuatroTareas.map((t) => ({ table: "tasks", key: t.id, deletedAt: DELETED })),
    { table: "subjects", key: "s1", deletedAt: DELETED },
  ]),
);
const equipoAntiguo = withoutTombstonedRows(
  { tasks: cuatroTareas, subjects: [{ id: "s1", name: "Mates", created_at: CREATED }] },
  todoBorrado,
);
assert(
  equipoAntiguo.tasks.length === 0 && equipoAntiguo.subjects.length === 0,
  "un borrado de todo no puede deshacerse desde el otro dispositivo",
);

console.log("\n— Noches de sueño: su clave es la fecha —");
assert(TABLE_KEY_COLUMN.sleep_logs === "date", "sleep_logs se identifica por fecha, no por id");
const lapidaNoche = tombstoneMap([
  { table: "sleep_logs", key: "2026-09-18", deletedAt: Date.parse("2026-09-20T11:00:00.000Z") },
]);
const nocheVieja = {
  date: "2026-09-18",
  hours: 6,
  created_at: "2026-09-19T07:00:00.000Z",
  updated_at: "2026-09-19T07:00:00.000Z",
};
const nocheNueva = {
  date: "2026-09-18",
  hours: 8,
  created_at: "2026-09-20T12:00:00.000Z",
  updated_at: "2026-09-20T12:00:00.000Z",
};
assert(rowKey("sleep_logs", nocheNueva) === "2026-09-18", "la clave de la noche es su fecha");
assert(isRowDeleted("sleep_logs", nocheVieja, lapidaNoche) === true, "la noche borrada no vuelve");
assert(
  isRowDeleted("sleep_logs", nocheNueva, lapidaNoche) === true,
  "mientras exista la lápida, la fila descartada es descartada aunque su hora sea posterior",
);
// Volver a registrar esa noche quita la lápida (reopenSleepLog en el provider).
const lapidaReabierta = new Map(lapidaNoche);
assert(
  removeTombstone(lapidaReabierta, "sleep_logs", "2026-09-18") === true,
  "registrar de nuevo la noche quita su lápida",
);
assert(
  isRowDeleted("sleep_logs", nocheNueva, lapidaReabierta) === false,
  "y entonces la noche nueva sí vuelve a sincronizarse",
);
assert(
  pushPayload("sleep_logs", [nocheNueva], lapidaReabierta).length === 1,
  "y también se sube a la nube",
);
assert(
  removeTombstone(lapidaReabierta, "sleep_logs", "2026-09-18") === false,
  "quitar dos veces la misma lápida no rompe nada",
);
assert(
  isRowDeleted("habit_completions", { id: "c1", habit_id: "h1" }, tombstoneMap([
    { table: "habit_completions", key: "c1", deletedAt: DELETED },
  ])) === true,
  "una marca de hábito desmarcada (sin fecha en la fila) no se resucita",
);

console.log("\n— Ediciones: gana la más reciente, no siempre la nube —");
const versionVieja = task("t5", "mates", CREATED);
const versionNueva = task("t5", "mates corregido", "2026-09-20T10:30:00.000Z");
assert(pickNewer(versionVieja, versionNueva).title === "mates corregido", "gana la editada después");
assert(
  pickNewer(versionNueva, versionVieja).title === "mates corregido",
  "da igual de qué lado venga la versión nueva",
);
assert(
  pickNewer({ id: "x", title: "local" }, { id: "x", title: "nube" }).title === "nube",
  "sin marcas temporales sigue ganando la nube, como antes",
);
const fusion = mergeById([versionVieja, task("t6", "lengua", CREATED)], [versionNueva, task("t7", "historia", CREATED)]);
assert(
  fusion.length === 3 && fusion.find((t) => t.id === "t5").title === "mates corregido",
  "la fusión conserva la edición nueva y no pierde ninguna fila",
);

console.log("\n— Cola de borrados pendientes —");
const cola = serializePendingDeletes([{ table: "tasks", key: "t1", deletedAt: 100 }]);
assert(parsePendingDeletes(cola)[0].key === "t1", "la cola sobrevive a un reinicio");
const deduplicada = mergePendingDeletes(
  [{ table: "tasks", key: "t1", deletedAt: 100 }],
  [{ table: "tasks", key: "t1", deletedAt: 300 }],
);
assert(
  deduplicada.length === 1 && deduplicada[0].deletedAt === 300,
  "si algo se borra dos veces manda el borrado más reciente",
);
assert(parsePendingDeletes("no es json").length === 0, "una cola corrupta no rompe la app");
assert(parsePendingDeletes(null).length === 0, "sin cola guardada no hay nada que reintentar");
assert(
  parsePendingDeletes(JSON.stringify([{ table: "inventada", key: "x" }, { table: "tasks", key: "" }])).length === 0,
  "se descartan entradas inválidas de la cola",
);
assert(
  filterTombstonedRows("tasks", [versionVieja], new Map()).length === 1,
  "sin lápidas el filtro no quita nada",
);
assert(
  pushPayload("tasks", [versionVieja, versionNueva], lapidaNoche).length === 2,
  "una lápida de sueño no afecta a las tareas",
);

console.log("");
if (failures > 0) {
  console.error(`${failures} comprobaciones han fallado.`);
  process.exit(1);
}
console.log("Todas las comprobaciones han pasado.");
