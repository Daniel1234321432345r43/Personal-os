"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Leaf, Sparkles, Target, X, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useXpSystem, LEVELS } from "@/lib/xp-system";
import { effectiveXpCap } from "@/lib/xp-cap";

const TREE_API = "/api/tree/progress";

type Particle = {
  id: string;
  value: number;
  color: string;
  limit: boolean;
  x: number;
  delay: number;
};

function FallingLeaves({ reduced }: { reduced: boolean }) {
  const leaves = [
    "#65a30d", "#84cc16", "#a3e635", "#4d7c0f",
    "#bef264", "#65a30d", "#84cc16", "#a3e635",
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-hidden="true">
      {leaves.map((color, index) => (
        <motion.span
          key={index}
          className="absolute top-[-4%] h-1.5 w-2 rounded-full"
          style={{ left: `${index * 13 + 3}%`, backgroundColor: color }}
          animate={
            reduced
              ? { opacity: 0.6 }
              : {
                  opacity: [0, 1, 1, 0],
                  y: [0, 120, 240, 340],
                  x: [0, 20 + index * 4, 40 + index * 5, 55 + index * 6],
                  rotate: [0, 180, 360, 540],
                }
          }
          transition={
            reduced
              ? undefined
              : { delay: index * 0.7, duration: 6.5 + index * 0.2, repeat: Infinity, ease: "easeInOut" }
          }
        />
      ))}
    </div>
  );
}

function TreeScene({
  level,
  reduced,
  transitionKey,
  particles,
}: {
  level: number;
  reduced: boolean;
  transitionKey: number;
  particles: Particle[];
}) {
  return (
    <div className="relative isolate h-72 overflow-hidden rounded-2xl bg-[#d8f1e8]">
      <AnimatePresence mode="wait">
        <motion.img
          key={`${level}-${transitionKey}`}
          src={`/tree-assets/escena-nivel-${level}.svg`}
          alt={`Ilustración de ${LEVELS[level].name}`}
          className="absolute inset-0 z-0 block h-full w-full object-contain"
          initial={{ opacity: 0, scale: 1.06 }}
          animate={reduced ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [1.06, 1.02, 1] }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={
            reduced
              ? { opacity: { duration: 0.35 } }
              : { opacity: { duration: 0.35 }, scale: { type: "spring", stiffness: 260, damping: 20 } }
          }
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      </AnimatePresence>
      <FallingLeaves reduced={reduced} />
      <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden="true">
        {particles.map((particle) => (
          <motion.span
            key={particle.id}
            className="absolute"
            style={{ left: "50%", top: "38%" }}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={
              reduced
                ? { opacity: [0, 1, 0], y: -60 }
                : {
                    opacity: [0, 1, 1, 0],
                    y: [0, -60, -130, -200],
                    x: [0, particle.x * 0.35, particle.x * 0.7, particle.x],
                    scale: [0.5, 1.15, 1.05, 0.9],
                  }
            }
            transition={{ duration: 2.6, ease: "easeOut", delay: particle.delay }}
          >
            <span
              className="block -translate-x-1/2 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 text-xs font-black shadow-md"
              style={{ color: particle.color }}
            >
              {particle.limit
                ? "Límite diario alcanzado · vuelve mañana"
                : `+${particle.value} XP`}
            </span>
          </motion.span>
        ))}
      </div>
    </div>
  );
}

export function ProgressTree() {
  const { tree, notifications } = useXpSystem();
  const [open, setOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [transitionKey, setTransitionKey] = useState(0);
  const [pendingGrowthMessage, setPendingGrowthMessage] = useState(false);
  const [seenLevel, setSeenLevel] = useState(() => tree.level);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const reduced = useReducedMotion();

  // Posición visual de la barra la última vez que se abrió el panel: al volver
  // a abrirlo, la barra se desplaza desde ese punto hasta el actual (1.6s).
  // Se actualiza al cerrar (event handler), no durante el render.
  const [lastSeenPct, setLastSeenPct] = useState(0);

  const current = LEVELS[tree.level];
  const next = LEVELS[tree.level + 1];
  const percentage = next
    ? ((tree.xp - current.required) / (next.required - current.required)) * 100
    : 100;

  // Abrir/cerrar el panel. Al abrir detecta si hubo subida de nivel desde la
  // última visita (muestra la felicitación); al cerrar guarda la posición de la
  // barra para animar desde ahí en la próxima apertura.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setLastSeenPct(percentage);
      setPendingGrowthMessage(false);
      setShowUpgrade(false);
      return;
    }
    if (tree.level > seenLevel) {
      setShowUpgrade(true);
      setPendingGrowthMessage(true);
      setTransitionKey((key) => key + 1);
      setSeenLevel(tree.level);
    }
  };

  // Posición horizontal estable por partícula (derivada de su id).
  const particleX = (id: string): number => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    return (h % 141) - 70;
  };

  // Cargar el XP remoto de Supabase una sola vez al montar.
  useEffect(() => {
    let cancelled = false;
    fetch(TREE_API)
      .then((response) => (response.ok ? response.json() : null))
      .then(() => {
        if (!cancelled) setRemoteLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setRemoteLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sincronizar el resumen local a Supabase cuando cambia el XP.
  useEffect(() => {
    if (!remoteLoaded) return;
    const timer = window.setTimeout(() => {
      void fetch(TREE_API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xp: tree.xp, level: tree.level }),
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [tree.xp, tree.level, remoteLoaded]);

  // Partículas visuales del árbol: se derivan directamente de las
  // notificaciones activas. Como los toasts se autodescartan (dismiss), las
  // partículas desaparecen con ellos. Sin estado acumulado ni effects.
  const particles: Particle[] = open
    ? notifications.slice(0, 8).map((item, index) => ({
        id: item.id,
        value: item.value,
        color: item.color,
        limit: item.limit,
        x: particleX(item.id),
        delay: index * 0.18,
      }))
    : [];

  const diagnosis =
    tree.xp === 0
      ? "Empieza completando una tarea, un hábito o un Pomodoro para conseguir XP."
      : next
        ? `${tree.xp} XP acumulados. Te faltan ${Math.max(0, next.required - tree.xp)} XP para la siguiente fase.`
        : "¡Has alcanzado la Secuoya final! Sigue cuidando tu constancia.";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-emerald-600 dark:text-emerald-400"
        onClick={() => setOpen(true)}
        aria-label="Abrir árbol de progreso"
      >
        <Leaf className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[94vh] rounded-t-3xl border-0 bg-sky-50 p-0 text-slate-900"
        >
          <SheetHeader className="border-b border-sky-200 px-6 pb-3 pt-5">
            <SheetTitle className="flex items-center gap-2 text-slate-900">
              <Leaf className="h-5 w-5 text-emerald-600" /> Mi árbol de progreso
            </SheetTitle>
          </SheetHeader>
          {pendingGrowthMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="mx-5 mt-4 flex flex-col items-center gap-1.5 rounded-2xl border border-lime-300 bg-gradient-to-b from-lime-100 to-emerald-50 p-4 text-center"
            >
              <Sparkles className="h-6 w-6 text-lime-600" />
              <p className="text-lg font-black text-green-950">
                ¡Tu árbol ha crecido! 🎉
              </p>
              <img
                src={`/tree-assets/escena-nivel-${tree.level}.svg`}
                alt={`Fase ${LEVELS[tree.level].name}`}
                className="h-24 w-40 rounded-lg object-cover object-bottom"
              />
              <p className="text-base font-bold text-green-900">
                Has desbloqueado la fase {LEVELS[tree.level].emoji}{" "}
                {LEVELS[tree.level].name}
              </p>
              <p className="text-xs font-medium text-green-700">
                Sigue cuidándolo para que siga creciendo.
              </p>
            </motion.div>
          )}
          <div className="overflow-y-auto px-5 pb-8 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-lime-400 px-3 py-1 text-xs font-black text-green-950">
                LVL {tree.level + 1}
              </span>
              <span className="flex items-center gap-1 text-sm font-semibold text-amber-700">
                <Sun className="h-4 w-4" /> {tree.xp} XP
              </span>
            </div>
            <TreeScene
              level={tree.level}
              reduced={Boolean(reduced)}
              transitionKey={transitionKey}
              particles={particles}
            />
            <AnimatePresence mode="wait">
              {showUpgrade && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 rounded-xl bg-lime-400 p-3 text-center text-sm font-bold text-green-950"
                >
                  <Sparkles className="mx-auto mb-1 h-5 w-5" /> ¡Fase actualizada! Tu
                  árbol ha crecido.
                </motion.div>
              )}
            </AnimatePresence>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-lg font-semibold">
                  {current.emoji} {current.name}
                </p>
                <p className="text-sm text-slate-600">{current.subtitle}</p>
              </div>
              <p className="text-xs text-slate-500">
                {next
                  ? `${Math.max(0, next.required - tree.xp)} XP para el siguiente nivel`
                  : "Nivel máximo"}
              </p>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Progreso de fase</span>
                <span>
                  {Math.round(Math.max(0, tree.xp - current.required))} /{" "}
                  {next ? next.required - current.required : 1}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-sky-200">
                <motion.div
                  className="h-full rounded-full bg-emerald-500"
                  initial={{ width: `${Math.max(0, Math.min(100, lastSeenPct))}%` }}
                  animate={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 1.6, ease: [0.25, 0.1, 0.25, 1] }
                  }
                />
              </div>
            </div>
            <p className="mt-5 rounded-xl bg-white/75 p-4 text-sm leading-relaxed text-slate-700 shadow-sm">
              {diagnosis}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-center text-xs text-slate-500">
              <Target className="h-4 w-4" /> +20 tareas · +25 pomodoros · +5 hábitos ·
              -15 hábitos incumplidos · -10 día sin entrenar · tope {effectiveXpCap()}
              /día
            </div>
            <SheetClose asChild>
              <Button
                variant="outline"
                className="mt-5 w-full border-sky-300 bg-white/60 text-slate-700 hover:bg-white"
              >
                <X className="h-4 w-4" /> Cerrar
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
