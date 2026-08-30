"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useXpSystem } from "@/lib/xp-system";

function ToastItem({
  toast,
  reduced,
  onDone,
}: {
  toast: { id: string; value: number; color: string; label: string; limit?: boolean };
  reduced: boolean;
  onDone: (id: string) => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), reduced ? 1200 : 3200);
    return () => clearTimeout(timer);
  }, [reduced]);

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.9 }}
      animate={
        visible
          ? reduced
            ? { opacity: 1 }
            : { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: -12, scale: 0.95 }
      }
      transition={{ duration: 0.22, ease: "easeOut" }}
      onAnimationComplete={() => {
        if (!visible) onDone(toast.id);
      }}
      className="pointer-events-auto flex items-center gap-2 rounded-full bg-white/95 py-2 pl-3 pr-4 shadow-lg ring-1 ring-black/5"
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: toast.color }}
      >
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      {toast.limit ? (
        <span className="flex flex-col">
          <span className="text-sm font-black" style={{ color: toast.color }}>
            Límite diario alcanzado
          </span>
          <span className="text-xs font-medium text-slate-600">
            Consigue más XP mañana
          </span>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <span className="text-sm font-black" style={{ color: toast.color }}>
            +{toast.value} XP
          </span>
          <span className="text-xs font-medium text-slate-600">{toast.label}</span>
        </span>
      )}
    </motion.div>
  );
}

/**
 * Avisos flotantes de XP. Lee las notificaciones del hook central `useXpSystem`,
 * que detecta en tiempo real cuando una tarea, hábito o Pomodoro se completa y
 * emite la notificación correspondiente (una sola vez por acción y por día).
 */
export function XpToast() {
  const { notifications, dismissNotification } = useXpSystem();
  const reduced = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {notifications.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            reduced={Boolean(reduced)}
            onDone={dismissNotification}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
