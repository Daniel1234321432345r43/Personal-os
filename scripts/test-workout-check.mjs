// Pruebas de supabase/functions/_shared/workout-check.js
// Cuando el entreno programado para hoy ya ha terminado, el cron pregunta
// «Hoy deberías haber ido a X, ¿has ido?» y la notificación abre el modal de
// confirmación con el nombre y los minutos del entreno.
// Ejecutar: node scripts/test-workout-check.mjs
import {
  hasLoggedWorkout,
  isWorkoutCheckWindow,
  scheduleMinutes,
  scheduleName,
  schedulesForDay,
  weekdayOfKey,
  workoutCheckEntityId,
  workoutCheckMessage,
  workoutCheckTarget,
  workoutCheckUrl,
} from "../supabase/functions/_shared/workout-check.js";

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}`);
  }
}

// --- día de la semana --------------------------------------------------------
assert(weekdayOfKey("2026-10-10") === 6, "el 10 de octubre de 2026 es sábado");
assert(weekdayOfKey("2026-10-12") === 1, "el 12 de octubre de 2026 es lunes");
assert(weekdayOfKey("no-es-fecha") === null, "una fecha inválida devuelve null");

// --- qué planes tocan hoy ----------------------------------------------------
const plan = [
  { id: "a", weekday: 1, title: "Pierna", activity_type: "Gimnasio", time: "18:00", duration_minutes: 60, enabled: true },
  { id: "b", weekday: 1, title: null, activity_type: "Running", time: "07:30", duration_minutes: 45, enabled: false },
  { id: "c", weekday: 3, activity_type: "Pádel", time: "20:00", duration_minutes: 90, enabled: true },
];
assert(schedulesForDay(plan, 1).length === 1, "el lunes solo cuenta el plan activo");
assert(schedulesForDay(plan, 1)[0].id === "a", "y es el que sí está activo");
assert(schedulesForDay(plan, 3).length === 1, "el miércoles toca pádel");
assert(schedulesForDay(plan, 0).length === 0, "el domingo no hay plan");
assert(schedulesForDay([], 1).length === 0, "sin planes no hay nada que preguntar");

// --- nombre y minutos --------------------------------------------------------
assert(scheduleName(plan[0]) === "Pierna", "con título se usa el título");
assert(scheduleName(plan[2]) === "Pádel", "sin título se usa la actividad");
assert(scheduleName({}) === "el entrenamiento", "sin nada, un nombre genérico");
assert(scheduleMinutes({ duration_minutes: 45 }) === 45, "se respeta la duración");
assert(scheduleMinutes({ duration_minutes: 0 }) === 60, "una duración absurda cae a 60");
assert(scheduleMinutes({}) === 60, "sin duración, 60 minutos");

// --- cuándo se pregunta ------------------------------------------------------
// Agosto en Madrid es UTC+2: 18:00 locales + 60 min → 18:00Z.
const target = workoutCheckTarget(plan[0], "2026-08-24", "Europe/Madrid");
assert(
  target !== null && target.getTime() === Date.parse("2026-08-24T17:00:00Z"),
  "Madrid 18:00 + 60 min en verano → 17:00Z",
);
assert(
  isWorkoutCheckWindow(new Date("2026-08-24T16:59:00Z"), target) === false,
  "a las 18:59 locales el entreno aún no ha terminado",
);
assert(
  isWorkoutCheckWindow(new Date("2026-08-24T17:00:00Z"), target) === true,
  "justo al terminar ya se pregunta",
);
assert(
  isWorkoutCheckWindow(new Date("2026-08-24T17:59:00Z"), target) === true,
  "dentro de la hora de margen se recupera la pregunta",
);
assert(
  isWorkoutCheckWindow(new Date("2026-08-24T18:01:00Z"), target) === false,
  "pasado el margen ya no se pregunta (se deja para el día siguiente)",
);
assert(
  workoutCheckTarget({ time: "basura" }, "2026-08-24", "Europe/Madrid") === null,
  "una hora ilegible no genera aviso",
);
assert(
  isWorkoutCheckWindow(new Date(), null) === false,
  "sin objetivo no se pregunta nada",
);

// --- texto y URL -------------------------------------------------------------
assert(
  workoutCheckMessage(plan[0]) === "Hoy deberías haber ido a Pierna, ¿has ido?",
  "el texto de la notificación usa el nombre del plan",
);
const url = workoutCheckUrl(plan[0], "2026-08-24");
assert(url.startsWith("/dashboard?"), "el aviso abre la app en Hoy (el modal vive ahí)");
assert(url.includes("entreno=1"), "lleva la marca que abre el modal");
assert(url.includes("nombre=Pierna") && url.includes("min=60"), "y el nombre con los minutos");
assert(url.includes("fecha=2026-08-24"), "y el día al que se refiere");
assert(url.includes("plan=a"), "y el id del plan, para trazabilidad");
assert(
  workoutCheckUrl({ activity_type: "Pádel", duration_minutes: 90 }, "2026-08-24").includes(
    "nombre=P%C3%A1del",
  ),
  "los acentos viajan codificados",
);
assert(
  workoutCheckEntityId(plan[0], "2026-08-24") === "a:2026-08-24",
  "la clave del aviso es plan + día",
);

// --- no preguntar si ya lo apuntaste -----------------------------------------
const workouts = [
  { date: "2026-08-24", activity_type: "Gimnasio", title: null },
  { date: "2026-08-23", activity_type: "Running", title: null },
];
assert(
  hasLoggedWorkout(workouts, plan[0], "2026-08-24") === true,
  "si ya apuntaste ese entreno hoy, no se te pregunta",
);
assert(
  hasLoggedWorkout(workouts, plan[2], "2026-08-24") === false,
  "otro entreno del mismo día no cuenta como este",
);
assert(
  hasLoggedWorkout(workouts, plan[0], "2026-08-25") === false,
  "el entreno de ayer no vale para hoy",
);
assert(
  hasLoggedWorkout([{ date: "2026-08-24", activity_type: "" }], plan[0], "2026-08-24") === false,
  "una fila vacía no se toma por coincidencia",
);

console.log("");
if (failures > 0) {
  console.error(`${failures} comprobaciones han fallado.`);
  process.exit(1);
}
console.log("Todas las comprobaciones han pasado.");
