"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useData } from "@/components/providers/data-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { registerServiceWorker } from "@/lib/push";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fieldClass, labelClass, selectClass } from "@/components/forms/ui";
import { cn } from "@/lib/utils";
import {
  BellRing,
  Coffee,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer as TimerIcon,
  Workflow,
} from "lucide-react";

type Mode = "work" | "break";

/**
 * Notificación persistente al terminar cada sesión (timbre).
 * Se cierra sola o al pulsar sobre ella.
 */
async function showCompletionNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const options: NotificationOptions = {
    body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: `pomodoro-done-${Date.now()}`,
    requireInteraction: true,
    data: { url: "/pomodoro" },
  };

  try {
    const reg = await registerServiceWorker();
    if (reg) {
      await reg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  } catch (err) {
    console.error("[pomodoro] no se pudo mostrar la notificación:", err);
  }
}



/** Timbre corto con Web Audio API (sin archivos de audio). */
function playChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const notes = [880, 1174.66]; // La5 → Re6
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 2000);
  } catch {
    // Sin soporte de audio: la notificación y el cambio visual bastan.
  }
}

/** Formatear segundos como "MM:SS". */
function fmt(secs: number) {
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

/**
 * Anillo de progreso + tiempo restante. Se usa tanto en la tarjeta normal como
 * en el modo ampliado, para que el temporizador tenga una única fuente de verdad.
 */
function TimerRing({
  secondsLeft,
  durationSeconds,
  mode,
  running,
  completedFlash,
  reduceMotion,
  size = "md",
}: {
  secondsLeft: number;
  durationSeconds: number;
  mode: Mode;
  running: boolean;
  completedFlash: boolean;
  reduceMotion: boolean | null;
  size?: "md" | "xl";
}) {
  const progress = durationSeconds > 0 ? secondsLeft / durationSeconds : 0;
  const circumference = 2 * Math.PI * 90;
  const dashOffset = circumference * (1 - progress);
  const large = size === "xl";

  return (
    <div
      className={cn(
        "relative",
        large
          ? "h-[clamp(16rem,58vh,32rem)] w-[clamp(16rem,58vh,32rem)]"
          : "h-56 w-56",
      )}
    >
      {/* Halo que respira mientras corre */}
      <motion.div
        aria-hidden
        className={cn("pointer-events-none absolute rounded-full", large ? "-inset-8" : "-inset-5")}
        style={{
          background:
            mode === "work"
              ? "radial-gradient(circle, color-mix(in oklch, var(--primary) 16%, transparent), transparent 70%)"
              : "radial-gradient(circle, rgba(16, 185, 129, 0.16), transparent 70%)",
        }}
        initial={{ opacity: 0.35, scale: 1 }}
        animate={
          running && !reduceMotion
            ? { opacity: [0.45, 1, 0.45], scale: [1, 1.035, 1] }
            : { opacity: 0.35, scale: 1 }
        }
        transition={
          running && !reduceMotion
            ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.4 }
        }
      />

      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        {/* Aro interior decorativo, solo en el modo ampliado */}
        {large && (
          <circle
            cx="100"
            cy="100"
            r="78"
            fill="none"
            strokeWidth="1"
            strokeDasharray="1 6"
            strokeLinecap="round"
            className="stroke-muted-foreground/30"
          />
        )}
        <circle cx="100" cy="100" r="90" fill="none" strokeWidth="10" className="stroke-muted" />
        <motion.circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1, ease: "linear" }}
          className={cn(
            "transition-colors",
            mode === "work" ? "stroke-primary" : "stroke-emerald-500",
          )}
        />
      </svg>

      <motion.div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center",
          large ? "gap-2" : "gap-1",
        )}
        animate={completedFlash ? { scale: [1, 1.07, 1] } : { scale: 1 }}
        transition={completedFlash ? { duration: 0.6, ease: "easeOut" } : { duration: 0.3 }}
      >
        <span
          className={cn(
            "font-bold tabular-nums tracking-tight",
            large ? "text-[clamp(3.25rem,13vh,8rem)]" : "text-5xl",
            mode === "work" ? "text-foreground" : "text-emerald-600 dark:text-emerald-400",
          )}
        >
          {fmt(secondsLeft)}
        </span>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className={cn(
              "flex items-center gap-1.5 font-medium text-muted-foreground",
              large ? "text-lg tracking-wide" : "text-sm",
            )}
          >
            {mode === "work" ? (
              <>
                <TimerIcon className={cn(large ? "h-5 w-5" : "h-4 w-4", "text-primary")} />
                Trabajo
              </>
            ) : (
              <>
                <Coffee
                  className={cn(large ? "h-5 w-5" : "h-4 w-4", "text-emerald-500")}
                />
                Descanso
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export function PomodoroClient() {
  const { data } = useData();
  const { settings } = useSettings();

  const workMinutes = settings.pomodoroWorkMinutes ?? 25;
  const breakMinutes = settings.pomodoroBreakMinutes ?? 5;

  const [mode, setMode] = useState<Mode>("work");
  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [completedSessions, setCompletedSessions] = useState(0);
  const [completedFlash, setCompletedFlash] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  const completedRef = useRef(false);
  const originalTitleRef = useRef<string | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    runningRef.current = running;
  });

  const durationSeconds = (mode === "work" ? workMinutes : breakMinutes) * 60;

  // Si los tiempos cambian en Ajustes y el temporizador está parado, aplicar el
  // nuevo valor (patrón recomendado de React: ajustar estado durante el render).
  const [prevDurationSeconds, setPrevDurationSeconds] = useState(durationSeconds);
  if (!running && prevDurationSeconds !== durationSeconds) {
    setPrevDurationSeconds(durationSeconds);
    setSecondsLeft(durationSeconds);
  }



  // Cuenta atrás cada segundo mientras corre.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);



  // Al llegar a 0: timbre + notificación de fin de sesión + cambio de modo.
  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    if (completedRef.current) return;
    completedRef.current = true;

    setCompletedFlash(true);
    window.setTimeout(() => setCompletedFlash(false), 900);


    const wasWork = mode === "work";
    const task = taskId ? data.tasks.find((t) => t.id === taskId) : undefined;
    const taskLabel = task?.title ? ` Estabas con: ${task.title}.` : "";

    playChime();
    if (wasWork) {
      void showCompletionNotification(
        "Pomodoro completado 🍅",
        `¡Buen trabajo! Descansa ${breakMinutes} min.${taskLabel}`,
      );
      window.setTimeout(() => {
        setRunning(false);
        setCompletedSessions((n) => n + 1);
        setMode("break");
        setSecondsLeft(breakMinutes * 60);
      }, 0);
    } else {
      void showCompletionNotification(
        "Descanso terminado ⏰",
        `¡A por el siguiente pomodoro!${taskLabel}`,
      );
      window.setTimeout(() => {
        setRunning(false);
        setMode("work");
        setSecondsLeft(workMinutes * 60);
      }, 0);
    }
  }, [running, secondsLeft, mode, taskId, breakMinutes, workMinutes, data.tasks]);

  // ── Media Session: pantalla de bloqueo ─────────────────────────────────
  // Action handlers una sola vez (usan refs para evitar stale closures).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;

    ms.setActionHandler("play", () => {
      completedRef.current = false;
      setRunning(true);
    });
    ms.setActionHandler("pause", () => {
      setRunning(false);
    });
    ms.setActionHandler("seekbackward", () => {
      setSecondsLeft((s) => Math.min(durationSeconds, s + 30));
    });
    ms.setActionHandler("seekforward", () => {
      setSecondsLeft((s) => Math.max(0, s - 30));
    });
    ms.setActionHandler("stop", () => {
      setRunning(false);
      setSecondsLeft(durationSeconds);
    });

    return () => {
      for (const a of ["play", "pause", "seekbackward", "seekforward", "stop"] as const) {
        ms.setActionHandler(a, null);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Actualizar metadata de Media Session cada segundo.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;

    if (!running && secondsLeft >= durationSeconds) {
      ms.playbackState = "none";
      ms.metadata = null;
      return;
    }

    ms.playbackState = running ? "playing" : "paused";

    const label = mode === "work" ? "Trabajo" : "Descanso";
    const icon = mode === "work" ? "🍅" : "☕";
    const task = taskId ? data.tasks.find((t) => t.id === taskId) : undefined;

    ms.metadata = new MediaMetadata({
      title: `${icon} ${label}: ${fmt(secondsLeft)}${task ? ` · ${task.title}` : ""}`,
      artist: "Núcleo",
      artwork: [{ src: "/icon.svg", sizes: "512x512", type: "image/svg+xml" }],
    });
    ms.setPositionState({
      duration: durationSeconds,
      playbackRate: 1,
      position: durationSeconds - secondsLeft,
    });
  }, [running, secondsLeft, mode, durationSeconds, taskId, data.tasks]);

  // Reflejar el tiempo restante en el título de la pestaña.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (originalTitleRef.current === null) originalTitleRef.current = document.title;
    if (running) {
      document.title = `${fmt(secondsLeft)} · ${mode === "work" ? "Trabajo" : "Descanso"} · Núcleo`;
    } else if (originalTitleRef.current !== null) {
      document.title = originalTitleRef.current;
    }
    return () => {
      if (originalTitleRef.current !== null) document.title = originalTitleRef.current;
    };
  }, [running, secondsLeft, mode]);

  const pendingTasks = useMemo(
    () =>
      [...data.tasks]
        .filter((t) => t.status !== "done")
        .sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99")),
    [data.tasks],
  );

  // Cerrar el modo ampliado con Escape y bloquear el scroll de fondo.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const selectedTask = taskId ? data.tasks.find((t) => t.id === taskId) : undefined;

  const notifGranted =
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
  const notifDenied =
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied";

  async function requestPermissionIfNeeded() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // Si el usuario deniega, el temporizador sigue funcionando igual.
      }
    }
  }

  function toggleRunning() {
    if (running) {
      setRunning(false);
      return;
    }
    void requestPermissionIfNeeded();
    completedRef.current = false;
    setRunning(true);
  }

  function handleReset() {
    setRunning(false);
    setSecondsLeft(durationSeconds);
  }

  function handleSkip() {
    setRunning(false);
    if (mode === "work") {
      setMode("break");
      setSecondsLeft(breakMinutes * 60);
    } else {
      setMode("work");
      setSecondsLeft(workMinutes * 60);
    }
  }

  function handleTestNotification() {
    void showCompletionNotification(
      "Núcleo · Pomodoro",
      "🔔 Esta notificación no desaparece sola: ciérrala cuando quieras.",
    );
  }

  /** Selector de tarea: se reutiliza en la tarjeta y en el modo ampliado. */
  function renderTaskPicker(id: string, maxWidth: string) {
    return (
      <div className={cn(fieldClass, "w-full", maxWidth)}>
        <label className={labelClass} htmlFor={id}>
          ¿En qué estás trabajando?
        </label>
        <select
          id={id}
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className={selectClass}
        >
          <option value="">Sin tarea específica</option>
          {pendingTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
              {t.due_date ? ` · ${t.due_date}` : ""}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pomodoro</h1>
          <p className="text-sm text-muted-foreground">
            Concéntrate en una tarea y descansa: la técnica Pomodoro.
          </p>
        </div>
        {/* Ampliar: solo en pantallas de escritorio. */}
        <Button
          variant="outline"
          className="hidden lg:inline-flex"
          onClick={() => setExpanded(true)}
        >
          <Maximize2 className="h-4 w-4" />
          Ampliar
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col items-center gap-6 py-8">
            <TimerRing
              secondsLeft={secondsLeft}
              durationSeconds={durationSeconds}
              mode={mode}
              running={running}
              completedFlash={completedFlash}
              reduceMotion={reduceMotion}
            />

            <AnimatePresence initial={false}>
              {selectedTask && (
                <motion.span
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  Trabajando en: {selectedTask.title}
                </motion.span>
              )}
            </AnimatePresence>

            {/* Selector de tarea */}
            {renderTaskPicker("pomodoro-task", "max-w-md")}

            {/* Controles */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={toggleRunning}>
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {running ? "Pausar" : "Iniciar"}
              </Button>
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4" />
                Reiniciar
              </Button>
              <Button variant="ghost" onClick={handleSkip}>
                <SkipForward className="h-4 w-4" />
                Saltar
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              🍅 Pomodoros completados en esta sesión:{" "}
              <motion.span
                key={completedSessions}
                initial={{ scale: 1.35 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 20 }}
                className="inline-block font-semibold text-foreground"
              >
                {completedSessions}
              </motion.span>
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <BellRing className="h-4 w-4 text-primary" />
                Notificaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {notifGranted ? (
                <p className="font-medium text-emerald-600 dark:text-emerald-400">
                  Permiso concedido: al terminar cada sesión recibirás una notificación
                  y un aviso sonoro.
                </p>
              ) : notifDenied ? (
                <p className="text-destructive">
                  Permiso denegado. Actívalo en los ajustes del navegador para que el
                  aviso no se pierda.
                </p>
              ) : (
                <p>
                  Al pulsar &quot;Iniciar&quot; te pediremos permiso. Al terminar cada sesión
                  recibirás una notificación.
                </p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={handleTestNotification}>
                Probar notificación
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Workflow className="h-4 w-4 text-primary" />
                La técnica
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Trabaja <strong className="text-foreground">{workMinutes} min</strong>{" "}
                  concentrado en una tarea.
                </li>
                <li>
                  Descansa <strong className="text-foreground">{breakMinutes} min</strong>.
                </li>
                <li>Repite el ciclo; cada bloque de trabajo cuenta como un pomodoro.</li>
                <li>
                  Cambia los tiempos en <strong className="text-foreground">Ajustes → Pomodoro</strong>.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/*
        Modo ampliado (escritorio): el temporizador a pantalla completa con el
        anillo, la tarea en curso y los mismos controles.
      */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="pomodoro-expanded"
            role="dialog"
            aria-modal="true"
            aria-label="Temporizador Pomodoro ampliado"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background/95 backdrop-blur-xl"
          >
            {/* Resplandor de fondo que acompaña al modo activo */}
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 opacity-70 transition-opacity duration-700"
              style={{
                background:
                  mode === "work"
                    ? "radial-gradient(60% 50% at 50% 45%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 70%)"
                    : "radial-gradient(60% 50% at 50% 45%, rgba(16, 185, 129, 0.12), transparent 70%)",
              }}
            />

            <div className="relative flex items-center justify-between px-6 py-4">
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <TimerIcon className="h-4 w-4 text-primary" />
                Modo concentración
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setExpanded(false)}
                aria-label="Salir del modo ampliado"
              >
                <Minimize2 />
              </Button>
            </div>

            <div className="relative flex flex-1 flex-col items-center justify-center gap-6 py-6 pl-6 pr-6 sm:gap-8">
              <TimerRing
                secondsLeft={secondsLeft}
                durationSeconds={durationSeconds}
                mode={mode}
                running={running}
                completedFlash={completedFlash}
                reduceMotion={reduceMotion}
                size="xl"
              />

              {/* La tarea en curso se muestra, no se edita: para cambiarla hay que
                  volver a la vista normal. */}
              <div className="flex flex-col items-center gap-1.5 text-center">
                <AnimatePresence mode="wait" initial={false}>
                  {selectedTask ? (
                    <motion.span
                      key={selectedTask.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="inline-flex max-w-2xl items-center gap-2 rounded-full bg-primary/10 px-5 py-2 text-base font-medium text-primary"
                    >
                      <BellRing className="h-4 w-4 shrink-0" />
                      <span className="truncate">Trabajando en: {selectedTask.title}</span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="sin-tarea"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="text-base text-muted-foreground"
                    >
                      Sin tarea específica
                    </motion.span>
                  )}
                </AnimatePresence>
                <span className="text-xs text-muted-foreground/70">
                  Cambia la tarea desde la vista normal
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button className="h-12 px-8 text-base" onClick={toggleRunning}>
                  {running ? <Pause className="size-5" /> : <Play className="size-5" />}
                  {running ? "Pausar" : "Iniciar"}
                </Button>
                <Button variant="outline" className="h-12 px-6 text-base" onClick={handleReset}>
                  <RotateCcw className="size-5" />
                  Reiniciar
                </Button>
                <Button variant="ghost" className="h-12 px-6 text-base" onClick={handleSkip}>
                  <SkipForward className="size-5" />
                  Saltar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
