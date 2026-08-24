"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import { useSwipeNav } from "@/lib/use-swipe-nav";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, RotateCw } from "lucide-react";
import {
  Sparkles,
  LayoutDashboard,
  Calendar,
  GraduationCap,
  Timer,
  Dumbbell,
  Wallet,
  StickyNote,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import type { ReactNode } from "react";

const navItems = [
  { href: "/dashboard", label: "Hoy", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendario", icon: Calendar },
  { href: "/academic", label: "Estudios", icon: GraduationCap },
  { href: "/pomodoro", label: "Pomodoro", icon: Timer },
  { href: "/notes", label: "Notas", icon: StickyNote },
  { href: "/sport", label: "Deporte", icon: Dumbbell },
  { href: "/finance", label: "Finanzas", icon: Wallet },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="h-4 w-4" />
      </div>
      <span className="text-base font-semibold tracking-tight">Núcleo</span>
    </Link>
  );
}

const bottomNavItems = [
  { href: "/dashboard", label: "Hoy", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendario", icon: Calendar },
  { href: "/academic", label: "Estudios", icon: GraduationCap },
  { href: "/sport", label: "Deporte", icon: Dumbbell },
  { href: "/finance", label: "Finanzas", icon: Wallet },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, [configured]);

  const isMobile = useIsMobile();

  // Pull-to-refresh: recarga los datos del servidor
  const handleRefresh = useCallback(async () => {
    router.refresh();
    // Pequeña pausa para que se vea la animación
    await new Promise((r) => setTimeout(r, 600));
  }, [router]);

  const pullRefresh = usePullRefresh(handleRefresh, isMobile);
  const swipeNav = useSwipeNav((href) => router.push(href), pathname, isMobile);

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="border-t pt-4">
      {configured ? (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {email ? email[0].toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{email ?? "…"}</p>
            <p className="text-xs text-muted-foreground">Sesión iniciada</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleSignOut}
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">D</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium">Datos locales</p>
            <p className="text-xs text-muted-foreground">
              Guardados en este dispositivo
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            local
          </Badge>
        </div>
      )}
    </div>
  );

  /* ── Barra inferior móvil (bottom navigation) ──────────────────────── */
  const bottomBar = (
    <nav className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t bg-background/95 px-1 py-1 backdrop-blur-lg lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {bottomNavItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors min-w-0",
              active
                ? "text-primary"
                : "text-muted-foreground active:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar de escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Brand />
        {nav}
        <div className="mt-auto">{footer}</div>
      </aside>

      {/* Layout móvil con Sheet + bottom bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col gap-6 p-4">
              <Brand />
              {nav}
              <div className="mt-auto">{footer}</div>
            </SheetContent>
          </Sheet>
          <Brand />
        </header>

        {/* Pull-to-refresh indicator */}
        {(pullRefresh.pulling || pullRefresh.refreshing) && (
          <div
            className="flex items-center justify-center gap-2 overflow-hidden transition-all duration-200 lg:hidden"
            style={{ height: pullRefresh.refreshing ? 48 : pullRefresh.pullDistance }}
          >
            {pullRefresh.refreshing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Sincronizando…</span>
              </>
            ) : pullRefresh.pullDistance > 40 ? (
              <>
                <RotateCw className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Soltar para actualizar</span>
              </>
            ) : null}
          </div>
        )}

        {/* Padding inferior en móvil para que el contenido no quede tapado por la bottom bar */}
        <main
          className="flex-1 pb-16 lg:pb-0"
          {...(isMobile ? { ...pullRefresh, ...swipeNav } : {})}
        >
          {children}
        </main>
      </div>

      {bottomBar}
    </div>
  );
}
