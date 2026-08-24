"use client";

import { useCallback, useRef, useState } from "react";

interface PullRefreshState {
  pulling: boolean;
  refreshing: boolean;
  pullDistance: number;
}

interface PullRefreshHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

const THRESHOLD = 80; // píxeles para activar refresh

/**
 * Hook para pull-to-refresh en móvil.
 * Detecta el gesto de tirar hacia abajo y ejecuta un callback.
 * @param onRefresh  Async callback que se ejecuta al soltar después de tirar
 * @param enabled  Si está habilitado (móvil)
 */
export function usePullRefresh(
  onRefresh: () => Promise<void>,
  enabled: boolean,
): PullRefreshState & PullRefreshHandlers {
  const [state, setState] = useState<PullRefreshState>({
    pulling: false,
    refreshing: false,
    pullDistance: 0,
  });

  const startY = useRef(0);
  const tracking = useRef(false);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || state.refreshing) return;
      // Solo activar si el scroll está arriba (top del contenedor)
      const scrollable = e.currentTarget;
      if (scrollable.scrollTop > 5) return;

      startY.current = e.touches[0].clientY;
      tracking.current = true;
      setState((s) => ({ ...s, pulling: false, pullDistance: 0 }));
    },
    [enabled, state.refreshing],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !tracking.current) return;
      const dy = e.touches[0].clientY - startY.current;

      // Solo pull down (dy > 0)
      if (dy <= 0) {
        tracking.current = false;
        setState((s) => ({ ...s, pulling: false, pullDistance: 0 }));
        return;
      }

      // Resistencia: cuanto más tiras, más cuesta
      const distance = Math.min(dy * 0.5, 120);
      setState((s) => ({
        ...s,
        pulling: distance > 20,
        pullDistance: distance,
      }));
    },
    [enabled],
  );

  const onTouchEnd = useCallback(async () => {
    if (!enabled || !tracking.current) return;
    tracking.current = false;

    setState((s) => {
      if (s.pullDistance >= THRESHOLD) {
        // Activar refresh
        onRefresh().then(() => {
          setState((prev) => ({ ...prev, refreshing: false, pullDistance: 0 }));
        });
        return { ...s, refreshing: true, pulling: false };
      }
      return { ...s, pulling: false, pullDistance: 0 };
    });
  }, [enabled, onRefresh]);

  return { ...state, onTouchStart, onTouchMove, onTouchEnd };
}
