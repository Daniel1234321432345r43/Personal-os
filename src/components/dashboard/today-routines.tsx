"use client";

import { motion } from "framer-motion";
import { Check, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import { todayKey, formatDuration } from "@/lib/format";
import { useData } from "@/components/providers/data-provider";

export function TodayRoutines() {
  const { data, actions } = useData();
  const today = todayKey();

  const workoutsToday = data.workouts.filter((w) => w.date === today);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Rutinas de hoy</h3>

      {workoutsToday.length > 0 && (
        <motion.div
          className="space-y-1.5"
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
        >
          {workoutsToday.map((w) => (
            <motion.div
              key={w.id}
              layout
              variants={{
                hidden: { opacity: 0, y: 12 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.4, ease: "easeOut" },
                },
              }}
              className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm"
            >
              <Dumbbell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium">{w.activity_type}</span>
              <span className="text-xs text-muted-foreground">
                {formatDuration(w.duration_minutes)}
              </span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {data.habits.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tienes hábitos ni entrenamientos para hoy. Añádelos en{" "}
          <span className="font-medium">Deporte</span>.
        </p>
      ) : (
        <ul className="space-y-1">
          {data.habits.map((habit) => {
            const done = data.habitCompletions.some(
              (c) => c.habit_id === habit.id && c.completed_on === today,
            );
            return (
              <li key={habit.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => actions.toggleHabit(habit.id)}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors md:h-5 md:w-5",
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:border-primary",
                  )}
                  aria-pressed={done}
                  aria-label={`Marcar ${habit.name}`}
                >
                  {done && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 26 }}
                      className="flex"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </motion.span>
                  )}
                </button>
                <span className="text-sm">{habit.emoji}</span>
                <span
                  className={cn(
                    "text-sm",
                    done && "text-muted-foreground line-through",
                  )}
                >
                  {habit.name}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
