"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateLong } from "@/lib/format";
import { useData } from "@/components/providers/data-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { StatCards } from "./stat-cards";
import { SecretaryChat } from "./secretary-chat";
import { UpcomingTasks } from "./upcoming-tasks";
import { TodayRoutines } from "./today-routines";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function LoadingState() {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[340px] lg:col-span-2" />
        <Skeleton className="h-[340px]" />
      </div>
    </div>
  );
}

export function DashboardClient() {
  const { data, hydrated } = useData();
  const { settings } = useSettings();

  if (!hydrated) return <LoadingState />;

  const userName = settings.userName?.trim();

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header>
        <p className="text-sm text-muted-foreground">
          {formatDateLong(new Date().toISOString())}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting()}
          {userName && <span className="text-primary">, {userName}</span>}
        </h1>
      </header>

      <StatCards data={data} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Secretario IA (chat) — una sola tarjeta limpia, sin cajas anidadas */}
        <SecretaryChat />

        {/* Columna derecha */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-4">
              <TodayRoutines />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <UpcomingTasks data={data} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
