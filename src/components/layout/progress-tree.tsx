"use client";

import { useEffect, useMemo, useState } from "react";
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
import { useXpSystem, LEVELS, readSeenLevel, writeSeenLevel } from "@/lib/xp-system";
import { effectiveXpCap } from "@/lib/xp-cap";

const TREE_API = "/api/tree/progress";

type SceneTime = "day" | "night";

function getSceneTime(date = new Date()): SceneTime {
  const hour = date.getHours();
  return hour >= 21 || hour < 7 ? "night" : "day";
}

function sceneAsset(level: number, time: SceneTime): string {
  return time === "night"
    ? `/tree-assets/escena-nivel-${level}-noche.svg`
    : `/tree-assets/escena-nivel-${level}.svg`;
}

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

function WindStreaks({ reduced }: { reduced: boolean }) {
  const streaks = [
    { top: "16%", delay: 0,    dur: 5.2, o: 0.35, w: "26%", h: "2px" },
    { top: "30%", delay: 1.7,  dur: 6.4, o: 0.22, w: "42%", h: "1.5px" },
    { top: "11%", delay: 3.1,  dur: 4.9, o: 0.28, w: "20%", h: "2px" },
    { top: "24%", delay: 4.3,  dur: 5.8, o: 0.2,  w: "34%", h: "1.5px" },
    { top: "38%", delay: 2.4,  dur: 6.9, o: 0.16, w: "28%", h: "1px" },
  ];
  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      aria-hidden="true"
    >
      {streaks.map((s, index) => (
        <motion.span
          key={index}
          className="absolute left-[-35%] rounded-full bg-gradient-to-r from-transparent via-white to-transparent"
          style={{ top: s.top, height: s.h, width: s.w, opacity: s.o }}
          animate={
            reduced
              ? { opacity: s.o * 0.4, x: 0 }
              : { left: ["-35%", "110%"], opacity: [0, s.o, s.o, 0] }
          }
          transition={
            reduced
              ? undefined
              : { delay: s.delay, duration: s.dur, repeat: Infinity, ease: "easeInOut" }
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
  sceneTime,
}: {
  level: number;
  reduced: boolean;
  transitionKey: number;
  particles: Particle[];
  sceneTime: SceneTime;
}) {
  return (
    <div
      className={`relative isolate aspect-square w-full overflow-hidden rounded-2xl ${
        sceneTime === "night" ? "bg-slate-950" : "bg-[#d8f1e8]"
      }`}
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={`${level}-${transitionKey}`}
          src={sceneAsset(level, sceneTime)}
          alt={`Ilustración de ${LEVELS[level].name}`}
          className="absolute inset-0 z-0 block h-full w-full object-contain"
          style={{ objectPosition: "center" }}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={reduced ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [1.06, 1.02, 1] }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={
            reduced
              ? { opacity: { duration: 0.35 } }
              : { opacity: { duration: 0.35 }, scale: { type: "spring", stiffness: 260, damping: 20 } }
          }
          onError={(event) => {
            if (sceneTime === "night") {
              event.currentTarget.src = sceneAsset(level, "day");
            } else {
              event.currentTarget.style.display = "none";
            }
          }}
        />
      </AnimatePresence>
      <WindStreaks reduced={reduced} />
      {sceneTime === "day" && <FallingLeaves reduced={reduced} />}
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
  const [transitionKey, setTransitionKey] = useState(0);
  const [pendingGrowthMessage, setPendingGrowthMessage] = useState(false);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => new Date());
  const sceneTime = useMemo(() => getSceneTime(now), [now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Posición visual de la barra la última vez que se abrió el panel: al volver
  // a abrirlo, la barra se desplaza desde ese punto hasta el actual (1.6s).
  // Se actualiza al cerrar (event handler), no durante el render.
  const [lastSeenPct, setLastSeenPct] = useState(0);

  const current = LEVELS[tree.level];
  const next = LEVELS[tree.level + 1];
  const percentage = next
    ? ((tree.xp - current.required) / (next.required - current.required)) * 100
    : 100;

  // El aviso de crecimiento sale solo la primera vez que se abre el panel en
  // una fase nueva: el nivel visto se guarda en localStorage, así que la
  // subida se recuerda aunque la app se haya recargado.
  const maybeShowGrowthMessage = () => {
    const seen = readSeenLevel();
    if (tree.level > seen) {
      setPendingGrowthMessage(true);
      setTransitionKey((key) => key + 1);
      writeSeenLevel(tree.level);
    }
  };

  // Abrir/cerrar el panel. El botón de la hoja abre con setOpen(true) y Radix
  // no emite onOpenChange para cambios controlados programáticos, así que la
  // detección de subida de fase va en el onClick (openTree) y aquí solo se
  // cierra: guarda la posición de la barra para animar desde ahí en la próxima
  // apertura.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setLastSeenPct(percentage);
      setPendingGrowthMessage(false);
    }
  };

  const openTree = () => {
    maybeShowGrowthMessage();
    setOpen(true);
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
      ? "Empieza completando una tarea o un hábito para conseguir XP."
      : next
        ? `${tree.xp} XP acumulados. Te faltan ${Math.max(0, next.required - tree.xp)} XP para la siguiente fase.`
        : "¡Has alcanzado la Secuoya final! Sigue cuidando tu constancia.";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-emerald-600 dark:text-emerald-400"
        onClick={openTree}
        aria-label="Abrir árbol de progreso"
      >
        <Leaf className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[94vh] rounded-t-3xl border-0 bg-[#eef3e8] p-0 text-foreground dark:bg-[#222a23]"
        >
          <SheetHeader className="border-b border-[#dce7d5] px-6 pb-3 pt-5 dark:border-white/10">
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <Leaf className="h-5 w-5 text-emerald-600" /> Mi árbol de progreso
            </SheetTitle>
          </SheetHeader>
          {pendingGrowthMessage && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative mx-4 mt-4 flex min-h-[56vh] flex-col items-center justify-center gap-2.5 overflow-hidden rounded-3xl border border-lime-300 bg-gradient-to-b from-lime-100 to-emerald-50 px-6 py-6 text-center"
            >
              <button
                type="button"
                onClick={() => setPendingGrowthMessage(false)}
                aria-label="Cerrar aviso de crecimiento"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/70 text-green-900 transition-colors hover:bg-white"
              >
                <X className="h-4 w-4" />
              </button>
              <Sparkles className="h-8 w-8 text-lime-600" />
              <p className="text-2xl font-black text-green-950">
                ¡Tu árbol ha crecido! 🎉
              </p>
              <img
                src={sceneAsset(tree.level, sceneTime)}
                alt={`Fase ${LEVELS[tree.level].name}`}
                className="h-20 w-36 rounded-xl object-cover object-bottom shadow-md sm:h-28 sm:w-52"
              />
              <p className="text-lg font-bold text-green-900">
                Ahora es {LEVELS[tree.level].article} {LEVELS[tree.level].emoji}{" "}
                {LEVELS[tree.level].name}
              </p>
              <p className="text-xs font-medium text-green-700">
                Sigue cuidándolo para que siga creciendo.
              </p>
              <Button
                onClick={() => setPendingGrowthMessage(false)}
                className="mt-1 bg-lime-500 text-green-950 hover:bg-lime-400"
              >
                ¡Genial!
              </Button>
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
              sceneTime={sceneTime}
            />
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-lg font-semibold">
                  {current.emoji} {current.name}
                </p>
                <p className="text-sm text-muted-foreground">{current.subtitle}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {next
                  ? `${Math.max(0, next.required - tree.xp)} XP para el siguiente nivel`
                  : "Nivel máximo"}
              </p>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progreso de fase</span>
                <span>
                  {Math.round(Math.max(0, tree.xp - current.required))} /{" "}
                  {next ? next.required - current.required : 1}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-emerald-200/70">
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
            <p className="mt-5 rounded-xl bg-white/75 p-4 text-sm leading-relaxed text-muted-foreground shadow-sm dark:bg-white/10">
              {diagnosis}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-center text-xs text-muted-foreground">
              <Target className="h-4 w-4" /> +20 tareas · +5 hábitos ·
              -15 hábitos incumplidos · -10 día sin entrenar · tope {effectiveXpCap()}
              /día
            </div>
            <SheetClose asChild>
              <Button
                variant="outline"
                className="mt-5 w-full border-[#cfe0c9] bg-white/60 text-muted-foreground hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-foreground dark:hover:bg-white/15"
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
