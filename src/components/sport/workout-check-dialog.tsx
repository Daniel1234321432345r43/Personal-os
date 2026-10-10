"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/providers/data-provider";
import { Button } from "@/components/ui/button";
import { formatDuration, todayKey } from "@/lib/format";
import { Dumbbell, X } from "lucide-react";

/**
 * «¿Has ido al entreno?» tras la notificación.
 *
 * El cron (send-reminders) avisa cuando un entreno del plan semanal ya ha
 * terminado. Al pulsar la notificación se abre la app con estos parámetros:
 *
 *   /dashboard?entreno=1&nombre=Gimnasio&min=60&fecha=2026-10-10&plan=<id>
 *
 * Este componente los lee y muestra el modal con «Entreno [Nombre] [X]
 * minutos» y los botones «Sí lo he hecho» / «No lo he hecho». Lleva los datos
 * en la URL a propósito: aunque el plan cambie después del aviso, el modal
 * enseña y guarda lo que se le preguntó al usuario.
 *
 * Se monta una vez en AppShell. Los parámetros se limpian nada más leerlos,
 * para que el modal no reaparezca al recargar la página.
 */

interface PendingWorkout {
  name: string;
  minutes: number;
  date: string;
}

export function WorkoutCheckDialog() {
  const { actions } = useData();
  const [pending, setPending] = useState<PendingWorkout | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("entreno") !== "1") return;

    const minutes = Number(params.get("min"));
    // Patrón intencional: los parámetros de la notificación solo existen en el
    // cliente, tras hidratar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending({
      name: params.get("nombre")?.trim() || "el entrenamiento",
      minutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 60,
      date: params.get("fecha") || todayKey(),
    });

    const url = new URL(window.location.href);
    for (const key of ["entreno", "nombre", "min", "fecha", "plan"]) {
      url.searchParams.delete(key);
    }
    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams}` : ""}${url.hash}`,
    );
  }, []);

  // El aviso de guardado se cierra solo: es una confirmación, no una pantalla.
  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setPending(null), 2200);
    return () => window.clearTimeout(timer);
  }, [saved]);

  if (!pending) return null;

  function confirm() {
    if (!pending) return;
    actions.addWorkout({
      activity_type: pending.name,
      date: pending.date,
      duration_minutes: pending.minutes,
    });
    setSaved(true);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar entrenamiento"
    >
      <div className="w-full max-w-sm rounded-2xl border bg-background p-5 shadow-lg">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Dumbbell className="h-5 w-5 shrink-0 text-primary" />
            <span>
              Entreno {pending.name} {pending.minutes} minutos
            </span>
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-1 -mt-1 h-8 w-8 shrink-0 text-muted-foreground"
            onClick={() => setPending(null)}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {saved ? (
          <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            ¡Apuntado! Has registrado {formatDuration(pending.minutes)} de{" "}
            {pending.name}.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Hoy tocaba {pending.name} ({formatDuration(pending.minutes)}), ¿has
              ido?
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={confirm}>
                Sí lo he hecho
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPending(null)}
              >
                No lo he hecho
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
