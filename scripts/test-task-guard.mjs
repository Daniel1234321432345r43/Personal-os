// Pruebas de src/lib/ai/validation.ts
// Fija el comportamiento que pedía el usuario: el asistente deja de preguntar
// por la asignatura (se guarda como general) y solo la fecha puede bloquear.
// Ejecutar: node scripts/test-task-guard.mjs
import { checkTaskInputs } from "../src/lib/ai/validation.ts";

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}`);
  }
}

// Con fecha: se guarda siempre.
assert(
  checkTaskInputs([{ title: "Tarea de mates", type: "task", due_date: "2026-09-20" }]).ok === true,
  "una tarea con fecha se guarda sin pedir nada más",
);
assert(
  checkTaskInputs([
    { title: "Estudiar mates", type: "study_session", due_date: "2026-09-20" },
  ]).ok === true,
  "una sesión de estudio SIN asignatura ya no se bloquea (queda como general)",
);
assert(
  checkTaskInputs([
    { title: "Trabajo de historia", type: "assignment", subject_name: "Historia", session_dates: ["2026-09-20", "2026-09-21"] },
  ]).ok === true,
  "las sesiones multi-día valen como fecha",
);
assert(
  checkTaskInputs([
    { title: "Comprar pan", type: "task", date_unspecified: true },
  ]).ok === true,
  "sin fecha solo si el usuario lo ha dicho explícitamente (date_unspecified)",
);

// Sin fecha: se bloquea y solo se pregunta el día.
const missingDate = checkTaskInputs([{ title: "Entrega de redes", type: "assignment" }]);
assert(missingDate.ok === false, "una entrega sin fecha se bloquea");
assert(
  missingDate.questions.length === 1 && /Para cuándo/.test(missingDate.questions[0]),
  "la única pregunta es por el día",
);
assert(
  missingDate.questions.every((q) => !/asignatura/i.test(q)),
  "nunca se pregunta por la asignatura",
);
assert(
  missingDate.error?.includes("No preguntes por la asignatura") === true,
  "el mensaje al modelo prohíbe preguntar la asignatura",
);

// El texto de la pregunta nombra el elemento sin fecha.
assert(
  missingDate.questions[0].includes("Entrega de redes"),
  "la pregunta incluye el nombre del elemento",
);
assert(
  checkTaskInputs([{ title: "Sin tipo ni fecha" }]).ok === false,
  "sin tipo se exige fecha igualmente",
);

console.log(
  failures === 0 ? "\nTodos los tests pasaron ✅" : `\n${failures} test(s) fallaron ❌`,
);
process.exit(failures === 0 ? 0 : 1);
