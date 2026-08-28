"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useData } from "@/components/providers/data-provider";
import { todayKey } from "@/lib/format";

const STORAGE_KEY = "nucleo:xp-toast:v1";

type Toast = {
  id: string;
  value: number;
  color: string;
  label: string;
};

/** IDs de completados ya avisados hoy ("tipo:YYYY-MM-DD:id"), para no repetir el toast. */
function readCelebrated(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const today = todayKey();
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string" && id.startsWith(today)) : []);
  } catch { /* Estado local inválido. */ }
  return new Set();
}

function ToastItem({ toast, reduced, onDone }: { toast: Toast; reduced: boolean; onDone: (id: string) => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), reduced ? 1200 : 3200);
    return () => clearTimeout(timer);
  }, [reduced]);

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.9 }}
      animate={visible ? (reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }) : { opacity: 0, y: -12, scale: 0.95 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      onAnimationComplete={() => { if (!visible) onDone(toast.id); }}
      className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 py-2 pl-3 pr-4 shadow-lg ring-1 ring-black/5"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: toast.color }}>
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <span className="text-sm font-black" style={{ color: toast.color }}>+{toast.value} XP</span>
      <span className="text-xs font-medium text-slate-600">{toast.label}</span>
    </motion.div>
  );
}

/**
 * Avisos flotantes de XP: al completar una tarea (+20), un Pomodoro (+25) o un
 * hábito (+5), aparece un toast arriba que se desvanece solo. Solo avisa una vez
 * por completado y por día (persistido en localStorage).
 */
export function XpToast() {
  const { data } = useData();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const celebrated = useRef<Set<string>>(readCelebrated());
  const reduced = useReducedMotion();

  useEffect(() => {
    const today = todayKey();
    const earned: Toast[] = [];
    for (const task of data.tasks) {
      if (task.status !== "done" || task.updated_at.slice(0, 10) !== today) continue;
      const id = `task:${task.id}`;
      if (celebrated.current.has(id)) continue;
      celebrated.current.add(id);
      earned.push(
        task.type === "study_session"
          ? { id, value: 25, color: "#ea580c", label: "Pomodoro completado" }
          : { id, value: 20, color: "#16a34a", label: "Tarea completada" },
      );
    }
    for (const habit of data.habitCompletions) {
      if (habit.completed_on !== today) continue;
      const id = `habit:${habit.id}`;
      if (celebrated.current.has(id)) continue;
      celebrated.current.add(id);
      earned.push({ id, value: 5, color: "#0ea5e9", label: "Hábito completado" });
    }
    if (earned.length === 0) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...celebrated.current].slice(-200))); } catch { /* Almacenamiento no disponible. */ }
    const now = Date.now();
    setToasts((prev) => [
      ...prev,
      ...earned.slice(0, 5).map((item, index) => ({ ...item, id: `${item.id}:${now}:${index}` })),
    ]);
  }, [data.habitCompletions, data.tasks]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            reduced={Boolean(reduced)}
            onDone={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}