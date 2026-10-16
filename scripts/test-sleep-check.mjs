// Pruebas de supabase/functions/_shared/sleep-check.js
// De lunes a viernes a las 07:15 locales, el cron pregunta «¿cuánto has
// dormido?» y la notificación abre la app en el registro de esa noche.
// Ejecutar: node scripts/test-sleep-check.mjs
import {
  SLEEP_CHECK_LOCAL_TIME,
  hasLoggedSleep,
  isSleepCheckWindow,
  isWeekdayKey,
  sleepCheckEntityId,
  sleepCheckMessage,
  sleepCheckTarget,
  sleepCheckUrl,
} from "../supabase/functions/_shared/sleep-check.js";

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}`);
  }
}

// --- solo de lunes a viernes -------------------------------------------------
// 2026-10-12 es lunes; el 16 de octubre de 2026 es viernes.
assert(isWeekdayKey("2026-10-12") === true, "el lunes sí se pregunta");
assert(isWeekdayKey("2026-10-16") === true, "el viernes sí se pregunta");
assert(isWeekdayKey("2026-10-17") === false, "el sábado no se pregunta");
assert(isWeekdayKey("2026-10-18") === false, "el domingo no se pregunta");
assert(isWeekdayKey("no-es-fecha") === false, "una fecha ilegible no pregunta");
assert(isWeekdayKey(null) === false, "sin fecha, tampoco");

// --- a las 07:15 locales -----------------------------------------------------
assert(SLEEP_CHECK_LOCAL_TIME === "07:15", "la hora de la pregunta son las 07:15");
// Agosto en Madrid es UTC+2: 07:15 locales = 05:15Z (lunes 24 de agosto).
const summer = sleepCheckTarget("2026-08-24", "Europe/Madrid");
assert(
  summer !== null && summer.getTime() === Date.parse("2026-08-24T05:15:00Z"),
  "Madrid 07:15 en verano → 05:15Z",
);
assert(
  summer !== null &&
    summer.toISOString() === "2026-08-24T05:15:00.000Z",
  "y el instante del aviso es exactamente ese",
);
// Enero en Madrid es UTC+1: 07:15 locales = 06:15Z (lunes 5 de enero).
const winter = sleepCheckTarget("2026-01-05", "Europe/Madrid");
assert(
  winter !== null && winter.getTime() === Date.parse("2026-01-05T06:15:00Z"),
  "Madrid 07:15 en invierno → 06:15Z (el horario de verano no descuadra la hora)",
);
assert(
  sleepCheckTarget("no-es-fecha", "Europe/Madrid") === null,
  "una fecha ilegible no genera aviso",
);
assert(sleepCheckTarget(null, "Europe/Madrid") === null, "sin fecha, no hay instante");

// --- la ventana: nunca antes de las 07:15 ------------------------------------
assert(
  isSleepCheckWindow(new Date("2026-08-24T05:14:00Z"), summer) === false,
  "a las 07:14 locales todavía no se pregunta",
);
assert(
  isSleepCheckWindow(new Date("2026-08-24T05:15:00Z"), summer) === true,
  "a las 07:15 en punto ya se pregunta",
);
assert(
  isSleepCheckWindow(new Date("2026-08-24T06:14:00Z"), summer) === true,
  "dentro de la hora de margen se recupera la pregunta (cron con retraso)",
);
assert(
  isSleepCheckWindow(new Date("2026-08-24T06:16:00Z"), summer) === false,
  "pasado el margen ya no se pregunta (se deja para el día siguiente)",
);
assert(isSleepCheckWindow(new Date(), null) === false, "sin objetivo no se pregunta nada");

// --- texto de la notificación ------------------------------------------------
assert(
  sleepCheckMessage(8).startsWith("¿Cuánto has dormido esta noche?"),
  "la notificación pregunta cuánto has dormido",
);
assert(sleepCheckMessage(8).includes("objetivo de 8 h"), "y recuerda el objetivo del usuario");
assert(sleepCheckMessage(7.5).includes("objetivo de 7.5 h"), "el objetivo puede llevar decimales");
assert(sleepCheckMessage(null).includes("objetivo de 8 h"), "sin objetivo configurado, 8 h");
assert(sleepCheckMessage("basura").includes("objetivo de 8 h"), "un objetivo corrupto no rompe el texto");

// --- URL que abre el registro de esa noche -----------------------------------
const url = sleepCheckUrl("2026-10-16");
assert(url.startsWith("/sueno?"), "el aviso abre la app en Sueño");
assert(url === "/sueno?registrar=1&fecha=2026-10-16", "lleva la marca de registrar y la fecha");
assert(sleepCheckEntityId("2026-10-16") === "2026-10-16", "la clave del aviso es la mañana");

// --- no preguntar por una noche ya registrada --------------------------------
assert(
  hasLoggedSleep([{ date: "2026-10-16" }], "2026-10-16") === true,
  "si la noche ya está registrada, no se pregunta",
);
assert(
  hasLoggedSleep([{ date: "2026-10-16T00:00:00.000Z" }], "2026-10-16") === true,
  "una fecha con hora (timestamptz) también cuenta como registrada",
);
assert(
  hasLoggedSleep([{ date: "2026-10-15" }], "2026-10-16") === false,
  "la noche de ayer no vale para hoy",
);
assert(hasLoggedSleep([], "2026-10-16") === false, "sin registros, se pregunta");
assert(hasLoggedSleep(null, "2026-10-16") === false, "y sin datos cargados, tampoco rompe");

console.log("");
if (failures > 0) {
  console.error(`${failures} comprobaciones han fallado.`);
  process.exit(1);
}
console.log("Todas las comprobaciones han pasado.");
