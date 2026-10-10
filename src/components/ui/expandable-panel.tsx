"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Despliegue animado que NO recorta el contenido.
 *
 * Mientras se abre (o se cierra) hay que recortar, porque la altura va de 0 a la
 * del contenido. El problema era quedarse así para siempre: con
 * `overflow-hidden` y una altura fija, en cuanto el contenido cambiaba de tamaño
 * —añadir una asignatura, girar el móvil, abrir el teclado— el módulo contenedor
 * se cortaba y las opciones de configuración quedaban fuera de alcance.
 *
 * Aquí, en cuanto termina la animación se suelta el recorte y la altura vuelve a
 * ser la del contenido, así que el contenedor siempre mide lo que mide lo que
 * tiene dentro.
 */
export function ExpandablePanel({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  /** true cuando la animación de apertura ya ha terminado. */
  const [settled, setSettled] = useState(false);

  // Al cerrar se vuelve a recortar enseguida (si no, el contenido se saldría
  // mientras se recoge) y se rearma para la siguiente apertura.
  const clipped = !open || !settled;

  return (
    <AnimatePresence initial={false} onExitComplete={() => setSettled(false)}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{
            height: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] },
            opacity: { duration: 0.25 },
          }}
          onAnimationComplete={() => setSettled(true)}
          className={clipped ? "overflow-hidden" : "overflow-visible"}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
