"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { markOnboardingComplete } from "@/lib/onboarding";
import { FullScreenLoader } from "@/components/ui/full-screen-loader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sparkles,
  GraduationCap,
  Dumbbell,
  Wallet,
  Clock,
  AlertTriangle,
} from "lucide-react";

const features = [
  { icon: Sparkles, label: "Secretario IA", desc: "Asistente inteligente" },
  { icon: GraduationCap, label: "Estudios", desc: "Classroom + entregas" },
  { icon: Dumbbell, label: "Deporte", desc: "Rutinas y hábitos" },
  { icon: Wallet, label: "Finanzas", desc: "Balance mensual" },
];

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [next, setNext] = useState("/dashboard");
  const configured = isSupabaseConfigured();
  // Mientras se verifica si ya hay sesión, mostramos un loader para evitar
  // el "flashazo" (mostrar el formulario un instante y saltar a /dashboard).
  const [checkingSession, setCheckingSession] = useState(configured);

  // Leer a dónde volver tras iniciar sesión (p. ej. /academic?classroom=login
  // cuando vienes del flujo de conectar Google Classroom).
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("next");
    if (n && n.startsWith("/")) setNext(n);
  }, []);

  // Si ya hay una sesión iniciada, no volver a mostrar el login.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) {
          if (data.session) {
            markOnboardingComplete();
            router.replace(next);
          } else {
            setCheckingSession(false);
          }
        }
      })
      .catch(() => {
        // Si la verificación de sesión falla (red, Supabase caído...),
        // mostrar el login en lugar de quedarnos en la pantalla de carga.
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, router, next]);

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    markOnboardingComplete();
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  function handleSkip() {
    markOnboardingComplete();
    router.push(next);
  }

  if (checkingSession) return <FullScreenLoader />;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      {/* Fondo decorativo */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.08),transparent_70%)]"
      />

      <div className="grid w-full max-w-4xl items-center gap-10 lg:grid-cols-2">
        {/* Columna de branding */}
        <div className="hidden lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Núcleo</p>
              <p className="text-sm text-muted-foreground">
                Tu sistema operativo personal
              </p>
            </div>
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Todo tu día,{" "}
            <span className="text-primary">organizado por tu Secretario IA.</span>
          </h1>
          <ul className="mt-8 space-y-4">
            {features.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Tarjeta de login */}
        <Card className="w-full">
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground lg:hidden">
              <Sparkles className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">Inicia sesión</CardTitle>
            <CardDescription>
              Conéctate con tu cuenta de Google para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!configured && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-amber-800 dark:text-amber-200">
                  Supabase no está configurado. Tus datos se guardan{" "}
                  <span className="font-medium">localmente en este dispositivo</span>;
                  añade tus claves en{" "}
                  <code className="font-mono text-xs">.env.local</code> para
                  sincronizarlos en la nube.
                </p>
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleGoogle}
              disabled={loading || !configured}
            >
              {loading ? (
                "Conectando…"
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
                    />
                  </svg>
                  Continuar con Google
                </>
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  o
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={handleSkip}
            >
              <Clock className="mr-2 h-4 w-4" />
              Hacer más tarde
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
