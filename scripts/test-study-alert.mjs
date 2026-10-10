// Pruebas de supabase/functions/_shared/study-alert.js
// A las 15:00 locales se revisan exámenes y entregas pendientes y se manda un
// empujón con los plazos más cercanos: «Tienes un examen pasado mañana y otro
// al día siguiente, deberías empezar a estudiar».
// Ejecutar: node scripts/test-study-alert.mjs
import {
  buildStudyAlert,
  daysBetweenKeys,
  isStudyAlertWindow,
  relativeDayLabel,
  selectStudyAlertItems,
  studyAlertTarget,
  STUDY_ALERT_LOCAL_TIME,
} from "../supabase/functions/_shared/study-alert.js";

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}`);
  }
}

// --- ventana de las 15:00 ----------------------------------------------------
assert(STUDY_ALERT_LOCAL_TIME === "15:00", "la hora configurada es la 15:00");

// Agosto en Madrid es UTC+2: las 15:00 locales son las 13:00 UTC.
const target = studyAlertTarget(new Date("2026-08-24T12:00:00Z"), "Europe/Madrid");
assert(target.dateKey === "2026-08-24", "el día local es el 24 de agosto");
assert(
  target.target !== null && target.target.getTime() === Date.parse("2026-08-24T13:00:00Z"),
  "Madrid 15:00 en verano → 13:00Z",
);
assert(
  isStudyAlertWindow(new Date("2026-08-24T12:59:00Z"), target.target) === false,
  "a las 14:59 locales todavía no toca",
);
assert(
  isStudyAlertWindow(new Date("2026-08-24T13:00:00Z"), target.target) === true,
  "a las 15:00 locales en punto sí toca",
);
assert(
  isStudyAlertWindow(new Date("2026-08-24T13:29:00Z"), target.target) === true,
  "dentro del margen de 30 min se recupera el aviso",
);
assert(
  isStudyAlertWindow(new Date("2026-08-24T13:31:00Z"), target.target) === false,
  "pasado el margen ya no se manda",
);
assert(
  isStudyAlertWindow(new Date("2026-08-24T13:00:00Z"), null) === false,
  "sin objetivo (zona horaria rara) no se manda nada",
);

// --- plazos relativos --------------------------------------------------------
assert(daysBetweenKeys("2026-10-10", "2026-10-12") === 2, "del 10 al 12 van 2 días");
assert(daysBetweenKeys("no-es-fecha", "2026-10-12") === null, "una fecha inválida no lanza");
assert(relativeDayLabel(0) === "hoy", "0 días → hoy");
assert(relativeDayLabel(1) === "mañana", "1 día → mañana");
assert(relativeDayLabel(2) === "pasado mañana", "2 días → pasado mañana");
assert(relativeDayLabel(3) === "en 3 días", "3 días → en 3 días");

// --- qué entra en el aviso ---------------------------------------------------
const tasks = [
  { id: "1", title: "Examen de Física", type: "exam", due_date: "2026-10-12", status: "pending" },
  { id: "2", title: "Examen de Redes", type: "exam", due_date: "2026-10-13", status: "pending" },
  { id: "3", title: "Trabajo de Historia", type: "assignment", due_date: "2026-10-15", status: "pending" },
  { id: "4", title: "Examen ya hecho", type: "exam", due_date: "2026-10-11", status: "done" },
  { id: "5", title: "Examen de ayer", type: "exam", due_date: "2026-10-09", status: "pending" },
  { id: "6", title: "Examen lejanísimo", type: "exam", due_date: "2026-11-20", status: "pending" },
  { id: "7", title: "Gimnasio", type: "personal", due_date: "2026-10-11", status: "pending" },
  { id: "8", title: "Sin fecha", type: "exam", due_date: null, status: "pending" },
];

const selected = selectStudyAlertItems(tasks, "2026-10-10");
assert(selected.length === 3, "solo entran lo pendiente y próximo: 2 exámenes y 1 entrega");
assert(selected[0].days === 2, "el primero es el que vence antes");
assert(
  selected.every((item) => item.days >= 0 && item.days <= 7),
  "nada de plazos pasados ni fuera del horizonte",
);
assert(
  selectStudyAlertItems([], "2026-10-10").length === 0,
  "sin tareas pendientes no hay nada que anunciar",
);
assert(
  selectStudyAlertItems([{ type: "exam", due_date: "basura" }], "2026-10-10").length === 0,
  "una fila ilegible se descarta sin lanzar",
);

// --- el texto ----------------------------------------------------------------
assert(buildStudyAlert([]) === null, "sin elementos no se manda aviso vacío");

const dosExamenes = buildStudyAlert([
  { title: "Física", type: "exam", days: 2 },
  { title: "Redes", type: "exam", days: 3 },
]);
assert(
  dosExamenes ===
    "Tienes un examen pasado mañana (Física) y otro en 3 días (Redes). Deberías empezar a estudiar.",
  "dos exámenes → «uno pasado mañana y otro…»",
);

const unExamen = buildStudyAlert([{ title: "Física", type: "exam", days: 1 }]);
assert(
  unExamen === "Tienes un examen mañana (Física). Deberías ir empezando a estudiar.",
  "un solo examen se nombra con su plazo",
);

const mixto = buildStudyAlert([
  { title: "Física", type: "exam", days: 2 },
  { title: "Redes", type: "exam", days: 3 },
  { title: "Historia", type: "assignment", days: 5 },
]);
assert(
  mixto ===
    "Tienes 2 exámenes y una entrega esta semana: Física (pasado mañana), Redes (en 3 días), Historia (en 5 días). Deberías empezar a estudiar.",
  "exámenes y entregas se cuentan por separado",
);

const tituloLargo = buildStudyAlert([
  { title: "Examen final extraordinario de Historia Contemporánea", type: "exam", days: 1 },
]);
assert(
  tituloLargo.includes("…") && tituloLargo.length < 120,
  "un título largo se recorta para que quepa en la notificación",
);

const sinTitulo = buildStudyAlert([{ title: "", type: "exam", days: 2 }]);
assert(
  sinTitulo === "Tienes un examen pasado mañana (examen). Deberías ir empezando a estudiar.",
  "sin título no rompe ni deja paréntesis vacíos",
);

console.log("");
if (failures > 0) {
  console.error(`${failures} comprobaciones han fallado.`);
  process.exit(1);
}
console.log("Todas las comprobaciones han pasado.");
