import { Button } from "@/components/ui/button";
import type { FilterType } from "./types";
import {
  ListFilter,
  Layers,
  GraduationCap,
  CheckCircle2,
  Wallet,
  Dumbbell,
} from "lucide-react";

interface CalendarFiltersProps {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function CalendarFilters({ filter, onFilterChange }: CalendarFiltersProps) {
  return (
    <div className="order-2 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ListFilter className="h-3.5 w-3.5" /> Filtrar:
      </span>
      <Button
        variant={filter === "all" ? "default" : "outline"}
        size="sm"
        className="h-10 rounded-full text-xs md:h-7"
        onClick={() => onFilterChange("all")}
      >
        <Layers className="mr-1 h-3 w-3" />
        Todo
      </Button>
      <Button
        variant={filter === "academic" ? "default" : "outline"}
        size="sm"
        className="h-10 rounded-full text-xs md:h-7"
        onClick={() => onFilterChange("academic")}
      >
        <GraduationCap className="mr-1 h-3 w-3" />
        Exámenes y Entregas
      </Button>
      <Button
        variant={filter === "tasks" ? "default" : "outline"}
        size="sm"
        className="h-10 rounded-full text-xs md:h-7"
        onClick={() => onFilterChange("tasks")}
      >
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Tareas
      </Button>
      <Button
        variant={filter === "finance" ? "default" : "outline"}
        size="sm"
        className="h-10 rounded-full text-xs md:h-7"
        onClick={() => onFilterChange("finance")}
      >
        <Wallet className="mr-1 h-3 w-3" />
        Finanzas
      </Button>
      <Button
        variant={filter === "sport" ? "default" : "outline"}
        size="sm"
        className="h-10 rounded-full text-xs md:h-7"
        onClick={() => onFilterChange("sport")}
      >
        <Dumbbell className="mr-1 h-3 w-3" />
        Deporte
      </Button>
    </div>
  );
}
