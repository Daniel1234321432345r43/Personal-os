import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingNameDialog } from "@/components/layout/onboarding-name-dialog";
import { OnboardingGate } from "@/components/layout/onboarding-gate";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <OnboardingGate>
      <AppShell>
        {children}
        <OnboardingNameDialog />
      </AppShell>
    </OnboardingGate>
  );
}
