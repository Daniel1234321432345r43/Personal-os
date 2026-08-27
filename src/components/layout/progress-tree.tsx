"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Leaf, Sparkles, Target, X, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { todayKey } from "@/lib/format";
import { useData } from "@/components/providers/data-provider";

const STORAGE_KEY = "nucleo:progress-tree:v3";
const TREE_API = "/api/tree/progress";
const DAILY_CAP = 120;

const LEVELS = [
  { name: "Brote", subtitle: "0 - 100 XP", required: 0, emoji: "🌱" },
  { name: "Planta joven", subtitle: "101 - 300 XP", required: 101, emoji: "🌿" },
  { name: "Árbol mediano", subtitle: "301 - 650 XP", required: 301, emoji: "🌳" },
  { name: "Árbol grande", subtitle: "651 - 1200 XP", required: 651, emoji: "🌲" },
  { name: "Secuoya final", subtitle: "1201+ XP", required: 1201, emoji: "🌲" },
] as const;

type SavedTree = { level: number; xp: number; lastCalculated: string; xpByDay: Record<string, number> };
function emptyTree(): SavedTree { return { level: 0, xp: 0, lastCalculated: todayKey(), xpByDay: {} }; }
function readTree(): SavedTree {
  if (typeof window === "undefined") return emptyTree();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SavedTree> | null;
    if (parsed && typeof parsed.xp === "number") return { ...emptyTree(), ...parsed, xpByDay: parsed.xpByDay ?? {} };
  } catch { /* Estado local inválido. */ }
  return emptyTree();
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
  return Math.max(-15, Math.min(DAILY_CAP, tasks.length * 20 + pomodoros.length * 25 + habits.length * 5 - missedHabits * 15));
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
    {leaves.map((leaf, index) => <motion.span key={index} className="absolute top-[18%] h-2.5 w-1.5 rounded-full" style={{ left: leaf.left, backgroundColor: leaf.color }} animate={reduced ? { opacity: 0.65 } : { opacity: [0, 1, 1, 0], y: [0, 70, 145, 270], x: [0, 12, -10, 8], rotate: [0, 100, 210, 330] }} transition={reduced ? undefined : { delay: leaf.delay, duration: leaf.duration, repeat: Infinity, ease: "easeInOut" }} />)}
  </div>;
}

function TreeScene({ level, reduced, transitionKey }: { level: number; reduced: boolean; transitionKey: number }) {
  const treeSizes = ["h-[68%] w-[76%]", "h-[100%] w-[110%]", "h-[136%] w-[140%]", "h-[168%] w-[172%]", "h-[188%] w-[188%]"];
  return (
    <div className="relative isolate h-72 overflow-hidden rounded-2xl bg-[#d8f1e8]">
      <img src="/tree-assets/Fondo%20bosque.svg" alt="" aria-hidden="true" className="absolute inset-0 z-0 block h-full w-full object-cover object-bottom" onError={(event) => { event.currentTarget.style.display = "none"; }} />
      <FallingLeaves reduced={reduced} />
      <AnimatePresence mode="wait">
        <motion.img
          key={`${level}-${transitionKey}`}
          src={`/tree-assets/tree-level-${level}.svg`}
          alt={`Ilustración de ${LEVELS[level].name}`}
          className={`absolute bottom-[-1.5rem] left-1/2 z-10 ${treeSizes[level]} -translate-x-1/2 object-contain object-bottom`}
          style={{ transformOrigin: "50% 100%" }}
          initial={{ opacity: 0, scale: 0.72 }}
          animate={reduced ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [0.88, 1.08, 1], rotate: [-1.3, 1.3, -1.3] }}
          exit={{ opacity: 0, scale: 0.82 }}
          transition={{ opacity: { duration: 0.25 }, scale: { type: "spring", stiffness: 360, damping: 16 }, rotate: { duration: 5, repeat: Infinity, ease: "easeInOut" } }}
        />
      </AnimatePresence>
      <div className="absolute left-4 top-4 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-green-950 backdrop-blur">ESCENA · {LEVELS[level].name}</div>
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
  const reduced = useReducedMotion();

  useEffect(() => {
    let cancelled = false;
    fetch(TREE_API).then((response) => response.ok ? response.json() : null).then((remote: { xp?: number; level?: number } | null) => {
      if (cancelled || !remote || typeof remote.xp !== "number") return;
      setTree((current) => ({ ...current, xp: Math.max(current.xp, remote.xp ?? 0), level: Math.max(current.level, remote.level ?? 0) }));
      setRemoteLoaded(true);
    }).catch(() => setRemoteLoaded(true));
    return () => { cancelled = true; };
  }, []);

  const calculated = useMemo(() => {
    if (!open) return tree;
    const nextDays = { ...tree.xpByDay };
    const cursor = new Date(`${tree.lastCalculated}T00:00:00`);
    const today = new Date(`${todayKey()}T00:00:00`);
    while (cursor <= today) { const key = dayKey(cursor); if (nextDays[key] == null) nextDays[key] = xpForDay(data, key); cursor.setDate(cursor.getDate() + 1); }
    const xp = Math.max(0, tree.xp + Object.entries(nextDays).filter(([key]) => dateValue(key) >= dateValue(tree.lastCalculated)).reduce((sum, [, value]) => sum + value, 0));
    return { level: levelForXp(xp), xp, lastCalculated: todayKey(), xpByDay: nextDays };
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
        {pendingGrowthMessage && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mx-5 mt-4 rounded-xl border border-lime-300 bg-lime-100 p-3 text-center text-sm font-bold text-green-950"><Sparkles className="mx-auto mb-1 h-5 w-5 text-lime-700" />¡Tu árbol ha crecido! Has desbloqueado la fase {calculated.level + 1}.</motion.div>}
        <div className="overflow-y-auto px-5 pb-8 pt-4">
          <div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-lime-400 px-3 py-1 text-xs font-black text-green-950">LVL {calculated.level + 1}</span><span className="flex items-center gap-1 text-sm font-semibold text-amber-700"><Sun className="h-4 w-4" /> {calculated.xp} XP</span></div>
          <TreeScene level={calculated.level} reduced={Boolean(reduced)} transitionKey={transitionKey} />
          <AnimatePresence mode="wait">{showUpgrade && <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="mt-3 rounded-xl bg-lime-400 p-3 text-center text-sm font-bold text-green-950"><Sparkles className="mx-auto mb-1 h-5 w-5" /> ¡Fase actualizada! Tu árbol ha crecido.</motion.div>}</AnimatePresence>
          <div className="mt-4 flex items-end justify-between"><div><p className="text-lg font-semibold">{current.emoji} {current.name}</p><p className="text-sm text-slate-600">{current.subtitle}</p></div><p className="text-xs text-slate-500">{next ? `${Math.max(0, next.required - calculated.xp)} XP para el siguiente nivel` : "Nivel máximo"}</p></div>
          <div className="mt-3 space-y-2"><div className="flex justify-between text-xs text-slate-500"><span>Progreso de fase</span><span>{Math.round(Math.max(0, calculated.xp - current.required))} / {next ? next.required - current.required : 1}</span></div><div className="h-2 overflow-hidden rounded-full bg-sky-200"><motion.div className="h-full rounded-full bg-emerald-500" animate={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} /></div></div>
          <p className="mt-5 rounded-xl bg-white/75 p-4 text-sm leading-relaxed text-slate-700 shadow-sm">{diagnosis}</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500"><Target className="h-4 w-4" /> +20 tareas · +25 pomodoros · +5 hábitos · -15 hábitos incumplidos</div>
          <SheetClose asChild><Button variant="outline" className="mt-5 w-full border-sky-300 bg-white/60 text-slate-700 hover:bg-white"><X className="h-4 w-4" /> Cerrar</Button></SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  </>;
}
