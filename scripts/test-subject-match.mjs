// Pruebas de src/lib/subjects.ts
// Verifica que los diminutivos y los nombres con acentos/mayúsculas emparejen
// con la asignatura correcta (el Secretario IA dejaba de emparejar "mates" con
// "Matemáticas" y en su lugar preguntaba o creaba una asignatura duplicada).
// Ejecutar: node scripts/test-subject-match.mjs
import {
  canonicalSubjectKey,
  findSubjectByExactName,
  findSubjectByName,
  namesMatch,
  normalizeKey,
  subjectNamesMatch,
} from "../src/lib/subjects.ts";

let failures = 0;
function assert(cond, label) {
  if (cond) {
    console.log(`✓ ${label}`);
  } else {
    failures += 1;
    console.error(`✗ ${label}`);
  }
}

const SUBJECTS = [
  { id: "1", name: "Matemáticas" },
  { id: "2", name: "Matemáticas Aplicadas" },
  { id: "3", name: "Física" },
  { id: "4", name: "Historia de España" },
  { id: "5", name: "Programación" },
];

// --- normalizeKey ------------------------------------------------------------
assert(
  normalizeKey("  Matemáticas  ") === "matematicas",
  "normalizeKey quita espacios, mayúsculas y acentos",
);
assert(
  normalizeKey("Historia de España!") === "historia de espana",
  "normalizeKey quita puntuación",
);
assert(normalizeKey("") === "", "normalizeKey('') → ''");

// --- canonicalSubjectKey -----------------------------------------------------
assert(
  canonicalSubjectKey("mates") === "matematicas",
  "canonicalSubjectKey('mates') → matematicas",
);
assert(
  canonicalSubjectKey("Ed. Física") === "educacion fisica",
  "canonicalSubjectKey('Ed. Física') → educacion fisica",
);
assert(
  canonicalSubjectKey("Historia de España") === "historia de espana",
  "un nombre compuesto sin alias conserva sus palabras",
);

// --- namesMatch / subjectNamesMatch -----------------------------------------
assert(
  namesMatch("mates", "Matemáticas") === false &&
    subjectNamesMatch("mates", "Matemáticas") === true,
  "el alias solo lo resuelve subjectNamesMatch",
);
assert(
  namesMatch("mate", "mates") === true,
  "namesMatch empareja una forma contenida en otra",
);
assert(
  subjectNamesMatch("mates", "Matemáticas") === true,
  "subjectNamesMatch('mates', 'Matemáticas')",
);
assert(
  namesMatch("historia", "Historia de España") === true,
  "namesMatch por contención (palabra larga)",
);
assert(
  namesMatch("ef", "Matemáticas") === false,
  "namesMatch no empareja textos cortos por casualidad",
);
assert(
  subjectNamesMatch("Historia de España", "Historia del Arte") === false,
  "dos asignaturas distintas de historia no se confunden",
);

// --- findSubjectByName -------------------------------------------------------
assert(
  findSubjectByName("mates", SUBJECTS)?.id === "1",
  "findSubjectByName('mates') → Matemáticas",
);
assert(
  findSubjectByName("matematicas", SUBJECTS)?.id === "1",
  "la coincidencia exacta gana a 'Matemáticas Aplicadas'",
);
assert(
  findSubjectByName("progra", SUBJECTS)?.id === "5",
  "findSubjectByName('progra') → Programación",
);
assert(
  findSubjectByName("física", SUBJECTS)?.id === "3",
  "findSubjectByName acepta acentos en la consulta",
);
assert(
  findSubjectByName("historia", SUBJECTS)?.id === "4",
  "findSubjectByName('historia') → Historia de España",
);
assert(
  findSubjectByName("mates", [{ id: "9", name: "Historia" }]) === undefined,
  "sin coincidencia devuelve undefined (no inventa)",
);
assert(findSubjectByName("", SUBJECTS) === undefined, "consulta vacía → undefined");
assert(findSubjectByName(null, SUBJECTS) === undefined, "consulta null → undefined");

// --- findSubjectByExactName (crear asignaturas nuevas) ----------------------
assert(
  findSubjectByExactName("mates", SUBJECTS)?.id === "1",
  "findSubjectByExactName resuelve el alias 'mates'",
);
assert(
  findSubjectByExactName("historia", SUBJECTS) === undefined,
  "crear 'Historia' es válido aunque exista 'Historia de España'",
);
assert(
  findSubjectByExactName("Historia de España", SUBJECTS)?.id === "4",
  "findSubjectByExactName encuentra el nombre exacto",
);

console.log(
  failures === 0 ? "\nTodos los tests pasaron ✅" : `\n${failures} test(s) fallaron ❌`,
);
process.exit(failures === 0 ? 0 : 1);
