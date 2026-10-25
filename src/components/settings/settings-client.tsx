"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useSettings } from "@/components/providers/settings-provider";
import { useData } from "@/components/providers/data-provider";
import { PROVIDERS, getProvider } from "@/lib/ai/models";
import type { AiProviderId } from "@/lib/ai/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PushManager } from "@/components/settings/push-manager";
import { WorkoutScheduleCard } from "@/components/settings/workout-schedule-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fieldClass, inputClass, labelClass, selectClass } from "@/components/forms/ui";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  PlugZap,
  ShieldCheck,
  Bot,
  Bell,
  Timer,
  Dumbbell,
  Trash2,
  AlertTriangle,
  Leaf,
  RotateCcw,
  LogOut,
  UserX,
  MoonStar,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { isXpCapDisabled, setXpCapDisabled } from "@/lib/xp-cap";
import { resetTree } from "@/lib/xp-system";
import { SleepScheduleForm } from "@/components/forms/sleep-schedule-form";
import { DEFAULT_SLEEP_SETTINGS } from "@/lib/sleep";
import { AppleWalletCard } from "@/components/settings/apple-wallet-card";
import { cn } from "@/lib/utils";

type SettingsModule =
  | "account"
  | "ai"
  | "notifications"
  | "academic"
  | "sport"
  | "finance"
  | "health";

const MODULES: {
  id: SettingsModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "account", label: "Cuenta", icon: UserX },
  { id: "ai", label: "Inteligencia Artificial", icon: Bot },
  { id: "notifications", label: "Notificaciones", icon: Bell },
  { id: "academic", label: "Estudios", icon: Timer },
  { id: "sport", label: "Entrenos", icon: Dumbbell },
  { id: "finance", label: "Finanzas", icon: Wallet },
  { id: "health", label: "Salud", icon: MoonStar },
];

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
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 shrink-0 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export function SettingsClient() {
  const { settings, setSettings, configured, envConfigured, hydrated } = useSettings();
  const { data, actions } = useData();
  const sleepSettings = data.sleepSettings ?? DEFAULT_SLEEP_SETTINGS;

  const [activeTab, setActiveTab] = useState<SettingsModule>("account");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [xpCapDisabled, setXpCapDisabledState] = useState(() => isXpCapDisabled());
  const [resetResult, setResetResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmingTreeReset, setConfirmingTreeReset] = useState(false);

  const router = useRouter();
  const accountEnabled = isSupabaseConfigured();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tabParam = new URLSearchParams(window.location.search).get("tab") as SettingsModule;
    if (tabParam && MODULES.some((m) => m.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  const provider = getProvider(settings.provider);

  if (!hydrated) {
    return <LoadingState />;
  }

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

  function handleResetTree() {
    if (!confirmingTreeReset) {
      setConfirmingTreeReset(true);
      window.setTimeout(() => setConfirmingTreeReset(false), 6000);
      return;
    }
    setConfirmingTreeReset(false);
    resetTree();
  }

  async function handleResetAll() {
    if (!confirmingReset) {
      setConfirmingReset(true);
      setResetResult(null);
      window.setTimeout(() => setConfirmingReset(false), 6000);
      return;
    }
    setConfirmingReset(false);
    setResetting(true);
    setResetResult(null);
    try {
      const result = await actions.resetAll();
      setResetResult(
        result.ok
          ? {
              ok: true,
              message:
                "Todo restablecido. Se han borrado tus asignaturas, tareas, entrenamientos, hábitos, transacciones y calificaciones. La API key de la IA se ha conservado.",
            }
          : {
              ok: false,
              message:
                result.error ||
                "Se vació este navegador, pero hubo errores al borrar algunos datos en la nube. Vuelve a intentarlo.",
            },
      );
    } catch (e) {
      setResetResult({
        ok: false,
        message: e instanceof Error ? e.message : "No se pudo restablecer.",
      });
    } finally {
      setResetting(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  async function handleDeleteAccount() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      setDeleteResult(null);
      window.setTimeout(() => setConfirmingDelete(false), 6000);
      return;
    }
    setConfirmingDelete(false);
    setDeleting(true);
    setDeleteResult(null);
    try {
      await actions.resetAll();
      const res = await fetch("/api/account/delete", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setDeleteResult({
          ok: false,
          message:
            data?.error ||
            "Se borraron los datos, pero no se pudo eliminar la cuenta de usuario. Vuelve a intentarlo.",
        });
        return;
      }
      await createClient().auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (e) {
      setDeleteResult({
        ok: false,
        message: e instanceof Error ? e.message : "No se pudo borrar la cuenta.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona tu cuenta, IA, notificaciones y preferencias por módulos.
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

      {/* Selector de módulos: scroll horizontal suave en móvil, sin scroll kilométrico */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none sm:gap-2">
        {MODULES.map((m) => {
          const Icon = m.icon;
          const isActive = activeTab === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveTab(m.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all sm:text-sm",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenido enfocado por módulo */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* MÓDULO 1: CUENTA */}
          {activeTab === "account" && (
            <div className="space-y-6 max-w-4xl">
              {accountEnabled ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserX className="h-5 w-5 text-primary" />
                      Gestión de cuenta
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Opciones de sesión y seguridad para tu usuario de Núcleo.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg border bg-muted/20">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Cerrar sesión</p>
                        <p className="text-xs text-muted-foreground">
                          Sale de tu cuenta en este dispositivo de forma segura.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSignOut}
                        disabled={signingOut || deleting}
                        className="shrink-0"
                      >
                        {signingOut ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <LogOut className="h-4 w-4" />
                        )}
                        Cerrar sesión
                      </Button>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-destructive">
                            Borrar cuenta
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Elimina <strong>permanentemente</strong> tu cuenta y todos tus datos en la nube. Esta acción no se puede deshacer.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleDeleteAccount}
                          disabled={deleting || signingOut}
                          className="shrink-0"
                        >
                          {deleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserX className="h-4 w-4" />
                          )}
                          {confirmingDelete
                            ? "¿Seguro? Se borrará todo..."
                            : deleting
                            ? "Borrando..."
                            : "Borrar cuenta"}
                        </Button>
                      </div>
                      {deleteResult && (
                        <p
                          className={`mt-2 rounded-lg border p-3 text-sm ${
                            deleteResult.ok
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-destructive/30 bg-destructive/10 text-destructive"
                          }`}
                        >
                          {deleteResult.message}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-5 text-center text-sm text-muted-foreground">
                    Modo local / invitado: actualmente no hay sesión remota vinculada.
                  </CardContent>
                </Card>
              )}

              {/* Zona de peligro */}
              <Card className="border-destructive/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Zona de peligro
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Restablece la app de fábrica: borra <strong>todas</strong> tus asignaturas, tareas, entrenamientos, hábitos, transacciones y calificaciones — tanto de este navegador como de tu cuenta en la nube. Se conserva la <strong>API key de la IA</strong>.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleResetAll}
                    disabled={resetting}
                  >
                    {resetting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    {confirmingReset
                      ? "¿Seguro? Se borrará todo…"
                      : resetting
                      ? "Restableciendo…"
                      : "Restablecer de fábrica"}
                  </Button>
                  {resetResult && (
                    <p
                      className={`rounded-lg border p-3 text-sm ${
                        resetResult.ok
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                      }`}
                    >
                      {resetResult.message}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* MÓDULO 2: INTELIGENCIA ARTIFICIAL */}
          {activeTab === "ai" && (
            <div className="grid gap-6 lg:grid-cols-3 max-w-5xl">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    Personalización del Secretario IA
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Configura el proveedor, el modelo y el comportamiento de tu asistente.
                  </p>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className={fieldClass}>
                    <label className={`${labelClass} flex items-center gap-1.5`} htmlFor="ai-assistant-name">
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
                      Nombre con el que se identificará tu asistente en el chat y los saludos.
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

                  <div className="flex items-center gap-2 pt-1">
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
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Seguridad y Privacidad
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-2">
                    <p>
                      Tu API key se guarda <strong>solo en este navegador</strong> (localStorage) y se envía únicamente a tu propio servidor para hablar con el proveedor.
                    </p>
                    <p>
                      Ningún tercero tiene acceso a tus tokens ni conversaciones.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* MÓDULO 3: NOTIFICACIONES */}
          {activeTab === "notifications" && (
            <div className="space-y-6 max-w-4xl">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Notificaciones Push
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Activa los avisos en tu móvil para recibir recordatorios en tiempo real.
                  </p>
                </CardHeader>
                <CardContent>
                  <PushManager />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Avisos automáticos de Núcleo</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p>• <strong>Estudio (15:00)</strong>: Recordatorio diario de exámenes y entregas próximas.</p>
                  <p>• <strong>Entrenamientos</strong>: Pregunta al terminar el entreno programado si has asistido.</p>
                  <p>• <strong>Sueño (07:15)</strong>: Pregunta cuánto has dormido para registrar la noche en un toque.</p>
                  <p>• <strong>Hora de dormir</strong>: Aviso push 15 min antes de tu hora objetivo de descanso.</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* MÓDULO 4: ESTUDIOS / POMODORO */}
          {activeTab === "academic" && (
            <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Timer className="h-5 w-5 text-primary" />
                    Tiempos de Pomodoro
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Personaliza los intervalos de concentración y descanso.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                  <div className={fieldClass}>
                    <label className={labelClass} htmlFor="pomodoro-work">
                      Trabajo / Estudio (minutos)
                    </label>
                    <input
                      id="pomodoro-work"
                      type="number"
                      min={1}
                      max={120}
                      inputMode="numeric"
                      value={settings.pomodoroWorkMinutes ?? 25}
                      onChange={(e) =>
                        update({ pomodoroWorkMinutes: Number(e.target.value) || 25 })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className={fieldClass}>
                    <label className={labelClass} htmlFor="pomodoro-break">
                      Descanso (minutos)
                    </label>
                    <input
                      id="pomodoro-break"
                      type="number"
                      min={1}
                      max={60}
                      inputMode="numeric"
                      value={settings.pomodoroBreakMinutes ?? 5}
                      onChange={(e) =>
                        update({ pomodoroBreakMinutes: Number(e.target.value) || 5 })
                      }
                      className={inputClass}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-emerald-600" />
                    Bosque de progreso
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    El bosque limita el XP diario a 120. Con el límite desactivado, el árbol crece sin tope.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  <Button
                    type="button"
                    variant={xpCapDisabled ? "outline" : "default"}
                    className={xpCapDisabled ? "w-full" : "w-full bg-emerald-600 hover:bg-emerald-700"}
                    onClick={() => {
                      const next = !xpCapDisabled;
                      setXpCapDisabledState(next);
                      setXpCapDisabled(next);
                    }}
                  >
                    {xpCapDisabled ? "Restaurar límite diario (120 XP)" : "Quitar límite diario de XP"}
                  </Button>
                  {xpCapDisabled && (
                    <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                      Límite desactivado: el XP del bosque ya no se corta a 120 por día.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleResetTree}
                  >
                    <RotateCcw className="h-4 w-4" />
                    {confirmingTreeReset
                      ? "¿Seguro? Se pierde todo el XP…"
                      : "Reiniciar progreso del árbol"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Borra todo el XP, el nivel y las penalizaciones del árbol en este dispositivo.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* MÓDULO 5: ENTRENAMIENTOS */}
          {activeTab === "sport" && (
            <div className="max-w-4xl space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Dumbbell className="h-5 w-5 text-primary" />
                    Plan semanal de entrenamientos
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Dinos qué días entrenas. Al terminar la sesión te preguntaremos si has ido para apuntarlo en un toque.
                  </p>
                </CardHeader>
                <CardContent>
                  <WorkoutScheduleCard />
                </CardContent>
              </Card>
            </div>
          )}

          {/* MÓDULO 6: FINANZAS */}
          {activeTab === "finance" && (
            <div className="max-w-4xl space-y-4">
              <AppleWalletCard />
            </div>
          )}

          {/* MÓDULO 7: SALUD / SUEÑO */}
          {activeTab === "health" && (
            <div className="max-w-4xl space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MoonStar className="h-5 w-5 text-violet-500" />
                    Mi objetivo de sueño
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {sleepSettings.bedtime} → {sleepSettings.wake_time} · objetivo {sleepSettings.target_hours} h
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-1">
                  <SleepScheduleForm
                    key={`${sleepSettings.bedtime}-${sleepSettings.wake_time}-${sleepSettings.target_hours}-${sleepSettings.reminder_enabled}`}
                    initial={sleepSettings}
                    onSave={(input) => actions.setSleepSettings(input)}
                  />
                  <p className="text-xs text-muted-foreground border-t pt-3">
                    El horario objetivo se usa para calcular el cumplimiento de cada noche y para programar el aviso push 15 min antes de acostarte. Los registros y gráficas están en{" "}
                    <Link href="/sueno" className="font-medium underline text-primary">
                      Sueño
                    </Link>
                    .
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
