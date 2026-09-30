"use client";

import { Button } from "@/components/ui/button";
import { ModeBadge } from "@/components/ModeBadge";
import type { ExtractionMode } from "@/domain/types";
import { SESSION_PERSISTENCE_WARNING } from "@/state/session";

export interface AppChromeProps {
  postIntake?: boolean;
  mode?: ExtractionMode;
  sessionPersistenceWarning?: boolean;
  onRestart?: () => void;
  children?: React.ReactNode;
}

export function AppChrome({
  postIntake = false,
  mode = "recorded",
  sessionPersistenceWarning = false,
  onRestart,
  children,
}: AppChromeProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="topnav">
        <div className="page-wrap topnav-inner">
          <span className="logo">
            EvidenceReady
            {postIntake ? <span> · ARK-1500 kettle</span> : null}
          </span>
          <div className="flex items-center gap-[var(--gap-sm)]">
            {postIntake ? <ModeBadge mode={mode} /> : null}
            {postIntake && onRestart ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRestart}
              >
                Restart session
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {sessionPersistenceWarning ? (
        <div
          className="page-wrap py-[10px] text-[13px] text-[var(--st-unverified)]"
          role="status"
        >
          {SESSION_PERSISTENCE_WARNING}
        </div>
      ) : null}

      <main className="page-wrap flex flex-1 flex-col">{children}</main>

      <footer className="pagefoot">
        <div className="page-wrap flex flex-col gap-[var(--gap-sm)] sm:flex-row sm:items-center sm:justify-between">
          <span>EvidenceReady · evidence-intake prototype</span>
          <span className="meta">
            Readiness means the dossier can enter authoring — it is not a
            legal-compliance conclusion.
          </span>
        </div>
      </footer>
    </div>
  );
}
