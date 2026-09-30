"use client";

import { ReadinessReport } from "@/screens/ReadinessReport";
import { useSession } from "@/state/SessionProvider";

export default function ReportPage() {
  const { state, dispatch, handleRestart } = useSession();

  if (state.phase !== "report") {
    return null;
  }

  return (
    <ReadinessReport
      dossier={state.dossier}
      mode={state.mode}
      onBackToInterview={() => dispatch({ type: "open-interview" })}
      onRestart={handleRestart}
    />
  );
}
