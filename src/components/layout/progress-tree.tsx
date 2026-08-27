"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Leaf, Sparkles, Target, X, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { todayKey } from "@/lib/format";
import { useData } from "@/components/providers/data-provider";

const STORAGE_KEY = "nucleo:progress-tree:v2";
const DAY = 86_400_000;
const DAILY_CAP = 70;

const LEVELS = [
  { name: "Brote", subtitle: "Primeros pasos", required: 0, emoji: "🌱" },
  { name: "Arbusto", subtitle: "Constancia inicial", required: 100, emoji: "🌿" },
  { name: "Joven Secuoya", subtitle: "Hábito consolidado", required: 300, emoji: "🌳" },
  { name: "Secuoya Milenaria", subtitle: "Dominio total", required: 700, emoji: "🌲" },
] as const;

type SavedTree = { level: number; xp: number; lastCalculated: string; xpByDay: Record<string, number> };

function emptyTree(): SavedTree {
  return { level: 0, xp: 0, lastCalculated: todayKey(), xpByDay: {} };
}

function readTree(): SavedTree {
  if (typeof window === "undefined") return emptyTree();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<SavedTree> | null;
    if (parsed && typeof parsed.xp === "number") return { ...emptyTree(), ...parsed, xpByDay: parsed.xpByDay ?? {} };
  } catch { /* Estado local inválido: se recupera con un árbol nuevo. */ }
  return emptyTree();
}

type Data = ReturnType<typeof useData>["data"];

function dayKey(date: Date) { return date.toISOString().slice(0, 10); }
function dateValue(value: string | null | undefined) { return value ? new Date(`${value.slice(0, 10)}T00:00:00`).getTime() : 0; }

function xpForDay(data: Data, key: string): number {
  const habits = data.habitCompletions.filter((item) => item.completed_on === key).length;
  const tasks = data.tasks.filter((item) => item.status === "done" && item.updated_at.slice(0, 10) === key).length;
  const pomodoros = data.tasks.filter((item) => item.type === "study_session" && item.status === "done" && item.updated_at.slice(0, 10) === key).length;
  const overdue = data.tasks.some((item) => item.due_date && item.due_date < key && item.status !== "done");
  // Un día con entregas vencidas no premia acciones aisladas: la penalización impide crecer gratis.
  if (overdue) return 0;
  const login = key === todayKey() ? 5 : 0;
  return Math.min(DAILY_CAP, login + Math.min(habits, 3) * 10 + tasks * 15 + Math.min(pomodoros, 2) * 10);
}

function TreeScene({ level, reduced }: { level: number; reduced: boolean }) {
  const colors = ["from-amber-100 via-orange-100 to-yellow-50", "from-lime-100 via-emerald-100 to-sky-100", "from-green-200 via-emerald-100 to-sky-100", "from-emerald-700 via-green-600 to-teal-700"];
  const treeScale = [0.55, 0.75, 1, 1.2][level];
  const background = colors[level];
  return (
    <div className={`relative isolate h-72 overflow-hidden rounded-2xl bg-gradient-to-b ${background}`}>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-amber-700/30 to-transparent" />
      {level >= 1 && <><div className="absolute bottom-12 left-10 h-12 w-7 rounded-t-full bg-green-700/50" /><div className="absolute bottom-10 right-12 h-16 w-9 rounded-t-full bg-green-800/50" /></>}
      {level >= 2 && <div className="absolute bottom-0 left-0 right-0 h-16 bg-green-700/30 [clip-path:polygon(0_60%,20%_20%,40%_65%,60%_15%,80%_55%,100%_10%,100%_100%,0_100%)]" />}
      {level === 0 && <div className="absolute bottom-16 left-0 right-0 h-14 bg-amber-300/35 [clip-path:polygon(0_70%,25%_25%,50%_65%,75%_20%,100%_60%,100%_100%,0_100%)]" />}
      {level === 3 && <><div className="absolute inset-0 bg-emerald-950/15" /><div className="absolute bottom-0 left-1/4 h-28 w-2 rotate-12 bg-green-950/30" /><div className="absolute bottom-0 right-1/4 h-32 w-3 -rotate-12 bg-green-950/30" /></>}
      <motion.div className="absolute bottom-9 left-1/2 origin-bottom -translate-x-1/2" style={{ scale: treeScale }} animate={reduced ? undefined : { rotate: [-1, 1, -1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
        <svg width="170" height="210" viewBox="0 0 170 210" role="img" aria-label={`Ilustración de ${LEVELS[level].name}`}>
          <path d="M83 205 C80 165 81 125 85 85" stroke="#713f12" strokeWidth="14" strokeLinecap="round" fill="none" />
          <path d="M84 125 C57 105 46 87 40 68 M84 112 C111 94 120 77 126 57" stroke="#713f12" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M84 82 C65 67 62 47 64 30 M85 79 C102 61 108 43 106 24" stroke="#713f12" strokeWidth="5" strokeLinecap="round" fill="none" />
          {level === 0 ? <path d="M84 72 C67 64 70 41 84 29 C98 41 101 64 84 72Z" fill="#65a30d" /> : <>
            <circle cx="42" cy="54" r={level === 3 ? 38 : 27} fill="#166534" /><circle cx="91" cy="35" r={level === 3 ? 48 : 31} fill="#15803d" /><circle cx="130" cy="60" r={level === 3 ? 38 : 26} fill="#166534" /><circle cx="84" cy="76" r={level === 3 ? 52 : 35} fill="#22c55e" />
            {level === 3 && <circle cx="38" cy="105" r="29" fill="#14532d" />}
          </>}
          <path d="M55 204 Q85 193 115 204" stroke="#92400e" strokeWidth="5" fill="none" strokeLinecap="round" />
        </svg>
      </motion.div>
      <div className="absolute left-4 top-4 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-green-950 backdrop-blur">ESCENA · {LEVELS[level].name}</div>
    </div>
  );
}

export function ProgressTree() {
  const { data } = useData();
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<SavedTree>(() => readTree());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const reduced = useReducedMotion();

  const calculated = useMemo(() => {
    if (!open) return tree;
    const nextDays = { ...tree.xpByDay };
    const cursor = new Date(`${tree.lastCalculated}T00:00:00`);
    const today = new Date(`${todayKey()}T00:00:00`);
    while (cursor <= today) { const key = dayKey(cursor); if (nextDays[key] == null) nextDays[key] = xpForDay(data, key); cursor.setDate(cursor.getDate() + 1); }
    const xp = Math.max(0, tree.xp + Object.entries(nextDays).filter(([key]) => dateValue(key) >= dateValue(tree.lastCalculated)).reduce((sum, [, value]) => sum + value, 0));
    const level = Math.max(tree.level, LEVELS.reduce((current, item, index) => xp >= item.required ? index : current, 0));
    return { level, xp, lastCalculated: todayKey(), xpByDay: nextDays };
  }, [data, open, tree]);

  useEffect(() => {
    if (!open) return;
    const upgraded = calculated.level > tree.level;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calculated));
    if (upgraded) setShowUpgrade(true);
    if (calculated.xp !== tree.xp || calculated.level !== tree.level) setTree(calculated);
  }, [calculated, open, tree.level, tree.xp]);

  const current = LEVELS[calculated.level];
  const next = LEVELS[calculated.level + 1];
  const percentage = next ? ((calculated.xp - current.required) / (next.required - current.required)) * 100 : 100;
  const weekXp = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - index); return calculated.xpByDay[dayKey(date)] ?? 0; }).reduce((sum, value) => sum + value, 0);
  const diagnosis = weekXp >= 100 ? "¡Muy bien! Esta semana has mantenido tus hábitos y avanzado en tus sesiones de estudio. Tu árbol está creciendo fuerte." : "Esta semana has fallado varios hábitos y no has trabajado diariamente en tus entregas. Tu árbol necesita más constancia.";

  return <>
    <Button variant="ghost" size="icon" className="h-9 w-9 text-emerald-600 dark:text-emerald-400" onClick={() => setOpen(true)} aria-label="Abrir árbol de progreso"><Leaf className="h-5 w-5" /></Button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="max-h-[94vh] rounded-t-3xl border-0 bg-slate-950 p-0 text-white">
        <SheetHeader className="border-b border-white/10 px-6 pb-3 pt-5"><SheetTitle className="flex items-center gap-2 text-white"><Leaf className="h-5 w-5 text-lime-400" /> Mi bosque de progreso</SheetTitle></SheetHeader>
        <div className="overflow-y-auto px-5 pb-8 pt-4">
          <div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-lime-400 px-3 py-1 text-xs font-black text-green-950">LVL {calculated.level + 1}</span><span className="flex items-center gap-1 text-sm text-amber-300"><Sun className="h-4 w-4" /> {calculated.xp} XP</span></div>
          <TreeScene level={calculated.level} reduced={Boolean(reduced)} />
          <AnimatePresence mode="wait">{showUpgrade && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-lime-400 p-3 text-center text-sm font-bold text-green-950"><Sparkles className="mx-auto mb-1 h-5 w-5" /> ¡Fase actualizada! Nuevas ramas han brotado.</motion.div>}</AnimatePresence>
          <div className="mt-4 flex items-end justify-between"><div><p className="text-lg font-semibold">{current.emoji} {current.name}</p><p className="text-sm text-slate-300">{current.subtitle}</p></div><p className="text-xs text-slate-400">{next ? `${Math.max(0, next.required - calculated.xp)} XP para el siguiente nivel` : "Nivel máximo"}</p></div>
          <div className="mt-3 space-y-2"><div className="flex justify-between text-xs text-slate-300"><span>Experiencia / luz solar</span><span>{Math.round(Math.max(0, calculated.xp - current.required))} / {next ? next.required - current.required : 1}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/15"><motion.div className="h-full rounded-full bg-lime-400" animate={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} /></div></div>
          <p className="mt-5 rounded-xl bg-white/10 p-4 text-sm leading-relaxed text-slate-200">{diagnosis}</p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400"><Target className="h-4 w-4" /> XP determinista · cap diario {DAILY_CAP} · hábitos · tareas · pomodoros</div>
          <SheetClose asChild><Button variant="outline" className="mt-5 w-full border-white/20 bg-transparent text-white hover:bg-white/10"><X className="h-4 w-4" /> Cerrar</Button></SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  </>;
}
