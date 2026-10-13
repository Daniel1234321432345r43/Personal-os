"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useData } from "@/components/providers/data-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { showBrowserNotification } from "@/lib/browser-notify";
import { awardXp } from "@/lib/xp-system";
import { logStudySession, useStudyLog } from "@/lib/study-log";
import { formatDuration, todayKey } from "@/lib/format";
import {
  composeWorkTitle,
  findStudyBlockId,
  studyBlockTitle,
} from "@/lib/study-summary";
import { inferSubjectFromTitle } from "@/lib/subjects";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fieldClass, labelClass, selectClass } from "@/components/forms/ui";
import { cn } from "@/lib/utils";
import {
  BellRing,
  Coffee,
  GraduationCap,
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
 * Cómo se escribe el nombre del trabajo nuevo. NO es el tipo de la tarea
 * creada: esa es siempre una sesión de estudio ("Estudiar para el examen de
 * Dibujo técnico" es el bloque de estudio, no el examen). Si fuera de tipo
 * examen, el sistema lo daría por hecho al pasar el día y dejaría de acumular
 * el tiempo.
 */
type NewWorkKind = "exam" | "assignment" | "study_session";

/** Opciones del selector de trabajo nuevo: cómo se llamará la tarea del día. */
const NEW_WORK_KINDS: { kind: NewWorkKind; label: string }[] = [
  { kind: "exam", label: "Estudiar para examen" },
  { kind: "assignment", label: "Trabajar en…" },
  { kind: "study_session", label: "Estudiar" },
];

/** Valor del selector para "algo que todavía no está en la lista". */
const NEW_WORK_VALUE = "__nuevo__";

/**
 * Notificación persistente al terminar cada sesión (timbre).
 * Se cierra sola o al pulsar sobre ella.
 */
function showCompletionNotification(title: string, body: string) {
  return showBrowserNotification(title, body, { url: "/pomodoro" });
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
 * Identificador único por pomodoro. El sistema de XP deduplica por día los
 * pomodoros, así que cada uno necesita su propio id o el segundo del día no
 * daría XP.
 */
function pomodoroEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `pomodoro-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Id de la tarea de trabajo que crea el Pomodoro. Se genera aquí para poder
 * enlazar la sesión de estudio con la tarea en el mismo instante en que se crea
 * (con un id del servidor habría que esperar a que volviera la respuesta).
 */
function newTaskId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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
  const { data, actions } = useData();
  const { settings } = useSettings();
  const study = useStudyLog();

  const workMinutes = settings.pomodoroWorkMinutes ?? 25;
  const breakMinutes = settings.pomodoroBreakMinutes ?? 5;

  const [mode, setMode] = useState<Mode>("work");
  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60);
  const [running, setRunning] = useState(false);
  const [taskId, setTaskId] = useState("");
  /**
   * Trabajo escrito a mano ("dibujo técnico") cuando lo que vas a hacer no
   * está todavía en la lista. Al terminar el pomodoro se crea la tarea del día
   * con ese nombre y ahí se acumula el tiempo.
   */
  const [customWork, setCustomWork] = useState(false);
  const [newWork, setNewWork] = useState("");
  const [newWorkKind, setNewWorkKind] = useState<NewWorkKind>("exam");
  const [completedSessions, setCompletedSessions] = useState(0);
  const [completedFlash, setCompletedFlash] = useState(false);
  /** true tras un pomodoro de trabajo: muestra el resumen de tiempo estudiado. */
  const [showStudySummary, setShowStudySummary] = useState(false);
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



  /**
   * Trabajo de este pomodoro: a qué tarea se apunta el tiempo y cómo se llama el
   * bloque. El bloque es la tarea del día que aparece en el calendario; se
   * reutiliza el de hoy si ya existe, para que los pomodoros de la misma jornada
   * sumen ahí en lugar de crear uno por sesión.
   *
   *   · Examen o entrega de la lista → bloque «Estudiar para el examen de X» /
   *     «Trabajar en X», enlazado al examen con `parent_task_id` (así el examen
   *     conserva sus horas dedicadas, ver `studyMinutesForTask`).
   *   · Algo escrito a mano → bloque con el nombre elegido ("Estudiar mates").
   *   · Cualquier otra tarea (o ninguna) → el tiempo va a esa tarea.
   */
  const resolveWork = useCallback((): { id: string | null; title: string } => {
    const focus = taskId ? data.tasks.find((t) => t.id === taskId) : undefined;
    const date = todayKey();

    // ── Examen o entrega: el bloque se llama por lo que estás preparando ──
    const examTitle = studyBlockTitle(focus);
    if (examTitle) {
      const existing = findStudyBlockId(data.tasks, examTitle, date);
      if (existing) return { id: existing, title: examTitle };

      const id = newTaskId();
      actions.addTask({
        id,
        title: examTitle,
        type: "study_session",
        due_date: date,
        subject_id: focus?.subject_id ?? null,
        parent_task_id: focus?.id ?? null,
      });
      return { id, title: examTitle };
    }

    // ── Algo que todavía no estaba en la lista ────────────────────────────
    if (customWork) {
      const title = composeWorkTitle(newWorkKind, newWork);
      if (!title) return { id: null, title: "" };

      const existing = findStudyBlockId(data.tasks, title, date);
      if (existing) return { id: existing, title };

      const id = newTaskId();
      // Si el nombre corresponde a una asignatura que ya existe, el bloque se
      // enlaza a ella. Una asignatura NUEVA no se crea desde aquí: el pomodoro no
      // debe llenar la lista de asignaturas por escribir una palabra.
      const guess = inferSubjectFromTitle(newWork, data.subjects);
      actions.addTask({
        id,
        title,
        type: "study_session",
        due_date: date,
        subject_name: guess?.exists ? guess.name : null,
      });
      return { id, title };
    }

    // ── Una tarea cualquiera (o ninguna) ─────────────────────────────────
    return { id: taskId || null, title: focus?.title ?? "" };
  }, [actions, customWork, data.subjects, data.tasks, newWork, newWorkKind, taskId]);

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
    // El trabajo de este pomodoro: la tarea elegida o el bloque que se acaba de
    // crear (la sesión de estudio se enlaza a él).
    const work = wasWork ? resolveWork() : { id: null, title: "" };
    const workTaskId = work.id;
    const taskLabel = work.title ? ` Estabas con: ${work.title}.` : "";

    playChime();
    if (wasWork) {
      // Tiempo estudiado: cada pomodoro de trabajo suma sus minutos al registro
      // (y a la tarea elegida, si la hay). La XP también va por tiempo: 10 XP por
      // pomodoro, no por completar la tarea.
      logStudySession({ taskId: workTaskId, minutes: workMinutes });
      awardXp("pomodoro", pomodoroEventId(), {
        value: 10,
        label: `Pomodoro de ${formatDuration(workMinutes)}`,
      });
      void showCompletionNotification(
        "Pomodoro completado 🍅",
        `¡Buen trabajo! Descansa ${breakMinutes} min.${taskLabel}`,
      );
      window.setTimeout(() => {
        setRunning(false);
        setCompletedSessions((n) => n + 1);
        setShowStudySummary(true);
        setMode("break");
        setSecondsLeft(breakMinutes * 60);
        // El siguiente pomodoro sigue en el mismo trabajo (ya el bloque del día).
        setTaskId(workTaskId ?? "");
        setCustomWork(false);
        setNewWork("");
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
  }, [
    running,
    secondsLeft,
    mode,
    taskId,
    breakMinutes,
    workMinutes,
    data.tasks,
    resolveWork,
  ]);

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
  /** Lo que se muestra como trabajo en curso: la tarea elegida o lo escrito a mano. */
  const selectedLabel = selectedTask?.title ?? (customWork ? newWork.trim() : "");
  const newWorkTitle = composeWorkTitle(newWorkKind, newWork);
  /**
   * Si lo elegido es un examen o una entrega, al terminar el pomodoro se creará
   * este bloque del día en el calendario.
   */
  const selectedBlockTitle = customWork ? "" : studyBlockTitle(selectedTask);

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
    setShowStudySummary(false);
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

  /** Selector de trabajo: se reutiliza en la tarjeta y en el modo ampliado. */
  function renderTaskPicker(id: string, maxWidth: string) {
    return (
      <div className={cn(fieldClass, "w-full", maxWidth)}>
        <label className={labelClass} htmlFor={id}>
          ¿En qué estás trabajando?
        </label>
        <select
          id={id}
          value={customWork ? NEW_WORK_VALUE : taskId}
          onChange={(e) => {
            const value = e.target.value;
            if (value === NEW_WORK_VALUE) {
              setCustomWork(true);
              setTaskId("");
              return;
            }
            setCustomWork(false);
            setNewWork("");
            setTaskId(value);
          }}
          className={selectClass}
        >
          <option value="">Sin tarea específica</option>
          {pendingTasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
              {t.due_date ? ` · ${t.due_date}` : ""}
            </option>
          ))}
          <option value={NEW_WORK_VALUE}>＋ Algo nuevo (se añade a las tareas del día)…</option>
        </select>

        {/* Estudiar un examen o una entrega crea solo el bloque del día: se
            avisa ANTES de empezar, para que no sorprenda al terminar. */}
        {selectedBlockTitle && (
          <p className="text-xs text-muted-foreground">
            Al terminar el pomodoro se creará hoy{" "}
            <span className="font-medium text-foreground">«{selectedBlockTitle}»</span> en el
            calendario, con el tiempo que le dediques.
          </p>
        )}

        {customWork && (
          <div className="mt-2 space-y-2 rounded-xl border border-dashed p-3">
            <Input
              value={newWork}
              onChange={(e) => setNewWork(e.target.value)}
              placeholder="Ej. Dibujo técnico, Práctica 3 de Redes…"
              aria-label="¿En qué trabajas?"
            />
            <div className="flex flex-wrap gap-1.5">
              {NEW_WORK_KINDS.map((option) => (
                <Button
                  key={option.kind}
                  type="button"
                  size="sm"
                  variant={newWorkKind === option.kind ? "default" : "outline"}
                  className="rounded-full text-xs"
                  onClick={() => setNewWorkKind(option.kind)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {newWorkTitle ? (
                <>
                  Al terminar el pomodoro se añadirá la tarea del día{" "}
                  <span className="font-medium text-foreground">«{newWorkTitle}»</span> con el
                  tiempo de hoy. Los pomodoros siguientes seguirán sumando ahí.
                </>
              ) : (
                "Escribe en qué trabajas: se añadirá como tarea del día con el tiempo que le dediques."
              )}
            </p>
          </div>
        )}
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
              {selectedLabel && (
                <motion.span
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  Trabajando en: {selectedLabel}
                </motion.span>
              )}
            </AnimatePresence>

            {/* Resumen de tiempo estudiado tras completar un pomodoro */}
            <AnimatePresence initial={false}>
              {showStudySummary && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center text-sm"
                >
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                    <GraduationCap className="h-4 w-4" />
                    ¡Pomodoro completado!
                  </span>
                  <span className="text-muted-foreground">
                    Hoy: <strong className="text-foreground">{formatDuration(study.minutesToday)}</strong>
                    {" · "}Esta semana:{" "}
                    <strong className="text-foreground">{formatDuration(study.minutesThisWeek)}</strong>
                    {" · "}Total: <strong className="text-foreground">{formatDuration(study.totalMinutes)}</strong>
                  </span>
                </motion.div>
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
                  Si eliges un <strong className="text-foreground">examen</strong> o una{" "}
                  <strong className="text-foreground">entrega</strong>, al terminar se crea el
                  bloque del día («Estudiar para el examen de X») en el calendario, con el tiempo
                  dedicado.
                </li>
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
                  {selectedLabel ? (
                    <motion.span
                      key={selectedLabel}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                      className="inline-flex max-w-2xl items-center gap-2 rounded-full bg-primary/10 px-5 py-2 text-base font-medium text-primary"
                    >
                      <BellRing className="h-4 w-4 shrink-0" />
                      <span className="truncate">Trabajando en: {selectedLabel}</span>
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

              {/* Resumen de tiempo estudiado tras completar un pomodoro */}
              <AnimatePresence initial={false}>
                {showStudySummary && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-muted-foreground"
                  >
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                      <GraduationCap className="h-4 w-4" />
                      ¡Pomodoro completado!
                    </span>
                    <span>
                      Hoy: <strong className="text-foreground">{formatDuration(study.minutesToday)}</strong>
                      {" · "}Esta semana:{" "}
                      <strong className="text-foreground">{formatDuration(study.minutesThisWeek)}</strong>
                    </span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
