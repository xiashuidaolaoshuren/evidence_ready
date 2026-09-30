"use client";

import { ExtractionProgress } from "@/screens/ExtractionProgress";
import { useSession } from "@/state/SessionProvider";

export default function ExtractPage() {
  const {
    state,
    dispatch,
    handleRetryExtraction,
    handleUseRecorded,
    handleRestart,
  } = useSession();

  if (state.phase !== "extracting" && state.phase !== "extracted") {
    return null;
  }

  return (
    <ExtractionProgress
      mode={state.mode}
      outcome={
        state.phase === "extracted"
          ? "succeeded"
          : state.error
            ? "failed"
            : "working"
      }
      error={state.error}
      counts={state.counts}
      failedSources={state.failedSources}
      dossier={state.dossier}
      progress={state.progress}
      onRetry={handleRetryExtraction}
      onUseRecorded={handleUseRecorded}
      onBackToIntake={handleRestart}
      onOpenInterview={() => dispatch({ type: "open-interview" })}
    />
  );
}
