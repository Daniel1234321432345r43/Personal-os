"use client";

import { useIsMobile } from "@/lib/use-is-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ReactNode } from "react";

/**
 * Hoja inferior (bottom sheet) SOLO para móvil: abre los formularios de
 * creación/edición desde abajo, estilo app nativa. En escritorio no renderiza
 * nada: ahí los formularios siguen usándose inline, tal y como estaban.
 */
export function ResponsiveFormSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88dvh] gap-0 rounded-t-2xl px-0 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        {/* Asa de arrastre para dar feedback táctil */}
        <div className="mx-auto mt-2.5 mb-1 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25" />
        <SheetHeader className="px-4 pb-2 pt-1">
          <SheetTitle className="text-base">{title}</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto overscroll-contain px-4 pb-6">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
