import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ModeBadge } from "@/components/ModeBadge";
import {
  appReducer,
  initialAppState,
} from "@/app-state";
import { ApiError, extractFixture, extractUpload, type ProgressEvent } from "@/api";
import type { ExtractionMode } from "@/domain/types";
import { progressFromEvent } from "@/extraction-progress";
import { ExtractionProgress } from "@/screens/ExtractionProgress";
import { InsufficientEvidence } from "@/screens/InsufficientEvidence";
import { InterviewWorkspace } from "@/screens/InterviewWorkspace";
import { Intake } from "@/screens/Intake";
import { ReadinessReport } from "@/screens/ReadinessReport";
import {
  clearSession,
  saveSession,
  SESSION_PERSISTENCE_WARNING,
} from "@/session";

interface LastExtractRequest {
  mode: ExtractionMode;
  files?: File[];
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, () => initialAppState);
  const lastRequest = useRef<LastExtractRequest | null>(null);
  const extractionGeneration = useRef(0);
  const [sessionPersistenceWarning, setSessionPersistenceWarning] = useState(false);
  const postIntake = state.phase !== "intake";

  const handleRestart = useCallback(() => {
    extractionGeneration.current += 1;
    dispatch({ type: "restart" });
  }, []);

  useEffect(() => {
    clearSession();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase === "intake") {
      clearSession();
      return;
    }

    const result = saveSession({
      phase: state.phase,
      dossier: state.dossier,
      rejected: state.rejected,
      mode: state.mode,
      counts: state.counts,
      failedSources: state.failedSources,
      interview: state.interview,
      excerpts: state.dossier.flatMap((field) => field.evidence),
    });
    if (result.warned) {
      setSessionPersistenceWarning(true);
    }
  }, [state]);

  const startExtraction = useCallback(
    async (mode: ExtractionMode, files?: File[]) => {
      const generation = ++extractionGeneration.current;
      lastRequest.current = { mode, files };
      dispatch({ type: "start-extract", mode });

      const onEvent = (event: ProgressEvent) => {
        if (generation !== extractionGeneration.current) {
          return;
        }
        if (event.type !== "stage") {
          return;
        }
        const progress = progressFromEvent(event);
        if (!progress) {
          return;
        }
        dispatch({
          type: "extract-progress",
          currentStage: progress.currentStage,
          stageStatus: progress.stageStatus,
        });
      };

      try {
        const result = files
          ? await extractUpload(files, onEvent)
          : await extractFixture(mode, onEvent);

        if (generation !== extractionGeneration.current) {
          return;
        }

        dispatch({
          type: "extract-success",
          coverage: result.coverage,
          dossier: result.dossier,
          rejected: result.rejected,
          counts: result.counts,
          failedSources: result.failedSources,
          mode: result.mode,
        });
      } catch (error) {
        if (generation !== extractionGeneration.current) {
          return;
        }

        const apiError =
          error instanceof ApiError
            ? error
            : new ApiError("network", "Network request failed.");
        dispatch({
          type: "extract-failure",
          error: {
            code: apiError.code,
            message: apiError.message,
            envVar: apiError.envVar,
          },
        });
      }
    },
    [],
  );

  const handleRetryExtraction = useCallback(() => {
    const request = lastRequest.current;
    if (!request) {
      return;
    }
    void startExtraction(request.mode, request.files);
  }, [startExtraction]);

  const handleUseRecorded = useCallback(() => {
    void startExtraction("recorded");
  }, [startExtraction]);

  const handleStartBundled = useCallback(
    (mode: ExtractionMode) => {
      void startExtraction(mode);
    },
    [startExtraction],
  );

  const handleStartUpload = useCallback(
    (files: File[]) => {
      void startExtraction("live", files);
    },
    [startExtraction],
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="topnav">
        <div className="page-wrap topnav-inner">
          <span className="logo">
            EvidenceReady
            {postIntake ? <span> · ARK-1500 kettle</span> : null}
          </span>
          <div className="flex items-center gap-[var(--gap-sm)]">
            {postIntake ? <ModeBadge mode={state.mode} /> : null}
            {postIntake ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRestart}
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

      <main className="page-wrap flex flex-1 flex-col">
        {state.phase === "intake" ? (
          <Intake
            onStartBundled={handleStartBundled}
            onStartUpload={handleStartUpload}
          />
        ) : null}

        {state.phase === "extracting" || state.phase === "extracted" ? (
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
        ) : null}

        {state.phase === "insufficient" ? (
          <InsufficientEvidence
            dossier={state.dossier}
            failedSources={state.failedSources}
            onAddDocument={handleRestart}
            onContinueAnyway={() => dispatch({ type: "continue-anyway" })}
          />
        ) : null}

        {state.phase === "interview" ? (
          <InterviewWorkspace
            dossier={state.dossier}
            interview={state.interview}
            onAnswer={(event) => dispatch({ type: "answer", event })}
            onLeaveUnresolved={(fieldKey) =>
              dispatch({ type: "leave-unresolved", fieldKey })
            }
            onContinuePastBudget={() =>
              dispatch({ type: "continue-past-budget" })
            }
            onContinueSupporting={() =>
              dispatch({ type: "continue-supporting" })
            }
            onFinish={() => dispatch({ type: "finish" })}
          />
        ) : null}

        {state.phase === "report" ? (
          <ReadinessReport
            dossier={state.dossier}
            mode={state.mode}
            onBackToInterview={() => dispatch({ type: "open-interview" })}
            onRestart={handleRestart}
          />
        ) : null}
      </main>

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
