"use client";

import { useEffect, useSyncExternalStore, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { isOnboardingComplete } from "@/lib/onboarding";
import { FullScreenLoader } from "@/components/ui/full-screen-loader";

const emptySubscribe = () => () => {};

/**
 * Lee el flag de onboarding como estado externo (localStorage).
 * Durante SSR devuelve false (aún no se sabe), evitando mismatches.
 */
function useOnboardingDone(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => isOnboardingComplete(),
    () => false,
  );
}

/**
 * En la primera apertura de la app (flag de onboarding sin marcar) redirige a
 * la pantalla de inicio de sesión / registro. Una vez superada (o omitida),
 * deja pasar al contenido normal.
 *
 * Para evitar el "flashazo" (parpadeo a Login al cargar con sesión iniciada),
 * se espera a que la hidratación del cliente haya leído el valor real del flag
 * (localStorage) antes de decidir. Hasta entonces se muestra un indicador de
 * carga global en lugar de renderizar `null` o redirigir prematuramente.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const done = useOnboardingDone();
  const [ready, setReady] = useState(false);

  // Marca que ya estamos en el cliente e hidratados. Solo a partir de aquí el
  // valor `done` es fiable (localStorage leído en el navegador).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!done) router.replace("/login");
  }, [done, ready, router]);

  // Mientras no se confirme el estado real, mostramos el loader global.
  if (!ready || !done) return <FullScreenLoader />;
  return <>{children}</>;
}
