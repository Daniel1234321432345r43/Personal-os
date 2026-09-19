/**
 * Emparejamiento de asignaturas escritas a mano o dictadas al Secretario IA.
 *
 * El usuario dice "mates" y en su lista está "Matemáticas": eso NO es inventar
 * una asignatura, es la misma. Este módulo normaliza (minúsculas, sin acentos,
 * sin puntuación de relleno) y resuelve diminutivos frecuentes para que el
 * asistente no pregunte algo que ya le han dicho y para que crear una tarea no
 * duplique una asignatura existente.
 *
 * Sin dependencias a propósito: se importa desde el cliente, desde los
 * guardarraíles compartidos y desde `scripts/test-subject-match.mjs` con Node.
 */

/**
 * Clave comparable: minúsculas, sin acentos, sin puntuación y con espacios
 * simples. "  Matemáticas  " y "matematicas" producen la misma clave.
 */
export function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:!¡?¿"'()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Diminutivos y sinónimos frecuentes en español → clave canónica. Ampliable:
 * basta con añadir una entrada para que "mates" deje de crear una asignatura
 * nueva cuando ya existe "Matemáticas".
 */
const SUBJECT_ALIASES: Record<string, string> = {
  mate: "matematicas",
  mates: "matematicas",
  matematicas: "matematicas",
  calc: "calculo",
  calculo: "calculo",
  fisica: "fisica",
  fisic: "fisica",
  quimica: "quimica",
  bio: "biologia",
  biologia: "biologia",
  hist: "historia",
  historia: "historia",
  lcl: "lengua",
  lengua: "lengua",
  literatura: "lengua",
  ing: "ingles",
  ingles: "ingles",
  frances: "frances",
  filo: "filosofia",
  filosofia: "filosofia",
  progra: "programacion",
  programacion: "programacion",
  informatica: "programacion",
  tecno: "tecnologia",
  tecnologia: "tecnologia",
  ef: "educacion fisica",
  "ed fisica": "educacion fisica",
  "educacion fisica": "educacion fisica",
  eco: "economia",
  economia: "economia",
  plastica: "plastica",
  dibujo: "plastica",
  musi: "musica",
  musica: "musica",
};

/**
 * Clave canónica de una asignatura ("mates" → "matematicas"). Los nombres de
 * varias palabras se respetan tal cual (salvo alias explícito) para no
 * confundir "Historia de España" con "Historia del Arte".
 */
export function canonicalSubjectKey(value: string): string {
  const key = normalizeKey(value);
  if (!key) return "";
  const direct = SUBJECT_ALIASES[key];
  if (direct) return direct;
  if (key.includes(" ")) return key;
  return SUBJECT_ALIASES[key] ?? key;
}

/**
 * ¿Dos textos se refieren a lo mismo? Igualdad normalizada o contención clara
 * (una de las dos partes tiene al menos 4 caracteres), para que "historia"
 * empareje con "Historia de España" sin que "ef" empareje con cualquier cosa.
 */
export function namesMatch(a: string, b: string): boolean {
  const keyA = normalizeKey(a);
  const keyB = normalizeKey(b);
  if (!keyA || !keyB) return false;
  if (keyA === keyB) return true;
  if (keyA.length >= 4 && keyB.includes(keyA)) return true;
  if (keyB.length >= 4 && keyA.includes(keyB)) return true;
  return false;
}

/** ¿Dos nombres de asignatura se refieren a la misma? Incluye alias. */
export function subjectNamesMatch(a: string, b: string): boolean {
  if (!normalizeKey(a) || !normalizeKey(b)) return false;
  if (canonicalSubjectKey(a) === canonicalSubjectKey(b)) return true;
  return namesMatch(a, b);
}

/**
 * Coincidencia estricta: solo el mismo nombre normalizado o el mismo alias
 * canónico ("mates" ≈ "Matemáticas"). Sirve cuando el usuario está CREANDO una
 * asignatura explícitamente, para no dar por existente "Historia" porque ya
 * tenga "Historia del Arte".
 */
export function findSubjectByExactName<T extends { name: string }>(
  name: string | null | undefined,
  subjects: readonly T[],
): T | undefined {
  const query = (name ?? "").trim();
  if (!query) return undefined;

  const exact = subjects.find((s) => normalizeKey(s.name) === normalizeKey(query));
  if (exact) return exact;

  const canonical = canonicalSubjectKey(query);
  return subjects.find((s) => canonicalSubjectKey(s.name) === canonical);
}

/**
 * Busca la asignatura existente que mejor corresponde al nombre recibido.
 * Orden de preferencia: exacta normalizada (para no elegir "Matemáticas
 * Aplicadas" existiendo "Matemáticas"), alias canónico y, por último, contención.
 */
export function findSubjectByName<T extends { name: string }>(
  name: string | null | undefined,
  subjects: readonly T[],
): T | undefined {
  const strict = findSubjectByExactName(name, subjects);
  if (strict) return strict;
  return subjects.find((s) => subjectNamesMatch(s.name, name ?? ""));
}
