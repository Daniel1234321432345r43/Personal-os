"use client";

import { CircleAlert, X } from "lucide-react";
import { useData } from "@/components/providers/data-provider";

/**
 * Aviso de sincronización fallida. Un borrado o un guardado rechazado antes
 * solo aparecía en la consola: el dato seguía en la nube y "resucitaba" al
 * recargar sin que el usuario supiera nada. Se muestra en Hoy y en Estudios.
 */
export function SyncErrorBanner() {
  const { syncError, clearSyncError } = useData();
  if (!syncError) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{syncError}</span>
      <button
        type="button"
        onClick={clearSyncError}
        title="Descartar"
        className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-amber-500/20 active:scale-95"
      >
        <X className="h-3.5 w-3.5" />
        <span className="sr-only">Descartar aviso</span>
      </button>
    </div>
  );
}
