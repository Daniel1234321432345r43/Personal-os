"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { todayKey } from "@/lib/format";
import { examCompletedMessage } from "@/lib/study-summary";
import { showBrowserNotification } from "@/lib/browser-notify";
import type { Task } from "@/lib/types";

/**
 * Cierre automático de los exámenes que ya han pasado su día.
 *
 * Un examen se apunta con su fecha ("Examen de Dibujo Técnico el 12 de
 * octubre"). Cuando ese día termina, ya no hay nada que marcar: el examen está
 * hecho. Este módulo lo completa solo (con su XP y su aviso, "Has completado el
 * examen de Dibujo Técnico") para que no haya que acordarse de darle al tick.
 *
 * Se ejecuta al abrir la app y cada vez que cambian las tareas, así que también
 * cierra los exámenes que pasaron mientras la app estaba cerrada. Se monta una
 * vez en AppShell. Si el usuario vuelve a desmarcar un examen a mano, no se
 * vuelve a completar solo: solo se tocan los que siguen pendientes.
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
  /** Exámenes ya procesados en este montaje: evita repetir mientras se propaga el cambio. */
  const handled = useRef<Set<string>>(new Set());
  /** Revisión extra al volver a la app: si pasa la medianoche con la app abierta. */
  const [recheck, setRecheck] = useState(0);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setRecheck((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    const today = todayKey();
    const overdue: Task[] = data.tasks.filter(
      (t) =>
        t.type === "exam" &&
        t.status !== "done" &&
        !!t.due_date &&
        t.due_date < today,
    );
    if (overdue.length === 0) return;

    const fresh = overdue.filter((t) => !handled.current.has(t.id));
    if (fresh.length === 0) return;

    const notified = readNotified();
    let notifiedChanged = false;

    for (const exam of fresh) {
      handled.current.add(exam.id);
      actions.toggleTaskDone(exam.id, { xpLabel: examCompletedMessage(exam.title) });

      // Aviso del sistema: solo para exámenes recientes. Al abrir la app por
      // primera vez con un historial largo no debe salir un aluvión de avisos.
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
  }, [data.tasks, actions, recheck]);

  return null;
}
