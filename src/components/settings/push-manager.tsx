"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getPushSubscription,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { Bell, BellOff, Loader2, Send } from "lucide-react";

type Status = { ok: boolean; message: string } | null;

export function PushManager() {
  const supported = pushSupported();
  const supabaseOn = isSupabaseConfigured();

  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState<"subscribe" | "unsubscribe" | "test" | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const refresh = useCallback(async () => {
    if (!supported) return;
    setPermission(Notification.permission);
    const sub = await getPushSubscription();
    setSubscribed(Boolean(sub));
  }, [supported]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function handleSubscribe() {
    setBusy("subscribe");
    setStatus(null);
    const result = await subscribeToPush();
    setStatus(result.ok
      ? { ok: true, message: "Notificaciones activadas. Recibirás avisos antes de tus sesiones y entrenos." }
      : { ok: false, message: result.error ?? "No se pudo activar." });
    if (result.ok) await refresh();
    setBusy(null);
  }

  async function handleUnsubscribe() {
    setBusy("unsubscribe");
    setStatus(null);
    const result = await unsubscribeFromPush();
    setStatus(result.ok
      ? { ok: true, message: "Notificaciones desactivadas." }
      : { ok: false, message: result.error ?? "No se pudo desactivar." });
    await refresh();
    setBusy(null);
  }

  async function handleTest() {
    setBusy("test");
    setStatus(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.sent > 0) {
        setStatus({ ok: true, message: `Notificación de prueba enviada (${data.sent}/${data.total}).` });
      } else {
        setStatus({ ok: false, message: data?.error ?? `Error ${res.status} al enviar la prueba.` });
      }
    } catch (err) {
      setStatus({
        ok: false,
        message: err instanceof Error ? err.message : "No se pudo enviar la prueba.",
      });
    }
    setBusy(null);
  }

  const canSubscribe = supported && supabaseOn && permission !== "denied" && !subscribed;
  const canTest = supported && subscribed;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Bell className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Recibe notificaciones <strong>aunque la app esté cerrada</strong> cuando
          empiece una sesión de estudio, un examen o un entrenamiento con hora.
          Requiere iniciar sesión con Supabase y tener la Edge Function desplegada.
        </p>
      </div>

      {!supported && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Tu navegador no soporta notificaciones push.
        </p>
      )}

      {supported && !supabaseOn && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          Las notificaciones push requieren Supabase (iniciar sesión). En modo
          local solo se guardan los datos en el navegador.
        </p>
      )}

      {supported && permission === "denied" && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          Bloqueaste las notificaciones en el navegador. Actívalas desde los
          ajustes del sitio (icono del candado) para poder suscribirte.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {canSubscribe && (
          <Button type="button" onClick={handleSubscribe} disabled={busy !== null}>
            {busy === "subscribe" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            Activar notificaciones
          </Button>
        )}

        {subscribed && (
          <Button type="button" variant="outline" onClick={handleUnsubscribe} disabled={busy !== null}>
            {busy === "unsubscribe" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            Desactivar
          </Button>
        )}

        {canTest && (
          <Button type="button" variant="secondary" onClick={handleTest} disabled={busy !== null}>
            {busy === "test" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar notificación de prueba
          </Button>
        )}
      </div>

      {status && (
        <p
          className={`rounded-lg border p-3 text-sm ${
            status.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}
