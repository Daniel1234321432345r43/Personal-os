import { Sparkles } from "lucide-react";

/**
 * Pantalla de carga a pantalla completa. Se muestra mientras se determina el
 * estado de autenticación / onboarding, evitando cualquier parpadeo o
 * pantalla intermedia (null) antes de renderizar la vista final.
 */
export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Sparkles className="h-6 w-6" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold tracking-tight">Núcleo</p>
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </div>
      <span className="flex gap-1.5">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
      </span>
    </div>
  );
}