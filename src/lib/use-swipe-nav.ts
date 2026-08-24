"use client";

import { useCallback, useRef } from "react";

/**
 * Rutas en orden para swipe horizontal (solo móvil).
 * Swipe izq → siguiente ruta, swipe der → ruta anterior.
 */
const SWIPE_ROUTES = [
  "/dashboard",
  "/calendar",
  "/academic",
  "/pomodoro",
  "/notes",
  "/sport",
  "/finance",
  "/settings",
];

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

/**
 * Hook que detecta swipe horizontal en móvil y navega entre secciones.
 * Devuelve handlers para onTouchStart/Move/End que se ponen en el contenedor.
 * @param navigate  Función de navegación (router.push)
 * @param currentPath pathname actual
 * @param enabled  Si está habilitado (móvil)
 */
export function useSwipeNav(
  navigate: (href: string) => void,
  currentPath: string,
  enabled: boolean,
): SwipeHandlers {
  const startX = useRef(0);
  const startY = useRef(0);
  const tracking = useRef(false);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      tracking.current = true;
    },
    [enabled],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !tracking.current) return;
      // Cancelar si el usuario hace scroll vertical (más移动 vertical que horizontal)
      const dx = Math.abs(e.touches[0].clientX - startX.current);
      const dy = Math.abs(e.touches[0].clientY - startY.current);
      if (dy > dx && dy > 10) {
        tracking.current = false;
      }
    },
    [enabled],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !tracking.current) return;
      tracking.current = false;

      const dx = e.changedTouches[0].clientX - startX.current;
      const THRESHOLD = 80; // píxeles mínimos para registrar swipe

      if (Math.abs(dx) < THRESHOLD) return;

      const currentIndex = SWIPE_ROUTES.findIndex((r) =>
        currentPath.startsWith(r),
      );
      if (currentIndex === -1) return;

      let nextIndex: number;
      if (dx < 0) {
        // Swipe izquierda → siguiente
        nextIndex = Math.min(currentIndex + 1, SWIPE_ROUTES.length - 1);
      } else {
        // Swipe derecha → anterior
        nextIndex = Math.max(currentIndex - 1, 0);
      }

      if (nextIndex !== currentIndex) {
        navigate(SWIPE_ROUTES[nextIndex]);
      }
    },
    [enabled, currentPath, navigate],
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
