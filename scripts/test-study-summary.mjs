// Pruebas de src/lib/study-summary.ts
// Los nombres de los trabajos de estudio ("Estudiar para el examen de X",
// "Trabajar en Y") y el resumen de minutos: lo de HOY en la tarea del día y el
// TOTAL de todos los días al desplegar el trabajo.
// Ejecutar: node scripts/test-study-summary.mjs
import {
  composeWorkTitle,
  examCompletedMessage,
  findStudyBlockId,
  studyBlockTitle,
  studyMinutesForTask,
  summarizeStudy,
  studyWorkTitle,
} from "../src/lib/study-summary.ts";

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}`);
  }
}

// --- studyWorkTitle ----------------------------------------------------------
assert(
  studyWorkTitle({ id: "1", title: "Examen de Dibujo Técnico", type: "exam" }) ===
    "Estudiar para el examen de Dibujo Técnico",
  "un examen se enseña como «Estudiar para el examen de …»",
);
assert(
  studyWorkTitle({ id: "1", title: "Parcial 1 de Física", type: "exam" }) ===
    "Estudiar para el parcial 1 de Física",
  "no repite la palabra «examen» si el título ya la dice",
);
assert(
  studyWorkTitle({ id: "1", title: "Práctica 3 de Redes", type: "assignment" }) ===
    "Trabajar en Práctica 3 de Redes",
  "una entrega se enseña como «Trabajar en …»",
);
assert(
  studyWorkTitle({ id: "1", title: "Comprar pan", type: "task" }) === "Comprar pan",
  "una tarea normal conserva su título",
);
assert(
  studyWorkTitle(null) === "Estudio general",
  "sin tarea (o con la tarea borrada) es «Estudio general»",
);
assert(
  studyWorkTitle({ id: "1", title: "Estudiar para el examen de mates", type: "exam" }) ===
    "Estudiar para el examen de mates",
  "un título ya escrito como trabajo no se prefija otra vez",
);

// --- composeWorkTitle (lo que crea el Pomodoro) ------------------------------
assert(
  composeWorkTitle("exam", "dibujo técnico") === "Estudiar para el examen de dibujo técnico",
  "composeWorkTitle('exam', 'dibujo técnico')",
);
assert(
  composeWorkTitle("assignment", "Práctica 3 de Redes") === "Trabajar en Práctica 3 de Redes",
  "composeWorkTitle('assignment', …)",
);
assert(
  composeWorkTitle("study_session", "mates") === "Estudiar mates",
  "composeWorkTitle('study_session', …)",
);
assert(
  composeWorkTitle("exam", "estudiar dibujo técnico") === "estudiar dibujo técnico",
  "un nombre ya escrito como trabajo se respeta",
);
assert(composeWorkTitle("exam", "   ") === "", "nombre vacío → cadena vacía");

// --- examCompletedMessage ----------------------------------------------------
assert(
  examCompletedMessage("Examen de Dibujo Técnico") ===
    "Has completado el examen de Dibujo Técnico",
  "el aviso del examen no repite «examen de Examen de …»",
);
assert(
  examCompletedMessage("Parcial 1 de Física") === "Has completado el parcial 1 de Física",
  "el aviso del examen usa el título tal cual si ya lo dice",
);
assert(
  examCompletedMessage("Dibujo Técnico") === "Has completado el examen de Dibujo Técnico",
  "el aviso del examen añade «examen de» cuando hace falta",
);

// --- studyBlockTitle / findStudyBlockId (bloque del día del Pomodoro) --------
assert(
  studyBlockTitle({ id: "e1", title: "Examen de Dibujo Técnico", type: "exam" }) ===
    "Estudiar para el examen de Dibujo Técnico",
  "un examen genera el bloque del día «Estudiar para el examen de …»",
);
assert(
  studyBlockTitle({ id: "e2", title: "Práctica 3 de Redes", type: "assignment" }) ===
    "Trabajar en Práctica 3 de Redes",
  "una entrega genera el bloque del día «Trabajar en …»",
);
assert(
  studyBlockTitle({ id: "t1", title: "Comprar pan", type: "task" }) === "",
  "una tarea normal no genera bloque (no se estudia «Comprar pan»)",
);
assert(studyBlockTitle(null) === "", "sin tarea elegida no hay bloque");

const BLOCKS = [
  {
    id: "bloque-hoy",
    title: "Estudiar para el examen de Dibujo Técnico",
    type: "study_session",
    status: "pending",
    due_date: "2026-10-08",
  },
  {
    id: "bloque-ayer",
    title: "Trabajar en Práctica 3 de Redes",
    type: "study_session",
    status: "pending",
    due_date: "2026-10-07",
  },
  {
    id: "bloque-hecho",
    title: "Trabajar en Práctica 3 de Redes",
    type: "study_session",
    status: "done",
    due_date: "2026-10-08",
  },
];
assert(
  findStudyBlockId(BLOCKS, "Estudiar para el examen de dibujo técnico", "2026-10-08") ===
    "bloque-hoy",
  "encuentra el bloque de hoy aunque cambien mayúsculas y acentos",
);
assert(
  findStudyBlockId(BLOCKS, "Trabajar en Práctica 3 de Redes", "2026-10-09") === null,
  "el bloque de ayer no se reutiliza hoy (cada día tiene el suyo)",
);
assert(
  findStudyBlockId(BLOCKS, "Trabajar en Práctica 3 de Redes", "2026-10-08") === null,
  "un bloque ya hecho no se reutiliza",
);
assert(
  findStudyBlockId(BLOCKS, "Estudiar mates", "2026-10-08") === null,
  "sin bloque previo devuelve null (se creará uno)",
);

// --- studyMinutesForTask -----------------------------------------------------
const MINUTES = new Map([
  ["e1", 20],
  ["bloque-1", 25],
  ["bloque-2", 50],
  ["otro", 90],
]);
const WITH_CHILDREN = [
  { id: "e1", title: "Examen de Dibujo Técnico", type: "exam" },
  { id: "bloque-1", title: "Estudiar para el examen de Dibujo Técnico", parent_task_id: "e1" },
  { id: "bloque-2", title: "Estudiar para el examen de Dibujo Técnico", parent_task_id: "e1" },
  { id: "otro", title: "Comprar pan", type: "task" },
];
assert(
  studyMinutesForTask(MINUTES, WITH_CHILDREN[0], WITH_CHILDREN) === 95,
  "las horas de un examen suman sus bloques de estudio (20 + 25 + 50)",
);
assert(
  studyMinutesForTask(MINUTES, WITH_CHILDREN[3], WITH_CHILDREN) === 90,
  "una tarea sin bloques cuenta solo lo suyo",
);
assert(
  studyMinutesForTask(new Map(), WITH_CHILDREN[0], WITH_CHILDREN) === 0,
  "sin sesiones dedicadas son 0 minutos",
);

// --- summarizeStudy ----------------------------------------------------------
const TASKS = [
  { id: "a", title: "Examen de Dibujo Técnico", type: "exam" },
  { id: "b", title: "Práctica 3 de Redes", type: "assignment" },
];
const ENTRIES = [
  { taskId: "a", minutes: 25, date: "2026-10-01" },
  { taskId: "a", minutes: 25, date: "2026-10-08" },
  { taskId: "b", minutes: 10, date: "2026-10-08" },
  { taskId: null, minutes: 5, date: "2026-10-08" },
  { taskId: "borrada", minutes: 15, date: "2026-10-07" },
];

const items = summarizeStudy(ENTRIES, TASKS, "2026-10-08");
assert(items.length === 3, "un elemento por trabajo (la tarea borrada cae en «Estudio general»)");
assert(
  items[0].title === "Estudiar para el examen de Dibujo Técnico" &&
    items[0].minutesToday === 25 &&
    items[0].totalMinutes === 50,
  "el primero es lo más trabajado hoy, con hoy y total juntos",
);
assert(
  items[0].byDate.length === 2 &&
    items[0].byDate[0].date === "2026-10-08" &&
    items[0].byDate[1].date === "2026-10-01",
  "el desglose por día va del más reciente al más antiguo",
);
assert(
  items[1].title === "Trabajar en Práctica 3 de Redes" && items[1].minutesToday === 10,
  "las entregas se agrupan como «Trabajar en …»",
);
assert(
  items[2].title === "Estudio general" &&
    items[2].minutesToday === 5 &&
    items[2].totalMinutes === 20,
  "el estudio sin tarea (y el de una tarea borrada) suma en «Estudio general»",
);
assert(
  summarizeStudy([], TASKS, "2026-10-08").length === 0,
  "sin sesiones no hay trabajos",
);
assert(
  summarizeStudy(
    [{ taskId: "a", minutes: 0, date: "2026-10-08" }],
    TASKS,
    "2026-10-08",
  ).length === 0,
  "una sesión de 0 minutos no cuenta",
);

console.log(
  failures === 0 ? "\nTodos los tests pasaron ✅" : `\n${failures} test(s) fallaron ❌`,
);
process.exit(failures === 0 ? 0 : 1);
