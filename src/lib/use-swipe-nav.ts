"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  animate,
  useMotionValue,
  useReducedMotion,
  type MotionStyle,
} from "framer-motion";

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

export interface SwipeNavResult {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  /** Transform del contenedor: el contenido sigue al dedo durante el gesto */
  style: MotionStyle;
  /** true mientras el dedo arrastra en horizontal */
  dragging: boolean;
  /**
   * Dirección de la última navegación, para la animación de entrada:
   *   1  = volvió a la ruta anterior (la nueva página entra desde la izquierda)
   *   -1 = avanzó a la siguiente   (la nueva página entra desde la derecha)
   *   0  = navegación normal (sin dirección)
   */
  lastDirection: 1 | -1 | 0;
}

const AXIS_LOCK_DISTANCE = 6; // px antes de decidir eje horizontal/vertical
const SWIPE_THRESHOLD = 65; // px mínimos de arrastre para navegar
const VELOCITY_THRESHOLD = 0.4; // px/ms mínimos para "lanzar" la página
const DRAG_RESISTANCE = 1; // 1:1 con el dedo: el contenido sigue exactamente el gesto

/**
 * Hook de swipe horizontal para móvil.
 * El contenido se mueve en tiempo real siguiendo el dedo (transform 1:1).
 * Al soltar:
 *  - Si supera el umbral (o hay velocidad), la página sale deslizada en la
 *    dirección del gesto y navega; la nueva página entra desde el lado opuesto.
 *  - Si no, vuelve a su posición con un rebote elástico.
 * @param navigate  Función de navegación (router.push)
 * @param currentPath pathname actual
 * @param enabled  Si está habilitado (móvil)
 */
export function useSwipeNav(
  navigate: (href: string) => void,
  currentPath: string,
  enabled: boolean,
): SwipeNavResult {
  const x = useMotionValue(0);
  const reduceMotion = useReducedMotion();

  const [dragging, setDragging] = useState(false);
  const [lastDirection, setLastDirection] = useState<1 | -1 | 0>(0);

  const startX = useRef(0);
  const startY = useRef(0);
  const lastX = useRef(0);
  const lastTime = useRef(0);
  const tracking = useRef(false);
  const horizontal = useRef(false);
  const moved = useRef(false);
  const lockUntil = useRef(0); // evita dobles gestos durante una transición

  const springBack = useCallback(() => {
    animate(x, 0, {
      type: "spring",
      stiffness: 460,
      damping: 32,
      mass: 0.9,
    });
  }, [x]);

  // Limpia la dirección de entrada una vez reproducida la animación
  useEffect(() => {
    if (lastDirection === 0) return;
    const t = setTimeout(() => setLastDirection(0), 500);
    return () => clearTimeout(t);
  }, [lastDirection]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || Date.now() < lockUntil.current) return;
      const touch = e.touches[0];
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      lastX.current = touch.clientX;
      lastTime.current = Date.now();
      tracking.current = true;
      horizontal.current = false;
      moved.current = false;
      x.stop();
    },
    [enabled, x],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !tracking.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;

      // Decidir el eje al superar un pequeño umbral
      if (!horizontal.current) {
        if (Math.abs(dx) < AXIS_LOCK_DISTANCE && Math.abs(dy) < AXIS_LOCK_DISTANCE)
          return;
        if (Math.abs(dy) > Math.abs(dx)) {
          // Gesto vertical: dejar que el scroll / pull-to-refresh funcione
          tracking.current = false;
          return;
        }
        horizontal.current = true;
        setDragging(true);
      }

      moved.current = true;
      // Sigue al dedo en tiempo real
      x.set(dx * DRAG_RESISTANCE);
      lastX.current = touch.clientX;
      lastTime.current = Date.now();
    },
    [enabled, x],
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !tracking.current) return;
      tracking.current = false;
      setDragging(false);
      if (!horizontal.current || !moved.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX.current;
      const dt = Math.max(1, Date.now() - lastTime.current);
      const velocity = (touch.clientX - lastX.current) / dt;

      const currentIndex = SWIPE_ROUTES.findIndex((r) =>
        currentPath.startsWith(r),
      );
      if (currentIndex === -1) return;

      let direction: 1 | -1 | 0 = 0;
      if (dx <= -SWIPE_THRESHOLD || velocity <= -VELOCITY_THRESHOLD) {
        direction = -1; // swipe izquierda → siguiente
      } else if (dx >= SWIPE_THRESHOLD || velocity >= VELOCITY_THRESHOLD) {
        direction = 1; // swipe derecha → anterior
      }

      if (direction === 0) {
        springBack();
        return;
      }

      const nextIndex =
        direction === -1
          ? Math.min(currentIndex + 1, SWIPE_ROUTES.length - 1)
          : Math.max(currentIndex - 1, 0);
      if (nextIndex === currentIndex) {
        springBack();
        return;
      }

      const target = SWIPE_ROUTES[nextIndex];
      setLastDirection(direction);

      if (reduceMotion) {
        x.set(0);
        navigate(target);
        return;
      }

      lockUntil.current = Date.now() + 600;

      // El contenido sale deslizado en la dirección del gesto…
      animate(
        x,
        direction * window.innerWidth,
        {
          duration: 0.22,
          ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
        },
      ).then(() => {
        // …y la nueva página entra desde el lado contrario
        navigate(target);
        x.set(0);
      });
    },
    [enabled, currentPath, navigate, x, reduceMotion, springBack],
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    style: { x },
    dragging,
    lastDirection,
  };
}
