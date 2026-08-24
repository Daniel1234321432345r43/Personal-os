"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer as TimerIcon,
  Workflow,
} from "lucide-react";

type Mode = "work" | "break";

/**
 * Muestra una notificación persistente (requireInteraction): no desaparece sola,
 * hay que cerrarla. Se usa al terminar cada sesión del temporizador.
 */
async function showPersistentNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const options: NotificationOptions = {
    body,
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: `pomodoro-${Date.now()}`,
    requireInteraction: true,
    data: { url: "/pomodoro" },
  };

  try {
    const reg = await registerServiceWorker();
    if (reg) {
      await reg.showNotification(title, options);
    } else {
      // Sin service worker: la API de Notification también soporta requireInteraction.
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

  const completedRef = useRef(false);
  const originalTitleRef = useRef<string | null>(null);

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

  // Al llegar a 0: timbre + notificación persistente + cambio de modo.
  useEffect(() => {
    if (!running || secondsLeft > 0) return;
    if (completedRef.current) return;
    completedRef.current = true;

    const wasWork = mode === "work";
    const task = taskId ? data.tasks.find((t) => t.id === taskId) : undefined;
    const taskLabel = task?.title ? ` Estabas con: ${task.title}.` : "";

    playChime();
    if (wasWork) {
      void showPersistentNotification(
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
      void showPersistentNotification(
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

  // Reflejar el tiempo restante en el título de la pestaña.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (originalTitleRef.current === null) originalTitleRef.current = document.title;
    if (running) {
      const tmm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
      const tss = String(secondsLeft % 60).padStart(2, "0");
      document.title = `${tmm}:${tss} · ${mode === "work" ? "Trabajo" : "Descanso"} · Núcleo`;
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

  const selectedTask = taskId ? data.tasks.find((t) => t.id === taskId) : undefined;

  const progress = durationSeconds > 0 ? secondsLeft / durationSeconds : 0;
  const circumference = 2 * Math.PI * 90;
  const dashOffset = circumference * (1 - progress);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

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
    void showPersistentNotification(
      "Núcleo · Pomodoro",
      "🔔 Esta notificación no desaparece sola: ciérrala cuando quieras.",
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Pomodoro</h1>
        <p className="text-sm text-muted-foreground">
          Concéntrate en una tarea y descansa: la técnica Pomodoro.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col items-center gap-6 py-8">
            {/* Anillo de progreso + tiempo */}
            <div className="relative h-56 w-56">
              <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  strokeWidth="10"
                  className="stroke-muted"
                />
                <circle
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className={cn(
                    "transition-[stroke-dashoffset] duration-1000 ease-linear",
                    mode === "work" ? "stroke-primary" : "stroke-emerald-500",
                  )}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span
                  className={cn(
                    "text-5xl font-bold tabular-nums tracking-tight",
                    mode === "work"
                      ? "text-foreground"
                      : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {mm}:{ss}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  {mode === "work" ? (
                    <>
                      <TimerIcon className="h-4 w-4 text-primary" />
                      Trabajo
                    </>
                  ) : (
                    <>
                      <Coffee className="h-4 w-4 text-emerald-500" />
                      Descanso
                    </>
                  )}
                </span>
              </div>
            </div>

            {selectedTask && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <BellRing className="h-3.5 w-3.5" />
                Trabajando en: {selectedTask.title}
              </span>
            )}

            {/* Selector de tarea */}
            <div className={cn(fieldClass, "w-full max-w-md")}>
              <label className={labelClass} htmlFor="pomodoro-task">
                ¿En qué estás trabajando?
              </label>
              <select
                id="pomodoro-task"
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
              <span className="font-semibold text-foreground">{completedSessions}</span>
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
                  Permiso concedido: al terminar el temporizador recibirás un aviso que
                  no desaparece hasta que lo cierres.
                </p>
              ) : notifDenied ? (
                <p className="text-destructive">
                  Permiso denegado. Actívalo en los ajustes del navegador para que el
                  aviso no se pierda.
                </p>
              ) : (
                <p>
                  Al pulsar “Iniciar” te pediremos permiso. Con permiso, al terminar
                  verás una notificación persistente.
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
    </div>
  );
}
