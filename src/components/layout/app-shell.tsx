"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/lib/use-is-mobile";
import { BOTTOM_NAV_ROUTES } from "@/lib/navigation";
import { useSwipeNav } from "@/lib/use-swipe-nav";
import { usePullRefresh } from "@/lib/use-pull-refresh";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Loader2, RotateCw } from "lucide-react";
import { ProgressTree } from "@/components/layout/progress-tree";
import { XpToast } from "@/components/layout/xp-toast";
import { XpEngine } from "@/lib/xp-system";
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

/**
 * Bottom bar derivada de BOTTOM_NAV_ROUTES (la misma fuente que el swipe):
 * mantiene el orden estricto y garantiza que swipe y barra nunca se desincronicen.
 */
const bottomNavItems = BOTTOM_NAV_ROUTES.map(
  (href) => navItems.find((item) => item.href === href),
).filter((item): item is (typeof navItems)[number] => Boolean(item));

/** Física de la pill del elemento activo */
const pillSpring = { type: "spring", stiffness: 500, damping: 35, mass: 0.9 } as const;

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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
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

  // El swipe solo navega entre las pestañas de la Bottom Bar: en rutas fuera
  // de la lista (Pomodoro, Notas) no se adjunta el gesto horizontal.
  const isSwipeRoute = BOTTOM_NAV_ROUTES.some((r) => pathname.startsWith(r));
  const swipeEnabled = isMobile && isSwipeRoute;
  const swipeNav = useSwipeNav(
    (href) => router.push(href),
    pathname,
    swipeEnabled,
  );
  const { onTouchStart, onTouchMove, onTouchEnd, style, dragging, lastDirection } =
    swipeNav;

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const nav = (pillId: string) => (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-lg bg-sidebar-accent"
                transition={pillSpring}
              />
            )}
            <Icon className="relative z-10 h-4 w-4" />
            <span className="relative z-10">{label}</span>
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
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t bg-background/95 px-3 py-2 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
    >
      {bottomNavItems.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[10px] font-medium transition-all active:scale-95",
              active
                ? "text-primary"
                : "text-muted-foreground active:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="bottom-nav-pill"
                className="absolute inset-0 rounded-xl bg-primary/10"
                transition={pillSpring}
              />
            )}
            <Icon className="relative z-10 h-6 w-6" />
            <span className="relative z-10 truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  /* ── Transición de entrada de cada página ──────────────────────────── */
  const entranceInitial = reduceMotion
    ? false
    : lastDirection === 1
      ? { opacity: 0, x: "-10%" } // volvió → entra desde la izquierda
      : lastDirection === -1
        ? { opacity: 0, x: "10%" } // avanzó → entra desde la derecha
        : { opacity: 0, y: 14 }; // navegación normal → sube suavemente

  const entranceTransition = reduceMotion
    ? { duration: 0 }
    : {
        duration: 0.38,
        ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
      };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar de escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Brand />
        {nav("sidebar-pill")}
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
              {nav("sheet-pill")}
              <div className="mt-auto">{footer}</div>
            </SheetContent>
          </Sheet>
          <Brand />
          <div className="ml-auto">
            <ProgressTree />
          </div>
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
          className="flex-1 pb-20 lg:pb-0"
          {...(isMobile
            ? {
                onTouchStart: pullRefresh.onTouchStart,
                onTouchMove: pullRefresh.onTouchMove,
                onTouchEnd: pullRefresh.onTouchEnd,
              }
            : {})}
        >
          {/* Superficie de swipe: sigue al dedo (solo móvil y solo en rutas de la Bottom Bar) */}
          <motion.div
            style={swipeEnabled ? style : undefined}
            className={cn(
              "min-h-full",
              isMobile && "touch-pan-y overscroll-x-none",
              dragging && "cursor-grabbing select-none",
            )}
            {...(swipeEnabled ? { onTouchStart, onTouchMove, onTouchEnd } : {})}
          >
            {/* Cada página se remonta con su animación de entrada */}
            <motion.div
              key={pathname}
              initial={entranceInitial}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={entranceTransition}
              className="min-h-full"
            >
              {children}
            </motion.div>
          </motion.div>
        </main>
      </div>

      {bottomBar}
      <XpEngine />
      <XpToast />
    </div>
  );
}
