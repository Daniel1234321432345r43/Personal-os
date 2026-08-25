import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingNameDialog } from "@/components/layout/onboarding-name-dialog";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      {children}
      <OnboardingNameDialog />
    </AppShell>
  );
}
