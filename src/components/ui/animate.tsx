"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  cardItemVariants,
  formRevealVariants,
  itemVariants,
  staggerContainer,
} from "@/lib/motion-variants";

/**
 * Contenedores de animación reutilizables. Se aplican de forma consistente en
 * toda la app para que TODO lo que se añade, elimina o despliega tenga una
 * transición pausada y suave.
 */

/** Contenedor con stagger para listas/grids (los hijos usan FormItem/CardItem). */
export function AnimateList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.ul
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.ul>
  );
}

/** Item de lista con entrada/salida animadas. Úsalo como `motion.li` reutilizable. */
export function FormItem({
  children,
  layout,
  className,
}: {
  children: ReactNode;
  layout?: boolean;
  className?: string;
}) {
  return (
    <motion.li
      layout={layout}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={className}
    >
      {children}
    </motion.li>
  );
}

/** Card en grid con entrada animada. Úsala como `motion.div`. */
export function CardItem({
  children,
  layout,
  className,
}: {
  children: ReactNode;
  layout?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      layout={layout}
      variants={cardItemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Grid con entrada escalonada (stagger) de sus hijas (CardItem). */
export function AnimateCards({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Envuelve un formulario / contenido que se abre y cierra con despliegue suave
 * (altura + opacidad). Coherente con MobileCollapsible y el chat del Secreto.
 */
export function FormReveal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          variants={formRevealVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Anima la aparición de cualquier bloque de contenido (mensajes, resultados,
 * resúmenes) al montarse: fade + deslizamiento vertical corto.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}