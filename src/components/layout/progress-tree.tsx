"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Leaf, Sparkles, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { todayKey } from "@/lib/format";
import { useData } from "@/components/providers/data-provider";

const STORAGE_KEY = "nucleo:progress-tree:v1";
const DAY = 86_400_000;

const PHASES = [
  { name: "Brote", subtitle: "Primeros pasos", threshold: 0, emoji: "🌱" },
  { name: "Arbusto", subtitle: "Constancia inicial", threshold: 100, emoji: "🌿" },
  { name: "Joven Secuoya", subtitle: "Hábito consolidado", threshold: 250, emoji: "🌳" },
  { name: "Secuoya Milenaria", subtitle: "Dominio total", threshold: 500, emoji: "🌲" },
] as const;

type SavedTree = { phase: number; growth: number; lastCalculated: string };

function readTree(): SavedTree {
  if (typeof window === "undefined") return { phase: 0, growth: 0, lastCalculated: todayKey() };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved.growth === "number") return saved;
  } catch { /* Datos locales corruptos: empezar de forma segura. */ }
  return { phase: 0, growth: 0, lastCalculated: todayKey() };
}

function calculateGrowth(data: ReturnType<typeof useData>["data"], from: string): number {
  const start = new Date(`${from}T00:00:00`).getTime();
  const now = Date.now();
  const days = Math.max(1, Math.min(14, Math.ceil((now - start) / DAY)));
  const recent = (date: string | null | undefined) => date ? new Date(`${date.slice(0, 10)}T00:00:00`).getTime() >= start : false;
  const habitsDone = data.habitCompletions.filter((item) => recent(item.completed_on)).length;
  const habitsExpected = Math.max(1, data.habits.length * days);
  const tasksDone = data.tasks.filter((item) => item.status === "done" && recent(item.updated_at)).length;
  const dueTasks = data.tasks.filter((item) => recent(item.due_date));
  const onTime = dueTasks.filter((item) => item.status === "done").length;
  const lateOrPending = dueTasks.filter((item) => item.status !== "done").length;
  const grades = data.grades.filter((item) => recent(item.date));
  const gradeScore = grades.length ? grades.reduce((sum, item) => sum + item.score / Math.max(1, item.max_score), 0) / grades.length : 0.5;
  const pomodoros = data.tasks.filter((item) => item.type === "study_session" && item.status === "done" && recent(item.updated_at)).length;
  const positive = habitsDone / habitsExpected * 45 + tasksDone * 8 + onTime * 8 + gradeScore * 15 + pomodoros * 5;
  const negative = lateOrPending * 7 + Math.max(0, days - habitsDone / Math.max(1, data.habits.length)) * 2;
  return Math.round(positive - negative);
}

function TreeArt({ phase, reduced }: { phase: number; reduced: boolean }) {
  const size = [70, 110, 150, 190][phase];
  return (
    <motion.div
      className="relative flex h-56 items-end justify-center"
      animate={reduced ? undefined : { rotate: [-1, 1, -1] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      aria-label={`Árbol en fase ${PHASES[phase].name}`}
    >
      <div className="absolute bottom-0 h-20 w-7 rounded-full bg-amber-800/80" style={{ width: Math.max(10, size / 7) }} />
      <motion.div
        className="absolute bottom-12 rounded-[48%] bg-emerald-600 shadow-[0_10px_0_rgba(5,100,65,0.15)] dark:bg-emerald-500"
        style={{ width: size, height: size * 0.85 }}
        animate={reduced ? undefined : { scale: [1, 1.025, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="absolute left-1/4 top-1/4 h-3 w-3 rounded-full bg-emerald-300/70" />
        <span className="absolute right-1/4 top-1/3 h-2 w-2 rounded-full bg-lime-200/70" />
      </motion.div>
    </motion.div>
  );
}

export function ProgressTree() {
  const { data } = useData();
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<SavedTree>(() => readTree());
  const [showUpgrade, setShowUpgrade] = useState(false);
  const reduced = useReducedMotion();

  const snapshot = useMemo(() => {
    if (!open) return tree;
    const delta = calculateGrowth(data, tree.lastCalculated);
    const growth = Math.max(0, Math.min(500, tree.growth + delta));
    const phase = Math.max(tree.phase, PHASES.reduce((current, item, index) => growth >= item.threshold ? index : current, 0));
    return { phase, growth, lastCalculated: todayKey() };
  }, [data, open, tree]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const next = { ...snapshot };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (snapshot.phase > tree.phase) setShowUpgrade(true);
    if (snapshot.phase !== tree.phase || snapshot.growth !== tree.growth) setTree(next);
  }, [open, snapshot, tree.phase, tree.growth]);

  const current = PHASES[snapshot.phase];
  const next = PHASES[snapshot.phase + 1];
  const progress = next ? ((snapshot.growth - current.threshold) / (next.threshold - current.threshold)) * 100 : 100;
  const positive = calculateGrowth(data, snapshot.lastCalculated) > 0;

  return (
    <>
      <Button variant="ghost" size="icon" className="h-9 w-9 text-emerald-600 dark:text-emerald-400" onClick={() => setOpen(true)} aria-label="Abrir árbol de progreso">
        <Leaf className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] rounded-t-3xl p-0">
          <SheetHeader className="border-b px-6 pb-3 pt-5">
            <SheetTitle className="flex items-center gap-2"><Leaf className="h-5 w-5 text-emerald-600" /> Mi árbol de progreso</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-6 pb-8 pt-4">
            <AnimatePresence mode="wait">
              {showUpgrade && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="mb-3 rounded-xl bg-emerald-600 p-3 text-center text-sm font-semibold text-white">
                  <Sparkles className="mx-auto mb-1 h-5 w-5" /> ¡Fase actualizada! Tu árbol ha crecido.
                </motion.div>
              )}
            </AnimatePresence>
            <TreeArt phase={snapshot.phase} reduced={Boolean(reduced)} />
            <div className="text-center">
              <p className="text-lg font-semibold">{current.emoji} {current.name}</p>
              <p className="text-sm text-muted-foreground">{current.subtitle}</p>
            </div>
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground"><span>Crecimiento acumulado</span><span>{Math.round(snapshot.growth)} / {next?.threshold ?? 500}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><motion.div className="h-full rounded-full bg-emerald-600" animate={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>
            </div>
            <p className="mt-5 rounded-xl bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
              {positive ? "¡Muy bien! Esta semana has mantenido tus hábitos y avanzado en tus sesiones de estudio. Tu árbol está creciendo fuerte." : "Esta semana has fallado varios hábitos y no has trabajado diariamente en tus entregas. Tu árbol necesita más constancia."}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Target className="h-4 w-4" /> Hábitos · entregas · notas · sesiones de estudio</div>
            <SheetClose asChild><Button variant="outline" className="mt-5 w-full"><X className="h-4 w-4" /> Cerrar</Button></SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
