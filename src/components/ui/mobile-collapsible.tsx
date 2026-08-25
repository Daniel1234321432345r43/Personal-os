"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Tarjeta colapsable con animación de altura suave (para móvil).
 * El usuario la usa dentro de contenedores `lg:hidden` para no tocar desktop.
 */
export function MobileCollapsible({
  title,
  subtitle,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-muted/50"
      >
        <span className="flex min-w-0 items-center gap-3">
          {icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              {icon}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {title}
            </span>
            {subtitle && (
              <span className="block truncate text-xs text-muted-foreground">
                {subtitle}
              </span>
            )}
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
              opacity: { duration: 0.3 },
            }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
