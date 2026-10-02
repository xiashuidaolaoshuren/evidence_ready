"use client";

import { AppChrome } from "@/components/AppChrome";
import { useSession } from "@/state/SessionProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, handleRestart, sessionPersistenceWarning } = useSession();
  const postIntake = state.phase !== "intake";

  return (
    <AppChrome
      postIntake={postIntake}
      mode={state.mode}
      sessionPersistenceWarning={sessionPersistenceWarning}
      onRestart={postIntake ? handleRestart : undefined}
    >
      {children}
    </AppChrome>
  );
}
