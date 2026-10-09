// Pruebas de supabase/functions/_shared/exam-done.js
// El examen del día se cierra a las 17:00 locales (hora del usuario) con el
// aviso "Examen completado", y nunca antes de que haya empezado.
// Ejecutar: node scripts/test-exam-done.mjs
import {
  EXAM_DONE_LOCAL_TIME,
  examAlreadyStarted,
  examDoneMessage,
  examDoneTarget,
  isExamDoneWindow,
  selectExamsToComplete,
} from "../supabase/functions/_shared/exam-done.js";

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}`);
  }
}

// --- examDoneMessage ---------------------------------------------------------
assert(
  examDoneMessage("Dibujo Técnico") === "Has completado el examen de Dibujo Técnico",
  "un examen sin la palabra «examen» en el título la añade",
);
assert(
  examDoneMessage("Examen de Dibujo Técnico") === "Has completado el examen de Dibujo Técnico",
  "un título que ya dice «Examen» no la repite",
);
assert(
  examDoneMessage("Recuperación de mates") === "Has completado la recuperación de mates",
  "«Recuperación» cuenta como examen",
);
assert(examDoneMessage("") === "Has completado el examen", "título vacío → mensaje genérico");
assert(examDoneMessage(undefined) === "Has completado el examen", "título undefined → no lanza");

// --- ventana de las 17:00 ----------------------------------------------------
assert(EXAM_DONE_LOCAL_TIME === "17:00", "la hora configurada es la 17:00");

// Agosto en Madrid es UTC+2: las 17:00 locales son las 15:00 UTC.
const target = examDoneTarget(new Date("2026-08-24T14:00:00Z"), "Europe/Madrid");
assert(target.dateKey === "2026-08-24", "el día local es el 24 de agosto");
assert(
  target.target !== null && target.target.getTime() === Date.parse("2026-08-24T15:00:00Z"),
  "Madrid 17:00 en verano → 15:00Z",
);
assert(
  isExamDoneWindow(new Date("2026-08-24T14:59:00Z"), target.target) === false,
  "a las 16:59 locales todavía no toca",
);
assert(
  isExamDoneWindow(new Date("2026-08-24T15:00:00Z"), target.target) === true,
  "a las 17:00 locales en punto sí toca",
);
assert(
  isExamDoneWindow(new Date("2026-08-24T15:25:00Z"), target.target) === true,
  "dentro del margen de 30 min se recupera el aviso",
);
assert(
  isExamDoneWindow(new Date("2026-08-24T15:31:00Z"), target.target) === false,
  "pasado el margen ya no se cierra por el cron",
);
// Invierno: Madrid es UTC+1, las 17:00 locales son las 16:00 UTC.
const winter = examDoneTarget(new Date("2026-12-10T15:00:00Z"), "Europe/Madrid");
assert(
  winter.target !== null && winter.target.getTime() === Date.parse("2026-12-10T16:00:00Z"),
  "Madrid 17:00 en invierno → 16:00Z (no se asume un desfase fijo)",
);
assert(
  examDoneTarget(new Date("2026-08-24T14:00:00Z"), "NoExiste/Zona").target.getTime() ===
    Date.parse("2026-08-24T17:00:00Z"),
  "zona horaria inválida → respaldo UTC, sin lanzar",
);

// --- examAlreadyStarted ------------------------------------------------------
const now = new Date("2026-08-24T15:00:00Z"); // 17:00 en Madrid
assert(
  examAlreadyStarted({ due_date: "2026-08-24", start_time: null }, now, "Europe/Madrid") === true,
  "un examen sin hora ya se da por hecho a las 17:00",
);
assert(
  examAlreadyStarted({ due_date: "2026-08-24", start_time: "09:00" }, now, "Europe/Madrid") === true,
  "un examen de las 09:00 ya ha ocurrido",
);
assert(
  examAlreadyStarted({ due_date: "2026-08-24", start_time: "18:00" }, now, "Europe/Madrid") === false,
  "un examen de las 18:00 todavía no ha ocurrido a las 17:00",
);
assert(
  examAlreadyStarted({ due_date: "2026-08-24", start_time: "17:00" }, now, "Europe/Madrid") === true,
  "un examen justo a las 17:00 ya ha empezado",
);

// --- selectExamsToComplete ---------------------------------------------------
const exams = [
  { id: "hoy", title: "Examen de Dibujo Técnico", type: "exam", due_date: "2026-08-24", start_time: null, status: "pending" },
  { id: "tarde", title: "Examen de Redes", type: "exam", due_date: "2026-08-24", start_time: "18:00", status: "pending" },
  { id: "hecho", title: "Examen de Física", type: "exam", due_date: "2026-08-24", start_time: null, status: "done" },
  { id: "manana", title: "Examen de Química", type: "exam", due_date: "2026-08-25", start_time: null, status: "pending" },
  { id: "ayer", title: "Examen de Historia", type: "exam", due_date: "2026-08-23", start_time: null, status: "pending" },
  { id: "tarea", title: "Práctica 3 de Redes", type: "assignment", due_date: "2026-08-24", start_time: null, status: "pending" },
];
const selected = selectExamsToComplete(exams, "2026-08-24", now, "Europe/Madrid");
assert(selected.length === 1 && selected[0].id === "hoy", "solo se cierra el examen de hoy ya empezado");
assert(
  selectExamsToComplete(null, "2026-08-24", now, "Europe/Madrid").length === 0,
  "sin exámenes no se cierra nada (null)",
);
assert(
  selectExamsToComplete(
    [{ id: "roto", type: "exam", due_date: "fecha-mala", start_time: "99:99", status: "pending" }],
    "2026-08-24",
    now,
    "Europe/Madrid",
  ).length === 0,
  "una fila corrupta se descarta sin lanzar",
);

console.log(
  failures === 0
    ? "\nTodos los tests pasaron ✅"
    : `\n${failures} test(s) fallaron ❌`,
);
process.exit(failures === 0 ? 0 : 1);
