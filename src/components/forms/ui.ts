// Estilos compartidos para los controles nativos de los formularios
// (mantienen coherencia con los componentes de shadcn/ui).

// h-11 en móvil (touch target ≥ 44px) y h-9 en escritorio (igual que antes).
export const inputClass =
  "flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:text-sm";

export const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:text-sm";

export const labelClass = "text-sm font-medium leading-none";

export const fieldClass = "space-y-1.5";
