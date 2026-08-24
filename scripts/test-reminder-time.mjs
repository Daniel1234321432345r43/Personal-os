// Pruebas de supabase/functions/_shared/reminder-time.js
// Verifica que las utilidades de fecha/hora de los recordatorios no lancen
// excepciones con valores corruptos (causa del error 500 "Invalid time value").
// Ejecutar: node scripts/test-reminder-time.mjs
import {
  normalizeDate,
  normalizeTime,
  dateKeyInTz,
  zonedDateTime,
} from "../supabase/functions/_shared/reminder-time.js";

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}`);
  }
}

// --- normalizeDate -----------------------------------------------------------
assert(normalizeDate("2026-08-24") === "2026-08-24", "normalizeDate con fecha válida");
assert(
  normalizeDate("2026-08-24T14:30:00.000Z") === "2026-08-24",
  "normalizeDate recorta un ISO completo",
);
assert(normalizeDate(null) === null, "normalizeDate(null) → null");
assert(normalizeDate(undefined) === null, "normalizeDate(undefined) → null");
assert(normalizeDate("") === null, "normalizeDate('') → null");
assert(normalizeDate("2026-13-45") === null, "normalizeDate con fecha imposible → null");
assert(normalizeDate("hola") === null, "normalizeDate con texto → null");

// --- normalizeTime -----------------------------------------------------------
assert(normalizeTime("14:30") === "14:30", "normalizeTime HH:MM");
assert(normalizeTime("14:30:00") === "14:30", "normalizeTime con segundos");
assert(normalizeTime("9:05") === "09:05", "normalizeTime sin cero inicial");
assert(normalizeTime("25:00") === null, "normalizeTime hora > 23 → null");
assert(normalizeTime("14:70") === null, "normalizeTime minuto > 59 → null");
assert(normalizeTime(null) === null, "normalizeTime(null) → null");
assert(normalizeTime(undefined) === null, "normalizeTime(undefined) → null");

// --- zonedDateTime -----------------------------------------------------------
// Agosto en Madrid es UTC+2: 14:30 local = 12:30 UTC.
const d1 = zonedDateTime("2026-08-24", "14:30", "Europe/Madrid");
assert(
  d1 !== null && d1.getTime() === Date.parse("2026-08-24T12:30:00Z"),
  "zonedDateTime Madrid (UTC+2) → 12:30Z",
);
if (d1) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d1);
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  assert(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}` === "2026-08-24T14:30",
    "la hora local en Madrid es 14:30",
  );
}

// Entradas corruptas: no deben lanzar, deben devolver null.
assert(
  zonedDateTime("fecha-mala", "14:30", "Europe/Madrid") === null,
  "zonedDateTime con fecha mala → null (no lanza)",
);
assert(
  zonedDateTime("2026-08-24", "horamala", "Europe/Madrid") === null,
  "zonedDateTime con hora mala → null (no lanza)",
);
assert(
  zonedDateTime(null, null, "Europe/Madrid") === null,
  "zonedDateTime con nulls → null (no lanza)",
);
// Zona horaria inválida: no debe lanzar (respaldo UTC).
const d2 = zonedDateTime("2026-08-24", "14:30", "NoExiste/Zona");
assert(d2 !== null, "zonedDateTime con tz inválida no lanza y devuelve respaldo");

// Requisito del usuario: tarea a las 13:30 en Madrid (CEST, UTC+2 en verano)
// con remind_before_minutes = 10 → el aviso debe caer a las 13:20 CEST.
const d3 = zonedDateTime("2026-08-24", "13:30", "Europe/Madrid");
assert(
  d3 !== null && d3.getTime() === Date.parse("2026-08-24T11:30:00Z"),
  "Madrid 13:30 en verano → 11:30Z (no se trata como UTC estricto)",
);
if (d3) {
  const remindAt = new Date(d3.getTime() - 10 * 60000);
  const parts3 = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(remindAt);
  const get3 = (t) => parts3.find((p) => p.type === t)?.value ?? "";
  assert(
    `${get3("year")}-${get3("month")}-${get3("day")}T${get3("hour")}:${get3("minute")}` ===
      "2026-08-24T13:20",
    "aviso 10 min antes → 13:20 en Madrid",
  );
}

// --- dateKeyInTz -------------------------------------------------------------
assert(
  dateKeyInTz(new Date("2026-08-24T12:00:00Z"), "Europe/Madrid") === "2026-08-24",
  "dateKeyInTz Madrid",
);
assert(
  dateKeyInTz(new Date("2026-08-24T12:00:00Z"), "NoExiste/Zona") === "2026-08-24",
  "dateKeyInTz con tz inválida usa UTC",
);

console.log(
  failures === 0
    ? "\nTodos los tests pasaron ✅"
    : `\n${failures} test(s) fallaron ❌`,
);
process.exit(failures === 0 ? 0 : 1);
