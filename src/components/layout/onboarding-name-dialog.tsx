"use client";

import { useState } from "react";
import { Dialog } from "radix-ui";
import { useSettings } from "@/components/providers/settings-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";

/**
 * Bienvenida de primera vez: pide el nombre del usuario y lo guarda en
 * localStorage (vía SettingsProvider). Hasta que no lo introduce no se cierra,
 * y después nunca vuelve a aparecer.
 */
export function OnboardingNameDialog() {
  const { settings, setSettings, hydrated } = useSettings();
  const [name, setName] = useState("");
  const [error, setError] = useState(false);

  // Settings aún cargando o el usuario ya tiene nombre → no mostrar nada.
  if (!hydrated || settings.userName) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    setSettings({ ...settings, userName: trimmed });
  }

  return (
    <Dialog.Root open onOpenChange={() => {}}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs data-open:animate-in data-open:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-popover p-6 shadow-lg data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
        >
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-6 w-6" />
            </span>
            <Dialog.Title className="mt-3 text-lg font-semibold tracking-tight">
              ¡Bienvenido a Núcleo!
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground">
              ¿Cómo te llamas? Te saludaré cada día en tu dashboard.
            </Dialog.Description>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            <Input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(false);
              }}
              placeholder="Tu nombre"
              aria-label="Tu nombre"
              aria-invalid={error}
              className={error ? "border-destructive" : undefined}
            />
            {error && (
              <p className="text-xs text-destructive" role="alert">
                Escribe tu nombre para continuar.
              </p>
            )}
            <Button type="submit" className="w-full">
              Comenzar
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
