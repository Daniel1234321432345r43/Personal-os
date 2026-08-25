import type { Variants } from "framer-motion";

/**
 * Variantes de animación compartidas por toda la app para mantener un lenguaje
 * visual coherente: entradas pausadas y suaves, salidas deslizando a la
 * derecha y despliegue de altura suave. Se usan para todo lo que se añade,
 * elimina o despliega (lists, grids, formularios, secciones...).
 */

/** Entrada/salida estándar de un solo elemento (listas, cards, filas). */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    x: 32,
    transition: { duration: 0.4, ease: "easeInOut" },
  },
};

/** Contenedor que anima sus hijos en cascada (stagger). */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

/** Variantes altas para uso directo con motion (initial/animate/exit). */
export const itemMotion = {
  initial: "hidden" as const,
  animate: "visible" as const,
  exit: "exit" as const,
  variants: itemVariants,
};

/** Entrada de elementos en grid o tarjetas (más vertical). */
export const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.45, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.3, ease: "easeInOut" },
  },
};

export const cardItemMotion = {
  initial: "hidden" as const,
  animate: "visible" as const,
  exit: "exit" as const,
  variants: cardItemVariants,
};

/**
 * Despliegue vertical suave (acordeón / formulario que se abre debajo de un
 * botón). Animación de altura + opacidad, coherencia con MobileCollapsible.
 */
export const formRevealVariants: Variants = {
  hidden: { height: 0, opacity: 0, y: -4 },
  visible: {
    height: "auto",
    opacity: 1,
    y: 0,
    transition: {
      height: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] },
      opacity: { duration: 0.3 },
      y: { duration: 0.3 },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    y: -4,
    transition: {
      height: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
      opacity: { duration: 0.2 },
      y: { duration: 0.2 },
    },
  },
};

export const formRevealMotion = {
  initial: "hidden" as const,
  animate: "visible" as const,
  exit: "exit" as const,
  variants: formRevealVariants,
};

/** Retardo por defecto de los componentes (framer-motion). */
export const springSoft = { type: "spring", stiffness: 400, damping: 30 } as const;