"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Leaf, Sparkles, Target, X, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { localDayKey, todayKey } from "@/lib/format";
import { useData } from "@/components/providers/data-provider";
import { effectiveXpCap } from "@/lib/xp-cap";

const STORAGE_KEY = "nucleo:progress-tree:v4";
const CELEBRATED_KEY = "nucleo:progress-tree:celebrated";
const TREE_API = "/api/tree/progress";
const XP_COLORS = { task: "#16a34a", pomodoro: "#ea580c", habit: "#0ea5e9" } as const;

type Particle = { id: string; value: number; color: string; limit: boolean; x: number; delay: number };
const LEVELS = [
  { name: "Brote", subtitle: "0 - 100 XP", required: 0, emoji: "🌱" },
  { name: "Planta joven", subtitle: "101 - 300 XP", required: 101, emoji: "🌿" },
  { name: "Árbol mediano", subtitle: "301 - 650 XP", required: 301, emoji: "🌳" },
  { name: "Árbol grande", subtitle: "651 - 1200 XP", required: 651, emoji: "🌲" },
  { name: "Secuoya final", subtitle: "1201+ XP", required: 1201, emoji: "🌲" },
] as const;
type SavedTree = { level: number; xp: number; lastCalculated: string; xpByDay: Record<string, number> };
function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function yesterdayKey() { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); }
function emptyTree(): SavedTree { return { level: 0, xp: 0, lastCalculated: yesterdayKey(), xpByDay: {} }; }
function readTree(): SavedTree {
  if (typeof window === "undefined") return emptyTree();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SavedTree> | null;
    if (parsed && typeof parsed.xp === "number") return { ...emptyTree(), ...parsed, xpByDay: parsed.xpByDay ?? {} };
  } catch { /* Estado inválido. */ }
  return emptyTree();
}
function readCelebrated(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const today = todayKey();
    const parsed = JSON.parse(localStorage.getItem(CELEBRATED_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id.includes(`:${today}:`)) : []);
  } catch { return new Set(); }
}
type Data = ReturnType<typeof useData>["data"];
function levelForXp(xp: number) { return Math.max(0, LEVELS.reduce((current, item, index) => xp >= item.required ? index : current, 0)); }
function xpForDay(data: Data, key: string): number {
  const tasks = data.tasks.filter((item) => item.status === "done" && localDayKey(item.updated_at) === key);
  const pomodoros = tasks.filter((item) => item.type === "study_session");
  const habits = data.habitCompletions.filter((item) => item.completed_on === key);
  const missedHabits = key < todayKey() ? data.habits.filter((habit) => !habits.some((item) => item.habit_id === habit.id)).length : 0;
  const noWorkout = key < todayKey() && !data.workouts.some((item) => item.date === key) ? 10 : 0;
  return Math.max(-25, Math.min(effectiveXpCap(), tasks.length * 20 + pomodoros.length * 25 + habits.length * 5 - missedHabits * 15 - noWorkout));
}
function FallingLeaves({ reduced }: { reduced: boolean }) {
  const leaves = ["#65a30d", "#84cc16", "#a3e635", "#4d7c0f", "#bef264", "#65a30d", "#84cc16", "#a3e635"];
  return <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">{leaves.map((color, index) => <motion.span key={index} className="absolute top-[-4%] h-1.5 w-2 rounded-full" style={{ left: `${index * 13 + 3}%`, backgroundColor: color }} animate={reduced ? { opacity: 0.6 } : { opacity: [0, 1, 1, 0], y: [0, 120, 240, 340], x: [0, 20 + index * 4, 40 + index * 5, 55 + index * 6], rotate: [0, 180, 360, 540] }} transition={reduced ? undefined : { delay: index * 0.7, duration: 6.5 + index * 0.2, repeat: Infinity, ease: "easeInOut" }} />)}</div>;
}
function TreeScene({ level, reduced, transitionKey, particles, onParticleDone }: { level: number; reduced: boolean; transitionKey: number; particles: Particle[]; onParticleDone: (id: string) => void }) {
  return <div className="relative isolate h-72 overflow-hidden rounded-2xl bg-[#d8f1e8]"><AnimatePresence mode="wait"><motion.img key={`${level}-${transitionKey}`} src={`/tree-assets/escena-nivel-${level}.svg`} alt={`Ilustración de ${LEVELS[level].name}`} className="absolute inset-0 z-0 block h-full w-full object-cover object-bottom" initial={{ opacity: 0, scale: 1.06 }} animate={reduced ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [1.06, 1.02, 1] }} exit={{ opacity: 0, scale: 0.985 }} transition={reduced ? { opacity: { duration: 0.35 } } : { opacity: { duration: 0.35 }, scale: { type: "spring", stiffness: 260, damping: 20 } }} onError={(event) => { event.currentTarget.style.display = "none"; }} /></AnimatePresence><FallingLeaves reduced={reduced} /><div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">{particles.map((particle) => <motion.span key={particle.id} className="absolute" style={{ left: "50%", top: "38%" }} initial={{ opacity: 0, y: 0, scale: 0.5 }} animate={reduced ? { opacity: [0, 1, 0], y: -60 } : { opacity: [0, 1, 1, 0], y: [0, -60, -130, -200], x: [0, particle.x * 0.35, particle.x * 0.7, particle.x], scale: [0.5, 1.15, 1.05, 0.9] }} transition={{ duration: 2.6, ease: "easeOut", delay: particle.delay }} onAnimationComplete={() => onParticleDone(particle.id)}><span className="block -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-xs font-black shadow-md" style={{ color: particle.color }}>{particle.limit ? "Límite diario alcanzado · vuelve mañana" : `+${particle.value} XP`}</span></motion.span>)}</div></div>;
}
export function ProgressTree() {
  const { data } = useData();
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<SavedTree>(() => readTree());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [transitionKey, setTransitionKey] = useState(0);
  const [pendingGrowthMessage, setPendingGrowthMessage] = useState(false);
  const [seenLevel, setSeenLevel] = useState(() => readTree().level);
  const [celebrated] = useState(() => readCelebrated());
  const [particles, setParticles] = useState<Particle[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    fetch(TREE_API).then((response) => response.ok ? response.json() : null).then((remote: { xp?: number; level?: number } | null) => { if (!cancelled && remote) setRemoteLoaded(true); else if (!cancelled) setRemoteLoaded(true); }).catch(() => setRemoteLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const calculated = useMemo(() => {
    if (!open) return tree;
    const nextDays = { ...tree.xpByDay };
    const cursor = new Date(`${tree.lastCalculated}T00:00:00`);
    const today = new Date(`${todayKey()}T00:00:00`);
    while (cursor <= today) { const key = dayKey(cursor); if (key === todayKey() || nextDays[key] == null) nextDays[key] = xpForDay(data, key); cursor.setDate(cursor.getDate() + 1); }
    const todayValue = nextDays[todayKey()] ?? 0;
    const previousToday = tree.xpByDay[todayKey()] ?? 0;
    const laterDays = Object.entries(nextDays).filter(([key]) => key > tree.lastCalculated).reduce((sum, [, value]) => sum + value, 0);
    const todayCorrection = tree.lastCalculated >= todayKey() ? todayValue - previousToday : 0;
    const xp = Math.max(0, tree.xp + laterDays + todayCorrection);
    return { ...tree, level: levelForXp(xp), xp, lastCalculated: todayKey(), xpByDay: nextDays };
  }, [data, open, tree]);

  useEffect(() => {
    if (!open) return;
    const upgraded = calculated.level > seenLevel;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calculated));
    if (upgraded) { setShowUpgrade(true); setPendingGrowthMessage(true); setTransitionKey((key) => key + 1); setSeenLevel(calculated.level); }
    if (calculated.xp !== tree.xp || calculated.level !== tree.level || calculated.lastCalculated !== tree.lastCalculated) setTree(calculated);
  }, [calculated, open, seenLevel, tree]);

  useEffect(() => {
    if (!open) { setPendingGrowthMessage(false); setShowUpgrade(false); }
  }, [open]);

  // Solo registra el resumen local en la nube. No envía eventos individuales al abrir,
  // por lo que refrescar o cambiar de dispositivo nunca puede duplicar recompensas.
  useEffect(() => {
    if (!remoteLoaded || !open) return;
    const timer = window.setTimeout(() => { void fetch(TREE_API, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ xp: calculated.xp, level: calculated.level }) }); }, 250);
    return () => window.clearTimeout(timer);
  }, [calculated.xp, calculated.level, open, remoteLoaded]);

  useEffect(() => {
    if (!open) return;
    const today = todayKey();
    type TodayEvent = { id: string; value: number; color: string; celebrated: boolean };
    const events: TodayEvent[] = [];
    for (const task of data.tasks) { if (task.status !== "done" || localDayKey(task.updated_at) !== today) continue; const pomodoro = task.type === "study_session"; const id = `task:${today}:${task.id}`; events.push({ id, value: pomodoro ? 25 : 20, color: pomodoro ? XP_COLORS.pomodoro : XP_COLORS.task, celebrated: celebrated.has(id) }); }
    for (const habit of data.habitCompletions) { if (habit.completed_on !== today) continue; const id = `habit:${today}:${habit.id}`; events.push({ id, value: 5, color: XP_COLORS.habit, celebrated: celebrated.has(id) }); }
    let acc = events.reduce((sum, event) => sum + (event.celebrated ? event.value : 0), 0);
    const pending: { id: string; value: number; color: string; limit: boolean }[] = [];
    for (const event of events) { if (event.celebrated) continue; celebrated.add(event.id); acc += event.value; pending.push({ id: event.id, value: event.value, color: event.color, limit: acc > effectiveXpCap() }); }
    if (pending.length === 0) return;
    try { localStorage.setItem(CELEBRATED_KEY, JSON.stringify([...celebrated].slice(-200))); } catch { /* ignorar */ }
    const burst = pending.slice(0, 8).map((item, index) => ({ id: `${item.id}:${Date.now()}:${index}`, value: item.value, color: item.color, limit: item.limit, x: Math.round((Math.random() - 0.5) * 140), delay: index * 0.18 }));
    setParticles((prev) => [...prev, ...burst]);
  }, [celebrated, data.habitCompletions, data.tasks, open]);

  const lastLevel = levelForXp(tree.xp);
  const lastCurrent = LEVELS[lastLevel];
  const lastNext = LEVELS[lastLevel + 1];
  const lastPercentage = lastNext ? ((tree.xp - lastCurrent.required) / (lastNext.required - lastCurrent.required)) * 100 : 100;
  const current = LEVELS[calculated.level];
  const next = LEVELS[calculated.level + 1];
  const percentage = next ? ((calculated.xp - current.required) / (next.required - current.required)) * 100 : 100;
  const diagnosis = calculated.xp === 0 ? "Empieza completando una tarea, un hábito o un Pomodoro para conseguir XP." : next ? `${calculated.xp} XP acumulados. Te faltan ${Math.max(0, next.required - calculated.xp)} XP para la siguiente fase.` : "¡Has alcanzado la Secuoya final! Sigue cuidando tu constancia.";

  return <><Button variant="ghost" size="icon" className="h-9 w-9 text-emerald-600 dark:text-emerald-400" onClick={() => setOpen(true)} aria-label="Abrir árbol de progreso"><Leaf className="h-5 w-5" /></Button><Sheet open={open} onOpenChange={setOpen}><SheetContent side="bottom" className="max-h-[94vh] rounded-t-3xl border-0 bg-sky-50 p-0 text-slate-900"><SheetHeader className="border-b border-sky-200 px-6 pb-3 pt-5"><SheetTitle className="flex items-center gap-2 text-slate-900"><Leaf className="h-5 w-5 text-emerald-600" /> Mi árbol de progreso</SheetTitle></SheetHeader>{pendingGrowthMessage && <motion.div initial={{ opacity: 0, y: -10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="mx-5 mt-4 flex flex-col items-center gap-1.5 rounded-2xl border border-lime-300 bg-gradient-to-b from-lime-100 to-emerald-50 p-4 text-center"><Sparkles className="h-6 w-6 text-lime-600" /><p className="text-lg font-black text-green-950">¡Tu árbol ha crecido! 🎉</p><img src={`/tree-assets/escena-nivel-${calculated.level}.svg`} alt={`Fase ${LEVELS[calculated.level].name}`} className="h-24 w-40 rounded-lg object-cover object-bottom" /><p className="text-base font-bold text-green-900">Has desbloqueado la fase {LEVELS[calculated.level].emoji} {LEVELS[calculated.level].name}</p><p className="text-xs font-medium text-green-700">Sigue cuidándolo para que siga creciendo.</p></motion.div>}<div className="overflow-y-auto px-5 pb-8 pt-4"><div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-lime-400 px-3 py-1 text-xs font-black text-green-950">LVL {calculated.level + 1}</span><span className="flex items-center gap-1 text-sm font-semibold text-amber-700"><Sun className="h-4 w-4" /> {calculated.xp} XP</span></div><TreeScene level={calculated.level} reduced={Boolean(reduced)} transitionKey={transitionKey} particles={particles} onParticleDone={(id) => setParticles((prev) => prev.filter((p) => p.id !== id))} /><AnimatePresence mode="wait">{showUpgrade && <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 rounded-xl bg-lime-400 p-3 text-center text-sm font-bold text-green-950"><Sparkles className="mx-auto mb-1 h-5 w-5" /> ¡Fase actualizada! Tu árbol ha crecido.</motion.div>}</AnimatePresence><div className="mt-4 flex items-end justify-between"><div><p className="text-lg font-semibold">{current.emoji} {current.name}</p><p className="text-sm text-slate-600">{current.subtitle}</p></div><p className="text-xs text-slate-500">{next ? `${Math.max(0, next.required - calculated.xp)} XP para el siguiente nivel` : "Nivel máximo"}</p></div><div className="mt-3 space-y-2"><div className="flex justify-between text-xs text-slate-500"><span>Progreso de fase</span><span>{Math.round(Math.max(0, calculated.xp - current.required))} / {next ? next.required - current.required : 1}</span></div><div className="h-2 overflow-hidden rounded-full bg-sky-200"><motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: `${Math.max(0, Math.min(100, lastPercentage))}%` }} animate={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} transition={reduced ? { duration: 0 } : { duration: 1.6, ease: [0.25, 0.1, 0.25, 1] }} /></div></div><p className="mt-5 rounded-xl bg-white/75 p-4 text-sm leading-relaxed text-slate-700 shadow-sm">{diagnosis}</p><div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-center text-xs text-slate-500"><Target className="h-4 w-4" /> +20 tareas · +25 pomodoros · +5 hábitos · -15 hábitos incumplidos · -10 día sin entrenar · tope 120/día</div><SheetClose asChild><Button variant="outline" className="mt-5 w-full border-sky-300 bg-white/60 text-slate-700 hover:bg-white"><X className="h-4 w-4" /> Cerrar</Button></SheetClose></div></SheetContent></Sheet></>;
}
