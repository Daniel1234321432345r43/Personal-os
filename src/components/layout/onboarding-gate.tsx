"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { isOnboardingComplete } from "@/lib/onboarding";

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
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const done = useOnboardingDone();

  useEffect(() => {
    if (!done) router.replace("/login");
  }, [done, router]);

  if (!done) return null;
  return <>{children}</>;
}
