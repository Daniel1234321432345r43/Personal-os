"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, GraduationCap, Loader2, RefreshCw, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";

type Notice = { kind: "success" | "error"; text: string } | null;

export function ClassroomConnect() {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<boolean | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [importing, setImporting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  // La conexión con Classroom necesita sesión en la app (el token se guarda
  // asociado a tu cuenta de Supabase).
  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setSession(Boolean(data.session)))
      .catch(() => setSession(false));
  }, []);

  // Feedback al volver del flujo OAuth de Google (/academic?classroom=...).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("classroom");
    const detail = params.get("detail");
    if (status === "connected") {
      setNotice({
        kind: "success",
        text: "¡Conectado a Google Classroom! Pulsa \"Importar ahora\" para traer tus cursos y entregas.",
      });
    } else if (status === "error") {
      setNotice({
        kind: "error",
        text: detail
          ? `No se pudo conectar Google Classroom. Detalle: ${detail}`
          : "No se pudo conectar Google Classroom. Comprueba las credenciales y vuelve a intentarlo.",
      });
    } else if (status === "login") {
      setNotice({
        kind: "error",
        text: "Para conectar Google Classroom primero inicia sesión en la app (\"Continuar con Google\" en la pantalla de acceso).",
      });
    }
    if (status) {
      // Limpia el parámetro para que el aviso no se repita al recargar.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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
        let msg = `Sincronizadas ${data.courses} asignaturas. Las tareas nuevas te llegarán por notificación.`;
        if (data.errors?.length) {
          msg += ` Algunos elementos fallaron: ${data.errors.join(" | ")}`;
        }
        setResult(msg);
      } else {
        setResult(data.error ?? "Error al importar.");
      }
    } catch {
      setResult("Error al importar.");
    } finally {
      setImporting(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("¿Desconectar Google Classroom? Las tareas ya importadas se quedan en tu app, pero dejarás de recibir novedades.")) return;
    setDisconnecting(true);
    setResult(null);
    try {
      const res = await fetch("/api/classroom", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConnected(false);
        setNotice({ kind: "success", text: "Google Classroom desconectado." });
      } else {
        setNotice({ kind: "error", text: data.error ?? "No se pudo desconectar." });
      }
    } catch {
      setNotice({ kind: "error", text: "No se pudo desconectar." });
    } finally {
      setDisconnecting(false);
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

  // Sin sesión en la app: hay que iniciar sesión para poder conectar.
  if (session === false) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Para conectar Google Classroom necesitas tener sesión iniciada en la
          app (los permisos se guardan en tu cuenta).{" "}
          <Link href="/login" className="font-medium underline">
            Iniciar sesión
          </Link>
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {notice && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-lg border p-3 text-sm",
            notice.kind === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
          )}
        >
          {notice.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </p>
      )}
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
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={disconnect}
            disabled={disconnecting}
          >
            {disconnecting && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Desconectar
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
    </div>
  );
}
