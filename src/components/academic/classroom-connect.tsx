"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GraduationCap, RefreshCw, Loader2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";

export function ClassroomConnect() {
  const configured = isSupabaseConfigured();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setConnected(false);
      return;
    }
    fetch("/api/classroom")
      .then((r) => r.json())
      .then((d) => setConnected(Boolean(d.connected)))
      .catch(() => setConnected(false));
  }, [configured]);

  async function importNow() {
    setImporting(true);
    setResult(null);
    try {
      const res = await fetch("/api/classroom", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setResult(`Sincronizadas ${data.courses} asignaturas y ${data.tasks} tareas.`);
      } else {
        setResult(data.error ?? "Error al importar.");
      }
    } catch {
      setResult("Error al importar.");
    } finally {
      setImporting(false);
    }
  }

  if (!configured) {
    return (
      <p className="text-sm text-muted-foreground">
        Configura Supabase y Google Classroom (variables de entorno) para
        sincronizar tus cursos y entregas automáticamente.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {connected ? (
        <>
          <Button variant="outline" onClick={importNow} disabled={importing}>
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Importar ahora
          </Button>
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Conectado a Google Classroom
          </span>
        </>
      ) : (
        <Button asChild>
          <a href="/api/classroom/oauth">
            <GraduationCap className="h-4 w-4" />
            Conectar Google Classroom
          </a>
        </Button>
      )}
      {result && <p className="w-full text-sm text-muted-foreground">{result}</p>}
    </div>
  );
}
