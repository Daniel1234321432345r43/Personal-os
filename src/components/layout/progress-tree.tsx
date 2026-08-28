"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Leaf, Sparkles, Target, X, Sun, Trees, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { todayKey } from "@/lib/format";
import { useData } from "@/components/providers/data-provider";
import { DAILY_CAP, effectiveXpCap } from "@/lib/xp-cap";

const STORAGE_KEY = "nucleo:progress-tree:v3";
const CELEBRATED_KEY = "nucleo:progress-tree:celebrated";
const TREE_API = "/api/tree/progress";

const XP_COLORS = { task: "#16a34a", pomodoro: "#ea580c", habit: "#0ea5e9" } as const;

type Particle = { id: string; value: number; color: string; limit: boolean; x: number; delay: number };

/** Posición de un árbol dentro de la escena. "center" es el árbol activo inicial. */
type TreePosition = "back" | "front" | "left" | "right" | "center";

/** Árbol ya cultivado (completado): queda visible en la escena. */
type PlantedTree = { id: string; position: TreePosition; plantedAt: string };

const LEVELS = [
  { name: "Brote", subtitle: "0 - 100 XP", required: 0, emoji: "🌱" },
  { name: "Planta joven", subtitle: "101 - 300 XP", required: 101, emoji: "🌿" },
  { name: "Árbol mediano", subtitle: "301 - 650 XP", required: 301, emoji: "🌳" },
  { name: "Árbol grande", subtitle: "651 - 1200 XP", required: 651, emoji: "🌲" },
  { name: "Secuoya final", subtitle: "1201+ XP", required: 1201, emoji: "🌲" },
] as const;

type SavedTree = { level: number; xp: number; lastCalculated: string; xpByDay: Record<string, number>; trees: PlantedTree[]; treesPlanted: number; position: TreePosition };
function emptyTree(): SavedTree { return { level: 0, xp: 0, lastCalculated: todayKey(), xpByDay: {}, trees: [], treesPlanted: 0, position: "center" }; }
function readTree(): SavedTree {
  if (typeof window === "undefined") return emptyTree();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SavedTree> | null;
    if (parsed && typeof parsed.xp === "number") return { ...emptyTree(), ...parsed, xpByDay: parsed.xpByDay ?? {}, trees: parsed.trees ?? [], treesPlanted: parsed.treesPlanted ?? 0, position: parsed.position ?? "center" };
  } catch { /* Estado local inválido. */ }
  return emptyTree();
}

/** IDs de completados ya celebrados hoy ("tipo:YYYY-MM-DD:id"), para no repetir partículas. */
function readCelebrated(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const today = todayKey();
    const parsed = JSON.parse(localStorage.getItem(CELEBRATED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id.startsWith(today)) : []);
  } catch { /* Estado local inválido. */ }
  return new Set();
}

type Data = ReturnType<typeof useData>["data"];
function dayKey(date: Date) { return date.toISOString().slice(0, 10); }
function dateValue(value: string | null | undefined) { return value ? new Date(`${value.slice(0, 10)}T00:00:00`).getTime() : 0; }
function levelForXp(xp: number) { return Math.max(0, LEVELS.reduce((current, item, index) => xp >= item.required ? index : current, 0)); }

function xpForDay(data: Data, key: string): number {
  const tasks = data.tasks.filter((item) => item.status === "done" && item.updated_at.slice(0, 10) === key);
  const pomodoros = tasks.filter((item) => item.type === "study_session");
  const habits = data.habitCompletions.filter((item) => item.completed_on === key);
  const missedHabits = key < todayKey() ? data.habits.filter((habit) => !habits.some((item) => item.habit_id === habit.id)).length : 0;
  // Días pasados sin NINGÚN entrenamiento restan 10 XP (no el día en curso).
  const noWorkout = key < todayKey() && !data.workouts.some((item) => item.date === key) ? 10 : 0;
  return Math.max(-25, Math.min(effectiveXpCap(), tasks.length * 20 + pomodoros.length * 25 + habits.length * 5 - missedHabits * 15 - noWorkout));
}

function FallingLeaves({ reduced }: { reduced: boolean }) {
  const leaves = [
    { left: "18%", delay: 0, duration: 5.5, color: "#65a30d" },
    { left: "31%", delay: 1.8, duration: 6.4, color: "#84cc16" },
    { left: "44%", delay: 3.2, duration: 5.8, color: "#a3e635" },
    { left: "57%", delay: 0.9, duration: 6.8, color: "#4d7c0f" },
    { left: "70%", delay: 2.6, duration: 5.9, color: "#bef264" },
    { left: "80%", delay: 4.1, duration: 6.2, color: "#65a30d" },
  ];
  return <div className="pointer-events-none absolute left-[18%] right-[18%] top-[4%] bottom-[18%] z-20 overflow-hidden" aria-hidden="true">
    {leaves.map((leaf, index) => <motion.span key={index} className="absolute top-[18%] h-2.5 w-1.5 rounded-full" style={{ left: leaf.left, backgroundColor: leaf.color }} animate={reduced ? { opacity: 0.65 } : { opacity: [0, 1, 1, 0], y: [0, 70, 145, 270], x: [0, 32, -24, 42], rotate: [0, 140, 260, 420] }} transition={reduced ? undefined : { delay: leaf.delay, duration: leaf.duration, repeat: Infinity, ease: "easeInOut" }} />)}
  </div>;
}

const TREE_SIZES = ["h-[68%] w-[76%]", "h-[100%] w-[110%]", "h-[136%] w-[140%]", "h-[168%] w-[172%]", "h-[188%] w-[188%]"];

/** Configuración visual de cada posición: capa (z-index) y escala relativa. */
const POSITION_LABELS: Record<TreePosition, string> = {
  back: "Detrás",
  front: "Delante",
  left: "Izquierda",
  right: "Derecha",
  center: "Centro",
};

const POSITION_CFG: Record<TreePosition, { z: number; scale: number; left: string; centered: boolean }> = {
  // Detrás: capa inferior y todas las fases más pequeñas.
  back: { z: 1, scale: 0.5, left: "50%", centered: true },
  // Laterales: capa media y tamaño intermedio.
  left: { z: 2, scale: 0.78, left: "8%", centered: false },
  right: { z: 2, scale: 0.78, left: "90%", centered: false },
  // Delante: capa superior y todas las fases más grandes.
  front: { z: 6, scale: 1.35, left: "50%", centered: true },
  // El árbol activo crece en el centro, entre los laterales y el frente.
  center: { z: 4, scale: 1, left: "50%", centered: true },
};

function TreeScene({ level, position, trees, reduced, transitionKey, particles, onParticleDone }: { level: number; position: TreePosition; trees: PlantedTree[]; reduced: boolean; transitionKey: number; particles: Particle[]; onParticleDone: (id: string) => void }) {
  const active = POSITION_CFG[position];
  return (
    <div className="relative isolate h-72 overflow-hidden rounded-2xl bg-[#d8f1e8]">
      <img src="/tree-assets/Fondo%20bosque.svg" alt="" aria-hidden="true" className="absolute inset-0 z-0 block h-full w-full object-cover object-bottom" onError={(event) => { event.currentTarget.style.display = "none"; }} />
      <FallingLeaves reduced={reduced} />
      {/* Árboles ya cultivados: cada uno se queda en la posición donde se plantó. */}
      {trees.map((tree) => {
        const cfg = POSITION_CFG[tree.position];
        return (
          <img
            key={tree.id}
            src="/tree-assets/tree-level-4.svg"
            alt="Árbol cultivado"
            className={`absolute bottom-[-1.5rem] ${TREE_SIZES[4]} object-contain object-bottom`}
            style={{
              left: cfg.left,
              zIndex: cfg.z,
              transformOrigin: "50% 100%",
              transform: cfg.centered ? `translateX(-50%) scale(${cfg.scale})` : `scale(${cfg.scale})`,
            }}
          />
        );
      })}
      {/* Árbol activo: crece en su posición, con la escala de su fase. */}
      <AnimatePresence mode="wait">
        <motion.img
          key={`${level}-${transitionKey}`}
          src={`/tree-assets/tree-level-${level}.svg`}
          alt={`Ilustración de ${LEVELS[level].name}`}
          className={`absolute bottom-[-1.5rem] ${TREE_SIZES[level]} object-contain object-bottom ${active.centered ? "left-1/2" : ""}`}
          style={{ left: active.centered ? undefined : active.left, zIndex: active.z, transformOrigin: "50% 100%" }}
          initial={{ opacity: 0, scale: 0.72 * active.scale }}
          animate={reduced ? { opacity: 1, scale: 1 * active.scale } : { opacity: 1, scale: [0.88 * active.scale, 1.08 * active.scale, 1 * active.scale] }}
          exit={{ opacity: 0, scale: 0.82 * active.scale }}
          transition={{ opacity: { duration: 0.25 }, scale: { type: "spring", stiffness: 360, damping: 16 } }}
        />
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
        {particles.map((particle) => (
          <motion.span
            key={particle.id}
            className="absolute"
            style={{ left: "50%", top: "38%" }}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={reduced ? { opacity: [0, 1, 0], y: -60 } : { opacity: [0, 1, 1, 0], y: [0, -60, -130, -200], x: [0, particle.x * 0.35, particle.x * 0.7, particle.x], scale: [0.5, 1.15, 1.05, 0.9] }}
            transition={{ duration: 2.6, ease: "easeOut", delay: particle.delay }}
            onAnimationComplete={() => onParticleDone(particle.id)}
          >
            <span className="block -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-xs font-black shadow-md" style={{ color: particle.color }}>{particle.limit ? "Límite diario alcanzado · vuelve mañana" : `+${particle.value} XP`}</span>
          </motion.span>
        ))}
      </div>
    </div>
  );
}

export function ProgressTree() {
  const { data } = useData();
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<SavedTree>(() => readTree());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [transitionKey, setTransitionKey] = useState(0);
  const [pendingGrowthMessage, setPendingGrowthMessage] = useState(false);
  const [celebrated] = useState(() => readCelebrated());
  const [particles, setParticles] = useState<Particle[]>([]);
  const [planting, setPlanting] = useState(false);
  const [showForest, setShowForest] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    fetch(TREE_API).then((response) => response.ok ? response.json() : null).then((remote: { xp?: number; level?: number; trees?: PlantedTree[]; trees_planted?: number } | null) => {
      if (cancelled || !remote || typeof remote.xp !== "number") return;
      setTree((current) => ({
        ...current,
        xp: Math.max(current.xp, remote.xp ?? 0),
        level: Math.max(current.level, remote.level ?? 0),
        trees: Array.isArray(remote.trees) && remote.trees.length > current.trees.length ? remote.trees : current.trees,
        treesPlanted: Math.max(current.treesPlanted, remote.trees_planted ?? 0),
      }));
      setRemoteLoaded(true);
    }).catch(() => setRemoteLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const calculated = useMemo(() => {
    if (!open) return tree;
    const nextDays = { ...tree.xpByDay };
    const cursor = new Date(`${tree.lastCalculated}T00:00:00`);
    const today = new Date(`${todayKey()}T00:00:00`);
    while (cursor <= today) {
      const key = dayKey(cursor);
      // El día de hoy se recalcula siempre: las tareas/hábitos de hoy cambian
      // durante el día y el bosque debe reflejarlo al abrirlo sin reiniciar.
      if (key === todayKey() || nextDays[key] == null) nextDays[key] = xpForDay(data, key);
      cursor.setDate(cursor.getDate() + 1);
    }
    const xp = Math.max(0, tree.xp + Object.entries(nextDays).filter(([key]) => dateValue(key) >= dateValue(tree.lastCalculated)).reduce((sum, [, value]) => sum + value, 0));
    return { ...tree, level: levelForXp(xp), xp, lastCalculated: todayKey(), xpByDay: nextDays };
  }, [data, open, tree]);

  useEffect(() => {
    if (!open) return;
    const upgraded = calculated.level > tree.level;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calculated));
    if (upgraded) { setShowUpgrade(true); setPendingGrowthMessage(true); setTransitionKey((key) => key + 1); }
    if (calculated.xp !== tree.xp || calculated.level !== tree.level) setTree(calculated);
  }, [calculated, open, tree.level, tree.xp]);

  useEffect(() => {
    if (!remoteLoaded || !open) return;
    const sync = async (source: string, ids: string[], xp: number) => { await Promise.all(ids.map((sourceId) => fetch(TREE_API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, sourceId, xp }) }))); };
    void sync("task", data.tasks.filter((item) => item.status === "done").map((item) => item.id), 20);
    void sync("habit", data.habitCompletions.map((item) => item.id), 5);
    void sync("pomodoro", data.tasks.filter((item) => item.type === "study_session" && item.status === "done").map((item) => item.id), 25);
  }, [data.habitCompletions, data.tasks, open, remoteLoaded]);

  useEffect(() => {
    if (!open) return;
    const today = todayKey();
    // Eventos de HOY en su orden real (tareas, luego hábitos), marcando si ya fueron celebrados.
    type TodayEvent = { id: string; value: number; color: string; celebrated: boolean };
    const events: TodayEvent[] = [];
    for (const task of data.tasks) {
      if (task.status !== "done" || task.updated_at.slice(0, 10) !== today) continue;
      const id = `task:${task.id}`;
      const pomodoro = task.type === "study_session";
      events.push({ id, value: pomodoro ? 25 : 20, color: pomodoro ? XP_COLORS.pomodoro : XP_COLORS.task, celebrated: celebrated.has(id) });
    }
    for (const habit of data.habitCompletions) {
      if (habit.completed_on !== today) continue;
      const id = `habit:${habit.id}`;
      events.push({ id, value: 5, color: XP_COLORS.habit, celebrated: celebrated.has(id) });
    }
    // XP bruto de HOY: partiendo de lo ya celebrado, saber si cada nuevo evento cruza el tope diario.
    let acc = events.reduce((sum, event) => sum + (event.celebrated ? event.value : 0), 0);
    const pending: { id: string; value: number; color: string; limit: boolean }[] = [];
    for (const event of events) {
      if (event.celebrated) continue;
      celebrated.add(event.id);
      acc += event.value;
      // Si al sumar este evento superamos el cap, ya no aporta XP: avisar del límite.
      pending.push({ id: event.id, value: event.value, color: event.color, limit: acc > effectiveXpCap() });
    }
    if (pending.length === 0) return;
    try { localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...celebrated].slice(-200))); } catch { /* Almacenamiento no disponible. */ }
    const burst = pending.slice(0, 8).map((item, index) => ({ id: `${item.id}:${Date.now()}:${index}`, value: item.value, color: item.color, limit: item.limit, x: Math.round((Math.random() - 0.5) * 140), delay: index * 0.18 }));
    setParticles((prev) => [...prev, ...burst]);
  }, [celebrated, data.habitCompletions, data.tasks, open]);

  /** Planta un árbol nuevo: congela el actual como cultivado y reinicia el progreso. */
  const plantTree = (position: TreePosition) => {
    const completed: PlantedTree = { id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `tree-${Date.now()}`, position: tree.position, plantedAt: todayKey() };
    setTree((current) => ({
      ...current,
      level: 0,
      xp: 0,
      lastCalculated: todayKey(),
      xpByDay: {},
      trees: [...current.trees, completed],
      treesPlanted: current.treesPlanted + 1,
      position,
    }));
    setPlanting(false);
    setTransitionKey((key) => key + 1);
    // Refleja el plantado en Supabase (idempotente; si falla, el local manda).
    fetch(`${TREE_API}/plant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position }) }).catch(() => {});
  };

  const formatPlanted = (date: string) => {
    const d = new Date(`${date}T00:00:00`);
    return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  // Porcentaje de la ÚLTIMA VISITA guardada (tree antes de recalcular): es el
  // punto de partida de la barra al abrir, para que anime creciendo o menguando
  // desde lo que viste la vez anterior hasta el estado actual.
  const lastLevel = levelForXp(tree.xp);
  const lastCurrent = LEVELS[lastLevel];
  const lastNext = LEVELS[lastLevel + 1];
  const lastPercentage = lastNext ? ((tree.xp - lastCurrent.required) / (lastNext.required - lastCurrent.required)) * 100 : 100;
  const current = LEVELS[calculated.level];
  const next = LEVELS[calculated.level + 1];
  const percentage = next ? ((calculated.xp - current.required) / (next.required - current.required)) * 100 : 100;
  const weekXp = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - index); return calculated.xpByDay[dayKey(date)] ?? 0; }).reduce((sum, value) => sum + value, 0);
  const diagnosis = calculated.xp === 0 ? "Empieza completando una tarea, un hábito o un Pomodoro para conseguir XP." : next ? `${calculated.xp} XP acumulados. Te faltan ${Math.max(0, next.required - calculated.xp)} XP para la siguiente fase.` : "¡Has alcanzado la Secuoya final! Sigue cuidando tu constancia.";

  return <>
    <Button variant="ghost" size="icon" className="h-9 w-9 text-emerald-600 dark:text-emerald-400" onClick={() => setOpen(true)} aria-label="Abrir árbol de progreso"><Leaf className="h-5 w-5" /></Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="max-h-[94vh] rounded-t-3xl border-0 bg-sky-50 p-0 text-slate-900">
        <SheetHeader className="border-b border-sky-200 px-6 pb-3 pt-5"><SheetTitle className="flex items-center gap-2 text-slate-900"><Leaf className="h-5 w-5 text-emerald-600" /> Mi bosque de progreso</SheetTitle></SheetHeader>
        {pendingGrowthMessage && <motion.div initial={{ opacity: 0, y: -10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mx-5 mt-4 flex flex-col items-center gap-1.5 rounded-2xl border border-lime-300 bg-gradient-to-b from-lime-100 to-emerald-50 p-4 text-center"><Sparkles className="h-6 w-6 text-lime-600" /><p className="text-lg font-black text-green-950">¡Tu árbol ha crecido! 🎉</p><img src={`/tree-assets/tree-level-${calculated.level}.svg`} alt={`Fase ${LEVELS[calculated.level].name}`} className="h-28 w-28 object-contain" /><p className="text-base font-bold text-green-900">Has desbloqueado la fase {LEVELS[calculated.level].emoji} {LEVELS[calculated.level].name}</p><p className="text-xs font-medium text-green-700">Sigue cuidándolo para que siga creciendo.</p></motion.div>}
        <div className="overflow-y-auto px-5 pb-8 pt-4">
          <div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-lime-400 px-3 py-1 text-xs font-black text-green-950">LVL {calculated.level + 1}</span><span className="flex items-center gap-2"><span className="flex items-center gap-1 text-sm font-semibold text-amber-700"><Sun className="h-4 w-4" /> {calculated.xp} XP</span><Button variant="outline" size="sm" className="h-8 gap-1 rounded-full border-emerald-300 bg-white/70 px-2.5 text-xs font-bold text-emerald-700 hover:bg-white" onClick={() => setShowForest((value) => !value)} aria-label="Ver árboles cultivados"><Trees className="h-4 w-4" /> {calculated.treesPlanted}</Button></span></div>
          <TreeScene level={calculated.level} position={calculated.position} trees={calculated.trees} reduced={Boolean(reduced)} transitionKey={transitionKey} particles={particles} onParticleDone={(id) => setParticles((prev) => prev.filter((p) => p.id !== id))} />
          <AnimatePresence>
            {showForest && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-3 rounded-xl bg-white/80 p-4 shadow-sm">
                  <p className="flex items-center gap-2 text-sm font-bold text-slate-800"><Trees className="h-4 w-4 text-emerald-600" /> Árboles cultivados</p>
                  <p className="mt-1 text-3xl font-black text-emerald-700">{calculated.treesPlanted}</p>
                  <p className="text-xs text-slate-500">{calculated.treesPlanted === 0 ? "Aún no has completado ningún ciclo. Lleva un árbol a la Secuoya final para poder plantar el siguiente." : calculated.treesPlanted === 1 ? "árbol que ha completado el ciclo completo. ¡Sigue así!" : "árboles que han completado el ciclo completo."}</p>
                  <ul className="mt-3 space-y-1">
                    {[...calculated.trees].reverse().map((tree) => (
                      <li key={tree.id} className="flex items-center justify-between text-xs text-slate-600">
                        <span className="flex items-center gap-1.5"><span className="text-base">🌲</span> Secuoya final</span>
                        <span className="text-slate-400">{POSITION_LABELS[tree.position]} · {formatPlanted(tree.plantedAt)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {calculated.level === LEVELS.length - 1 && !planting && <Button variant="outline" className="mt-3 w-full border-lime-400 bg-lime-100/80 text-green-950 hover:bg-lime-200" onClick={() => setPlanting(true)}><Sprout className="h-4 w-4" /> Plantar un nuevo árbol</Button>}
          {calculated.level === LEVELS.length - 1 && planting && <div className="mt-3 rounded-xl bg-white/80 p-3 shadow-sm"><p className="text-center text-xs font-bold text-slate-600">¿Dónde quieres plantar el nuevo árbol?</p><div className="mt-2 grid grid-cols-2 gap-2">{(Object.keys(POSITION_LABELS).filter((key) => key !== "center") as TreePosition[]).map((position) => <Button key={position} variant="outline" size="sm" className="border-emerald-300 bg-white/70 text-emerald-800 hover:bg-white" onClick={() => plantTree(position)}>{POSITION_LABELS[position]}</Button>)}</div><Button variant="ghost" size="sm" className="mt-2 w-full text-slate-500" onClick={() => setPlanting(false)}>Cancelar</Button></div>}
          <AnimatePresence mode="wait">{showUpgrade && <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 rounded-xl bg-lime-400 p-3 text-center text-sm font-bold text-green-950"><Sparkles className="mx-auto mb-1 h-5 w-5" /> ¡Fase actualizada! Tu árbol ha crecido.</motion.div>}</AnimatePresence>
          <div className="mt-4 flex items-end justify-between"><div><p className="text-lg font-semibold">{current.emoji} {current.name}</p><p className="text-sm text-slate-600">{current.subtitle}</p></div><p className="text-xs text-slate-500">{next ? `${Math.max(0, next.required - calculated.xp)} XP para el siguiente nivel` : "Nivel máximo"}</p></div>
          <div className="mt-3 space-y-2"><div className="flex justify-between text-xs text-slate-500"><span>Progreso de fase</span><span>{Math.round(Math.max(0, calculated.xp - current.required))} / {next ? next.required - current.required : 1}</span></div><div className="h-2 overflow-hidden rounded-full bg-sky-200"><motion.div key={open ? "xp-bar-open" : "xp-bar-closed"} className="h-full rounded-full bg-emerald-500" initial={{ width: `${Math.max(0, Math.min(100, lastPercentage))}%` }} animate={reduced ? { width: `${Math.max(0, Math.min(100, percentage))}%` } : { width: `${Math.max(0, Math.min(100, percentage))}%` }} transition={reduced ? { duration: 0 } : { duration: 1.6, ease: [0.25, 0.1, 0.25, 1] }} /></div></div>
          <p className="mt-5 rounded-xl bg-white/75 p-4 text-sm leading-relaxed text-slate-700 shadow-sm">{diagnosis}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-center text-xs text-slate-500"><Target className="h-4 w-4" /> +20 tareas · +25 pomodoros · +5 hábitos · -15 hábitos incumplidos · -10 día sin entrenar · tope 120/día</div>
          <SheetClose asChild><Button variant="outline" className="mt-5 w-full border-sky-300 bg-white/60 text-slate-700 hover:bg-white"><X className="h-4 w-4" /> Cerrar</Button></SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  </>;
}
