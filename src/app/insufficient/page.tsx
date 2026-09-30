"use client";

import { InsufficientEvidence } from "@/screens/InsufficientEvidence";
import { useSession } from "@/state/SessionProvider";

export default function InsufficientPage() {
  const { state, dispatch, handleRestart } = useSession();

  if (state.phase !== "insufficient") {
    return null;
  }

  return (
    <InsufficientEvidence
      dossier={state.dossier}
      failedSources={state.failedSources}
      onAddDocument={handleRestart}
      onContinueAnyway={() => dispatch({ type: "continue-anyway" })}
    />
  );
}
