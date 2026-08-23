"use client";

import { useState } from "react";
import { useSettings } from "@/components/providers/settings-provider";
import { PROVIDERS, getProvider } from "@/lib/ai/models";
import type { AiProviderId } from "@/lib/ai/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PushManager } from "@/components/settings/push-manager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fieldClass, inputClass, labelClass, selectClass } from "@/components/forms/ui";
import { Eye, EyeOff, KeyRound, Loader2, PlugZap, ShieldCheck, Bot, Sparkles, Bell } from "lucide-react";

function LoadingState() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <div className="space-y-6">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function SettingsClient() {
  const { settings, setSettings, configured, envConfigured, hydrated } = useSettings();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!hydrated) {
    return <LoadingState />;
  }

  const provider = getProvider(settings.provider);

  function update(patch: Partial<typeof settings>) {
    setSettings({ ...settings, ...patch });
  }

  function changeProvider(id: AiProviderId) {
    const p = getProvider(id);
    setSettings({
      ...settings,
      provider: id,
      model: p.defaultModel,
      baseURL:
        id === "custom" || id === "omniroute"
          ? settings.baseURL || p.presets[0]?.baseURL || ""
          : "",
    });
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setTestResult({ ok: true, message: data.message ?? "Conexión correcta." });
      } else {
        setTestResult({
          ok: false,
          message: data?.message ?? `Error ${res.status} al probar la conexión.`,
        });
      }
    } catch (e) {
      setTestResult({
        ok: false,
        message: e instanceof Error ? e.message : "No se pudo probar la conexión.",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
          <p className="text-sm text-muted-foreground">
            Configura la IA: proveedor, modelo y API key.
          </p>
        </div>
        {configured ? (
          <Badge variant="secondary" className="gap-1">
            <KeyRound className="h-3 w-3" />
            IA lista
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            IA sin configurar
          </Badge>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Personalización e IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Nombre del Secretario IA */}
            <div className={fieldClass}>
              <label className={`${labelClass} flex items-center gap-1.5`} htmlFor="ai-assistant-name">
                <Bot className="h-4 w-4 text-primary" />
                Nombre de tu Secretario IA
              </label>
              <input
                id="ai-assistant-name"
                value={settings.assistantName ?? "Núcleo"}
                onChange={(e) => update({ assistantName: e.target.value })}
                placeholder="ej. Núcleo, Jarvis, Sofía, Alex..."
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">
                Nombre con el que se identificará tu asistente en el chat, los saludos y las respuestas.
              </p>
            </div>

            <div className="border-t pt-4">
              <div className={fieldClass}>
                <label className={labelClass} htmlFor="ai-provider">
                  Proveedor
                </label>
                <select
                  id="ai-provider"
                  value={settings.provider}
                  onChange={(e) => changeProvider(e.target.value as AiProviderId)}
                  className={selectClass}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {provider.models.length > 0 && (
              <div className={fieldClass}>
                <label className={labelClass} htmlFor="ai-model">
                  Modelo
                </label>
                <select
                  id="ai-model"
                  value={settings.model}
                  onChange={(e) => update({ model: e.target.value })}
                  className={selectClass}
                >
                  {provider.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} ({m.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="ai-model-custom">
                Modelo personalizado (opcional)
              </label>
              <input
                id="ai-model-custom"
                value={settings.model}
                onChange={(e) => update({ model: e.target.value })}
                placeholder={provider.defaultModel || "ej. nombre-del-modelo"}
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">
                Puedes escribir cualquier ID de modelo válido para el proveedor.
              </p>
            </div>

            {provider.needsBaseURL && (
              <div className={fieldClass}>
                <label className={labelClass} htmlFor="ai-baseurl">
                  Base URL (API compatible con OpenAI)
                </label>
                <input
                  id="ai-baseurl"
                  value={settings.baseURL}
                  onChange={(e) => update({ baseURL: e.target.value })}
                  placeholder={provider.baseURLPlaceholder}
                  className={inputClass}
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {provider.presets.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs"
                      onClick={() => update({ baseURL: preset.baseURL })}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className={fieldClass}>
              <label className={labelClass} htmlFor="ai-key">
                {provider.apiKeyLabel}
              </label>
              <div className="relative">
                <input
                  id="ai-key"
                  type={showKey ? "text" : "password"}
                  value={settings.apiKey}
                  onChange={(e) => update({ apiKey: e.target.value })}
                  placeholder={provider.apiKeyPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                  className={`${inputClass} pr-9`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label={showKey ? "Ocultar clave" : "Mostrar clave"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {!settings.apiKey && envConfigured && (
                <p className="text-xs text-muted-foreground">
                  Sin clave escrita: se usará la configurada en el servidor (.env.local).
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" onClick={testConnection} disabled={testing}>
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlugZap className="h-4 w-4" />
                )}
                Probar conexión
              </Button>
            </div>

            {testResult && (
              <p
                className={`rounded-lg border p-3 text-sm ${
                  testResult.ok
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                {testResult.message}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Tu API key se guarda <strong>solo en este navegador</strong>{" "}
                  (localStorage) y se envía únicamente a tu propio servidor para
                  hablar con el proveedor. Adecuado para uso personal en tu
                  dispositivo.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-primary" />
                Notificaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PushManager />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Consejos</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                <li>Elige un modelo y pulsa “Probar conexión”.</li>
                <li>Los cambios se guardan automáticamente.</li>
                <li>“Omniroute” permite enrutar tus modelos locales o remotos (puerto 20128).</li>
                <li>“Compatible con OpenAI” sirve para OpenRouter, Groq, DeepSeek, Ollama, Mistral, xAI…</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
