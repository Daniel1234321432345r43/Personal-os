"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { todayKey } from "@/lib/format";
import { examCompletedMessage } from "@/lib/study-summary";
import { showBrowserNotification } from "@/lib/browser-notify";
import type { Task } from "@/lib/types";

/**
 * Cierre automático de los exámenes y sesiones de estudio que ya han pasado su día.
 *
 * 1) Exámenes: cuando pasa el día del examen, se completa solo con su XP y aviso.
 * 2) Sesiones de estudio (pomodoros y bloques de trabajo): cuando llegan a ser las
 *    12 de la noche de ese mismo día (cambio de fecha local), se completan automáticamente
 *    para no requerir que el usuario tenga que marcarlas a mano una a una.
 *
 * Se ejecuta al abrir la app, con visibilidad activa, periódicamente y exactamente al
 * pasar la medianoche (00:00:01).
 */

/** Exámenes de los que ya se avisó al sistema (para no repetir el aviso). */
const NOTIFIED_KEY = "nucleo:exam-autoclose:v1";
const NOTIFIED_LIMIT = 500;
/** Días hacia atrás con aviso del sistema: el historial viejo no avisa. */
const NOTIFY_WINDOW_DAYS = 7;

function readNotified(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "[]") as unknown;
    return new Set(
      Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function writeNotified(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set].slice(-NOTIFIED_LIMIT)));
  } catch {
    // Ignorar errores de cuota o de acceso.
  }
}

/** Días transcurridos desde `dueDate` hasta `today` (ambos YYYY-MM-DD). */
function daysSince(dueDate: string, today: string): number {
  const [y1, m1, d1] = dueDate.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  const from = Date.UTC(y1, m1 - 1, d1);
  const to = Date.UTC(y2, m2 - 1, d2);
  return Math.round((to - from) / 86_400_000);
}

export function ExamAutoClose() {
  const { data, actions } = useData();
  /** Elementos ya procesados en este montaje: evita repetir mientras se propaga el cambio. */
  const handled = useRef<Set<string>>(new Set());
  /** Revisión extra al volver a la app o al pasar la medianoche. */
  const [recheck, setRecheck] = useState(0);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setRecheck((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);

    // Programar comprobación exacta al llegar a las 12 de la noche (00:00:01 de mañana)
    const scheduleMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1,
      );
      const ms = Math.max(1000, nextMidnight.getTime() - now.getTime());
      return window.setTimeout(() => {
        setRecheck((n) => n + 1);
      }, ms);
    };

    const midnightTimeout = scheduleMidnight();
    // Chequeo periódico cada minuto por si el dispositivo estuvo suspendido
    const intervalId = window.setInterval(() => {
      setRecheck((n) => n + 1);
    }, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(midnightTimeout);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const today = todayKey();

    // 1. Exámenes vencidos que ya pasaron de fecha
    const overdueExams: Task[] = data.tasks.filter(
      (t) =>
        t.type === "exam" &&
        t.status !== "done" &&
        !!t.due_date &&
        t.due_date < today,
    );

    if (overdueExams.length > 0) {
      const freshExams = overdueExams.filter((t) => !handled.current.has(t.id));
      if (freshExams.length > 0) {
        const notified = readNotified();
        let notifiedChanged = false;

        for (const exam of freshExams) {
          handled.current.add(exam.id);
          actions.toggleTaskDone(exam.id, { xpLabel: examCompletedMessage(exam.title) });

          const days = daysSince(exam.due_date as string, today);
          if (days <= NOTIFY_WINDOW_DAYS && !notified.has(exam.id)) {
            notified.add(exam.id);
            notifiedChanged = true;
            void showBrowserNotification(
              "Examen completado ✅",
              `${examCompletedMessage(exam.title)}. Ya está marcado como hecho.`,
              { url: "/academic", tag: `exam-done-${exam.id}` },
            );
          }
        }

        if (notifiedChanged) writeNotified(notified);
      }
    }

    // 2. Sesiones de estudio (Pomodoros / bloques) que ya alcanzaron las 12 de la noche de su día
    const overdueStudySessions: Task[] = data.tasks.filter((t) => {
      if (t.type !== "study_session" || t.status === "done") return false;
      const sessionDate = t.due_date || t.created_at?.slice(0, 10);
      return !!sessionDate && sessionDate < today;
    });

    if (overdueStudySessions.length > 0) {
      const freshSessions = overdueStudySessions.filter((t) => !handled.current.has(t.id));
      for (const session of freshSessions) {
        handled.current.add(session.id);
        // Se completa automáticamente sin notificaciones intrusivas ni duplicar XP
        // (los pomodoros individuales ya premiaron el tiempo estudiado con 10 XP cada uno).
        actions.toggleTaskDone(session.id, { skipXp: true });
      }
    }
  }, [data.tasks, actions, recheck]);

  return null;
}
