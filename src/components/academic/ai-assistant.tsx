"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useData } from "@/components/providers/data-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { buildSecretaryContext } from "@/lib/ai/context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, todayKey } from "@/lib/format";
import type { AcademicAdvice } from "@/lib/ai/types";
import type { TaskPriority } from "@/lib/types";
import { CalendarClock, Loader2, Sparkles } from "lucide-react";

const priorityBadge: Record<TaskPriority, string> = {
  urgent: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  high: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  medium: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  low: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

const priorityLabel: Record<TaskPriority, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

function daysUntil(iso: string): number {
  const today = new Date(`${todayKey()}T00:00:00`);
  const due = new Date(`${iso}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function AiAssistant() {
  const { data } = useData();
  const { settings, configured } = useSettings();
  const [advice, setAdvice] = useState<AcademicAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const context = useMemo(() => buildSecretaryContext(data), [data]);

  const deadlines = useMemo(() => {
    const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
    return data.tasks
      .filter(
        (t) =>
          (t.type === "assignment" || t.type === "exam") &&
          t.status !== "done" &&
          t.due_date,
      )
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        priority: t.priority,
        due_date: t.due_date!,
        subject: t.subject_id ? subjectById.get(t.subject_id)?.name ?? "General" : "General",
      }));
  }, [data]);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/academic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, settings }),
      });
      if (!res.ok) {
        throw new Error((await res.text()) || "Error generando recomendaciones");
      }
      setAdvice((await res.json()) as AcademicAdvice);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error generando recomendaciones");
    } finally {
      setLoading(false);
    }
  }

  const adviceById = new Map((advice?.recommendations ?? []).map((r) => [r.id, r.advice]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Asistente académico</h3>
          <p className="text-xs text-muted-foreground">
            Cuándo tienes cada entrega o examen y qué hacer.
          </p>
        </div>
        {deadlines.length > 0 && configured && (
          <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Recomendaciones
          </Button>
        )}
      </div>

      {!configured && (
        <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          Añade una API key en{" "}
          <Link href="/settings" className="font-medium underline">
            Ajustes
          </Link>{" "}
          para recibir recomendaciones.
        </p>
      )}

      {deadlines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tienes entregas ni exámenes pendientes. 🎉
        </p>
      ) : (
        <ul className="space-y-2">
          {deadlines.map((d) => {
            const days = daysUntil(d.due_date);
            const daysLabel =
              days < 0 ? "atrasado" : days === 0 ? "¡hoy!" : `${days} d`;
            return (
              <li key={d.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.subject} · {d.type === "exam" ? "Examen" : "Entrega"} ·{" "}
                      {formatDate(d.due_date)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className={priorityBadge[d.priority]}>
                      {priorityLabel[d.priority]}
                    </Badge>
                    <span
                      className={`flex items-center gap-1 text-xs ${
                        days < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <CalendarClock className="h-3 w-3" />
                      {daysLabel}
                    </span>
                  </div>
                </div>

                {adviceById.has(d.id) && (
                  <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                    {adviceById.get(d.id)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </p>
      )}

      {advice?.summary && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs font-semibold">Resumen</p>
          <p className="mt-1 text-sm text-muted-foreground">{advice.summary}</p>
        </div>
      )}
    </div>
  );
}
