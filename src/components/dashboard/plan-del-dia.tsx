"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings } from "@/components/providers/settings-provider";
import { cn } from "@/lib/utils";
import type { DayPlan } from "@/lib/ai/types";
import type { SecretaryContext } from "@/lib/ai/types";

const categoryStyles: Record<string, string> = {
  academic: "border-l-blue-500",
  sport: "border-l-emerald-500",
  finance: "border-l-amber-500",
  personal: "border-l-violet-500",
  break: "border-l-muted-foreground/40",
};

export function PlanDelDia({ context }: { context: SecretaryContext }) {
  const { settings, configured } = useSettings();
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, settings }),
      });
      if (!res.ok) {
        throw new Error((await res.text()) || "Error generando el plan");
      }
      const data = (await res.json()) as DayPlan;
      setPlan(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error generando el plan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Plan del día</h3>
        {plan && (
          <Button variant="ghost" size="sm" onClick={generate} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span className="sr-only">Regenerar</span>
          </Button>
        )}
      </div>

      {!configured && (
        <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          Añade una API key en{" "}
          <Link href="/settings" className="font-medium underline">
            Ajustes
          </Link>{" "}
          para generar el plan automáticamente.
        </p>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </p>
      )}

      {!plan && !loading && !error && (
        <Button
          variant="outline"
          className="w-full"
          onClick={generate}
          disabled={!configured}
        >
          <Sparkles className="h-4 w-4" />
          Generar plan del día
        </Button>
      )}

      {plan && !loading && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{plan.summary}</p>
          <ul className="space-y-2">
            {plan.blocks.map((block, i) => (
              <li
                key={`${block.time}-${i}`}
                className={cn(
                  "rounded-lg border border-l-4 bg-card p-2.5",
                  categoryStyles[block.category] ?? "border-l-muted",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {block.time}
                  </span>
                  <span className="text-sm font-medium">{block.title}</span>
                </div>
                {block.detail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {block.detail}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
