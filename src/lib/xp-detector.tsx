"use client";

import { useEffect } from "react";
import { useData } from "@/components/providers/data-provider";
import { awardXp } from "@/lib/xp-system";
import { localDayKey, todayKey } from "@/lib/format";

/**
 * Red de seguridad para el XP de tareas. Se monta una sola vez en AppShell.
 * Cuando las tareas cambian, otorga +20 XP por cualquier tarea que haya pasado
 * a "done" hoy, aunque la llamada directa desde `toggleTaskDone` no se hubiera
 * ejecutado o hubiera fallado. La deduplicación por día en `awardXp` garantiza
 * que una misma tarea nunca se premia dos veces, así que convivir con la
 * llamada directa es seguro (no se suma doble).
 */
export function XpDetector() {
  const { data } = useData();

  useEffect(() => {
    const today = todayKey();
    for (const task of data.tasks) {
      if (task.status !== "done") continue;
      if (localDayKey(task.updated_at) !== today) continue;
      // awardXp ya evita repetir (dedup) y marca el evento como celebrado.
      awardXp("task", task.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tasks]);

  return null;
}