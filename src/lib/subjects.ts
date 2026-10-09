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

// ─── Deducir la asignatura del título ────────────────────────────────────────
//
// El caso que arregla esto: "añade que hoy voy a estudiar dibujo técnico". El
// asistente escribía la tarea "Estudiar dibujo técnico" SIN asignatura (o
// preguntaba de qué asignatura era), así que el trabajo quedaba suelto en
// "General". Aquí se deduce del propio texto: si ya existe una asignatura que
// aparece en el título, se usa esa; si no, se propone el nombre que el usuario
// ha escrito ("dibujo técnico").

/** Asignatura deducida: la de la lista (`exists`) o una nueva propuesta. */
export interface SubjectGuess {
  name: string;
  /** true si corresponde a una asignatura que el usuario ya tiene creada. */
  exists: boolean;
}

/** Palabras que introducen el trabajo: "estudiar", "examen", "trabajo"… */
const LEAD_WORDS = [
  "estudiar",
  "estudio",
  "repasar",
  "repaso",
  "trabajar",
  "trabajo",
  "preparar",
  "practicar",
  "examen",
  "examenes",
  "control",
  "parcial",
  "recuperacion",
  "practica",
  "practicas",
  "deberes",
  "ejercicio",
  "ejercicios",
  "entrega",
  "proyecto",
  "presentacion",
  "tarea",
  "temario",
  "tema",
];

/** Palabras de enlace que se saltan al leer el trabajo ("examen DE mates"). */
const CONNECTORS = new Set([
  "de",
  "del",
  "para",
  "el",
  "la",
  "los",
  "las",
  "en",
  "sobre",
  "mi",
  "su",
  "un",
  "una",
  "al",
]);

/** Palabras que no son una asignatura: "2 horas", "mañana", "los deberes"… */
const NOT_A_SUBJECT = new Set([
  "hoy",
  "manana",
  "ayer",
  "pasado",
  "proxima",
  "proximo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
  "semana",
  "finde",
  "mes",
  "dia",
  "dias",
  "noche",
  "tarde",
  "manana",
  "madrugada",
  "hora",
  "horas",
  "minuto",
  "minutos",
  "rato",
  "bloque",
  "clase",
  "clases",
  "algo",
  "cosas",
  "todo",
  "nada",
  "general",
  "libre",
]);

/** Tokens en minúsculas sin puntuación, conservando los acentos. */
function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9áéíóúüñ]+/)
    .filter(Boolean);
}

/** Los mismos tokens, sin acentos: la forma comparable. */
function tokenizeKey(value: string): string[] {
  return tokenize(value).map((word) => normalizeKey(word));
}

/** ¿`phrase` aparece como palabras seguidas dentro de `list`? */
function containsPhrase(list: string[], phrase: string[]): boolean {
  if (phrase.length === 0 || phrase.length > list.length) return false;
  for (let i = 0; i + phrase.length <= list.length; i += 1) {
    let matches = true;
    for (let j = 0; j < phrase.length; j += 1) {
      if (list[i + j] !== phrase[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

/**
 * Posiciones (sobre los tokens de `tokenizeKey`) del trabajo dentro del título.
 * "Estudiar para el examen de dibujo técnico" → [5, 6]; "estudiar para mañana"
 * → [] (no queda ningún trabajo).
 */
function workIndexes(keys: string[]): number[] {
  let index = 0;
  let sawLead = false;
  while (index < keys.length) {
    const word = keys[index];
    if (LEAD_WORDS.includes(word)) {
      sawLead = true;
      index += 1;
      continue;
    }
    if (sawLead && CONNECTORS.has(word)) {
      index += 1;
      continue;
    }
    break;
  }
  if (!sawLead) return [];

  const kept: number[] = [];
  for (let i = index; i < keys.length; i += 1) {
    if (NOT_A_SUBJECT.has(keys[i])) continue;
    kept.push(i);
  }
  return kept;
}

/** ¿Los tokens son un nombre de asignatura razonable? */
function isValidSubjectWords(keys: string[]): boolean {
  if (keys.length === 0 || keys.length > 4) return false;
  return keys.every(
    (word) => word.length >= 3 && !NOT_A_SUBJECT.has(word) && !Number.isFinite(Number(word)),
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Deduce la asignatura del texto: del título de una tarea ("Estudiar dibujo
 * técnico") o de lo que el usuario escribe al empezar un pomodoro.
 *
 * Orden de preferencia:
 *  1. Una asignatura que ya existe y aparece en el texto ("... de Historia de
 *     España" → Historia de España, "... mates" → Matemáticas).
 *  2. Un diminutivo del candidato que corresponde a una asignatura existente.
 *  3. El propio candidato como asignatura nueva ("dibujo técnico"), siempre que
 *     parezca un nombre de asignatura: ni genérico ("deberes"), ni de tiempo
 *     ("mañana"), ni un número ("2 horas").
 *
 * `allowWholeTitle` deja usar el título entero como candidato cuando no hay
 * ninguna palabra guía. Se usa en sesiones de estudio y exámenes ("Dibujo
 * técnico"), no en tareas sueltas ("Comprar pan"), que no son asignaturas.
 * Devuelve `null` cuando no hay nada fiable que deducir.
 */
export function inferSubjectFromTitle(
  title: string,
  subjects: readonly { name: string }[],
  options: { allowWholeTitle?: boolean } = {},
): SubjectGuess | null {
  const keys = tokenizeKey(title);
  if (keys.length === 0) return null;

  // 1) Una asignatura existente que aparece en el texto: nunca se inventa otra.
  const byLength = [...subjects].sort((a, b) => b.name.length - a.name.length);
  for (const subject of byLength) {
    const phrase = tokenizeKey(subject.name);
    if (containsPhrase(keys, phrase)) return { name: subject.name, exists: true };
  }

  const indexes = workIndexes(keys);
  const words = tokenize(title);
  const keepAccents = words.length === keys.length;
  const candidateKeys = indexes.map((i) => keys[i]);
  const candidateWords = indexes.map((i) => (keepAccents ? words[i] : keys[i]));
  const candidate = candidateWords.join(" ");

  // 2) El candidato (diminutivos incluidos) ya es una asignatura del usuario:
  //    "estudiar mates" con Matemáticas creada no inventa una asignatura nueva.
  const known = candidate
    ? findSubjectByName(candidate, subjects)
    : options.allowWholeTitle
      ? findSubjectByName(title, subjects)
      : undefined;
  if (known) return { name: known.name, exists: true };

  // 3) Asignatura nueva, solo si el texto parece de verdad una asignatura.
  if (candidateKeys.length > 0) {
    return isValidSubjectWords(candidateKeys)
      ? { name: capitalize(candidate), exists: false }
      : null;
  }
  if (options.allowWholeTitle && isValidSubjectWords(keys)) {
    return {
      name: capitalize(keepAccents ? words.join(" ") : keys.join(" ")),
      exists: false,
    };
  }
  return null;
}
