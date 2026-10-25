"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  Copy,
  Check,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Zap,
  AlertCircle,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { useData } from "@/components/providers/data-provider";
import { todayKey } from "@/lib/format";

export function AppleWalletCard() {
  const { actions } = useData();
  const [loading, setLoading] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadToken = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    if (!isSupabaseConfigured()) {
      setIsLoggedIn(false);
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoggedIn(false);
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);

      const res = await fetch("/api/finance/webhook/token");
      if (res.ok) {
        const data = await res.json();
        const url =
          data.webhookUrl ||
          `${window.location.origin}/api/finance/webhook?token=${data.token}`;
        setWebhookUrl(url);
        setToken(data.token);
        setLastUsedAt(data.lastUsedAt || null);
      } else {
        const errData = await res.json().catch(() => null);
        setErrorMsg(
          errData?.error || "No se pudo generar el enlace del webhook.",
        );
      }
    } catch (err) {
      console.error("Error cargando token de webhook:", err);
      setErrorMsg("Error de conexión al cargar tu enlace de webhook.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadToken();
  }, [loadToken]);

  async function copyUrl() {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerateToken() {
    if (
      !confirm(
        "¿Seguro que quieres generar una nueva clave? Si ya configuraste el atajo en tu iPhone tendrás que actualizar la URL en Atajos.",
      )
    ) {
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/finance/webhook/token", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const url =
          data.webhookUrl ||
          `${window.location.origin}/api/finance/webhook?token=${data.token}`;
        setWebhookUrl(url);
        setToken(data.token);
      } else {
        const errData = await res.json().catch(() => null);
        setErrorMsg(errData?.error || "No se pudo regenerar el token.");
      }
    } catch (err) {
      console.error("Error regenerando token:", err);
      setErrorMsg("Error de conexión al regenerar token.");
    } finally {
      setLoading(false);
    }
  }

  async function testWebhook() {
    if (!token) return;
    setTesting(true);
    setTestSuccess(false);
    setTestError(null);
    try {
      const res = await fetch(`/api/finance/webhook?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 1.0,
          merchant: "Mercadona (Prueba)",
          category: "food",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        // Insertar en local para que la UI de Finanzas se actualice inmediatamente
        actions.addTransaction({
          type: "expense",
          amount: 1.0,
          category: data.transaction?.category || "food",
          description: "Mercadona (Prueba)",
          date: todayKey(),
        });
        setTestSuccess(true);
        setTimeout(() => setTestSuccess(false), 4000);
      } else {
        const errData = await res.json().catch(() => null);
        setTestError(errData?.error || "Error en el test");
        setTimeout(() => setTestError(null), 5000);
      }
    } catch (err) {
      console.error("Error en prueba de webhook:", err);
      setTestError("Error de conexión al realizar la prueba");
      setTimeout(() => setTestError(null), 5000);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-muted/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Apple Wallet & Atajos de iOS
                <Badge
                  variant="secondary"
                  className="text-[10px] gap-1 font-normal bg-primary/10 text-primary"
                >
                  <Zap className="h-3 w-3" /> Tiempo real
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Registra tus compras automáticamente cada vez que pagues con tu iPhone o Apple Watch.
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInstructions((v) => !v)}
            className="text-xs gap-1.5"
          >
            {showInstructions ? "Ocultar guía" : "Ver guía de configuración"}
            {showInstructions ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {!isLoggedIn ? (
          <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground space-y-2.5">
            <ShieldCheck className="mx-auto h-6 w-6 text-primary/60" />
            <div>
              <p className="font-medium text-foreground">Inicia sesión con tu cuenta</p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-md mx-auto">
                Para generar tu enlace personal y privado de sincronización con Apple Pay es necesario tener una cuenta iniciada.
              </p>
            </div>
            <Button asChild size="sm" className="text-xs">
              <a href="/login">Iniciar sesión</a>
            </Button>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
            Cargando tu enlace de conexión seguro...
          </div>
        ) : errorMsg ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={loadToken}
              className="h-7 text-xs shrink-0"
            >
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Tu URL personal de webhook para Atajos
                </label>
                {lastUsedAt && (
                  <span className="text-[10px] text-muted-foreground">
                    Último uso: {new Date(lastUsedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl || ""}
                  className="flex-1 rounded-md border bg-muted/40 px-3 py-1.5 text-xs font-mono select-all focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={copyUrl}
                  disabled={!webhookUrl}
                  className="gap-1.5 shrink-0 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Copiada
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copiar
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={regenerateToken}
                  title="Generar nueva clave"
                  className="h-8 w-8 p-0 shrink-0 text-muted-foreground"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span>
                  Categorización automática por nombre de comercio (Mercadona, Zara, Uber, etc.)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {testError && (
                  <span className="text-[11px] text-destructive">{testError}</span>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={testWebhook}
                  disabled={testing || !token}
                  className="h-7 text-[11px] gap-1.5"
                >
                  {testing
                    ? "Probando..."
                    : testSuccess
                    ? "¡Prueba registrada! ✅"
                    : "Probar envío de prueba (1 €)"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Guía desplegable de configuración paso a paso */}
        {showInstructions && (
          <div className="rounded-xl border bg-card/60 p-4 space-y-3 text-xs animate-in fade-in-50 duration-200">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Smartphone className="h-4 w-4 text-primary" />
              <span>Cómo configurar el Atajo en tu iPhone en 1 minuto:</span>
            </div>

            <ol className="list-decimal pl-4 space-y-2 text-muted-foreground">
              <li>
                Abre la app nativa <strong>Atajos (Shortcuts)</strong> en tu iPhone.
              </li>
              <li>
                Ve a la pestaña inferior <strong>Automatización</strong> y pulsa en el botón <strong>+</strong> (o Crear automatización personal).
              </li>
              <li>
                Busca y pulsa en <strong>Transacción</strong> (icono de tarjeta de crédito).
              </li>
              <li>
                Selecciona la tarjeta o tarjetas que uses con Apple Pay y pulsa <strong>Siguiente</strong>.
              </li>
              <li>
                Añade la acción: <strong>Obtener contenido de URL</strong>:
                <ul className="list-disc pl-4 mt-1 space-y-1 text-foreground/80">
                  <li>
                    <strong>URL:</strong> Pega tu URL personal copiada arriba.
                  </li>
                  <li>
                    <strong>Método:</strong> Elige <code className="bg-muted px-1 rounded">POST</code>.
                  </li>
                  <li>
                    <strong>Solicitar cuerpo:</strong> Elige <code className="bg-muted px-1 rounded">JSON</code>.
                  </li>
                  <li>
                    Añade un campo de texto: clave <code className="bg-muted px-1 rounded">amount</code> → pulsa en el teclado y selecciona la variable <strong>«Importe»</strong> del atajo.
                  </li>
                  <li>
                    Añade un campo de texto: clave <code className="bg-muted px-1 rounded">merchant</code> → pulsa y selecciona la variable <strong>«Comercio»</strong>.
                  </li>
                </ul>
              </li>
              <li>
                Pulsa <strong>Siguiente</strong>, desactiva la casilla <strong>«Solicitar confirmación»</strong> y pulsa <strong>Listo</strong>.
              </li>
            </ol>

            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-emerald-800 dark:text-emerald-300 text-[11px]">
              🎉 <strong>¡Listo!</strong> A partir de ahora, cada vez que acerques tu iPhone o Apple Watch para pagar, tu teléfono registrará el gasto automáticamente en Núcleo en ese mismo segundo.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
