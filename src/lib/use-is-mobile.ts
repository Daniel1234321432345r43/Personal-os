"use client";

import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

/** Consulta de medios del tamaño móvil (una sola definición del breakpoint). */
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/**
 * ¿La ventana es de móvil AHORA MISMO? Síncrono, así que sirve para el estado
 * inicial de un componente: el hook de abajo no puede (responde en un efecto,
 * cuando ya se ha pintado). Devuelve false en el servidor.
 */
export function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(MOBILE_MEDIA_QUERY).matches
  );
}

/**
 * Detecta si la pantalla es de tamaño móvil (< 768 px).
 * Se actualiza en tiempo real al cambiar el tamaño de la ventana.
 * Devuelve `false` durante SSR para evitar hydration mismatch.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_MEDIA_QUERY);

    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mql);

    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

/** Detecta la vista de escritorio a partir del breakpoint `lg` de Tailwind. */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);

    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsDesktop(e.matches);
    handler(mql);

    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isDesktop;
}
