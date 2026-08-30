"use client";

import { useEffect } from "react";
import { useData } from "@/components/providers/data-provider";
import { applyHabitPenalty } from "@/lib/xp-system";

/**
 * Revisión diaria de hábitos. Se monta una vez en AppShell. Cuando la app se
 * abre (o cambia el día), llama a applyHabitPenalty, que resta 15 XP por cada
 * hábito que no se completó el día anterior. La función es idempotente: solo
 * penaliza una vez por día (guarda la fecha del último día revisado), así que
 * repuntar cuando cambian los hábitos no duplica la penalización.
 */
export function XpPenalizer() {
  const { data } = useData();

  useEffect(() => {
    applyHabitPenalty(data.habits, data.habitCompletions);
  }, [data.habits, data.habitCompletions]);

  return null;
}