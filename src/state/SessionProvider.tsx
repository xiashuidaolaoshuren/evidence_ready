"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError, extractFixture, extractUpload, type ProgressEvent } from "@/api";
import type { ExtractionMode } from "@/domain/types";
import { progressFromEvent } from "@/extraction-progress";
import {
  appReducer,
  initialAppState,
  type AppAction,
  type AppState,
} from "@/state/app-state";
import { historyMove, routeForPhase } from "@/state/phase-routes";
import {
  clearSession,
  loadSession,
  saveSession,
  type StoredSession,
} from "@/state/session";

interface LastExtractRequest {
  mode: ExtractionMode;
  files?: File[];
}

export interface SessionContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  publicDemo: boolean;
  sessionNotice: string | null;
  sessionPersistenceWarning: boolean;
  handleRestart: () => void;
  handleRetryExtraction: () => void;
  handleUseRecorded: () => void;
  handleStartBundled: (mode: ExtractionMode) => void;
  handleStartUpload: (files: File[]) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function appStateFromStored(session: StoredSession): AppState {
  return {
    phase: session.phase,
    mode: session.mode,
    dossier: session.dossier,
    rejected: session.rejected,
    counts: session.counts,
    failedSources: session.failedSources,
    interview: session.interview,
    error: null,
    progress: null,
  };
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}

interface SessionProviderProps {
  publicDemo: boolean;
  initialState: AppState;
  sessionNotice: string | null;
  children: ReactNode;
}

function SessionProvider({
  publicDemo,
  initialState,
  sessionNotice,
  children,
}: SessionProviderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, dispatch] = useReducer(appReducer, initialState);
  const lastRequest = useRef<LastExtractRequest | null>(null);
  const extractionGeneration = useRef(0);
  const extractAbort = useRef<AbortController | null>(null);
  const skipPhasePush = useRef(true);
  const skipPathnameSync = useRef(true);
  const [sessionPersistenceWarning, setSessionPersistenceWarning] =
    useState(false);

  const abortInflightRequests = useCallback(() => {
    extractAbort.current?.abort();
    extractAbort.current = null;
  }, []);

  useEffect(() => abortInflightRequests, [abortInflightRequests]);

  useEffect(() => {
    if (skipPhasePush.current) {
      skipPhasePush.current = false;
      return;
    }
    const target = routeForPhase(state.phase);
    if (pathname !== target) {
      router.push(target);
    }
    // Push only when the user changes phase, not when the URL changes first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  useEffect(() => {
    if (skipPathnameSync.current) {
      skipPathnameSync.current = false;
      return;
    }
    const move = historyMove(state.phase, pathname);
    if (move.kind === "stay") {
      return;
    }
    if (move.kind === "dispatch") {
      dispatch(move.action);
      return;
    }
    router.replace(move.href);
  }, [pathname, state.phase, router]);

  const handleRestart = useCallback(() => {
    extractionGeneration.current += 1;
    abortInflightRequests();
    clearSession();
    dispatch({ type: "restart" });
  }, [abortInflightRequests]);

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
      abortInflightRequests();
      const controller = new AbortController();
      extractAbort.current = controller;
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
          ? await extractUpload(files, onEvent, controller.signal)
          : await extractFixture(mode, onEvent, controller.signal);

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
    [abortInflightRequests],
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

  const value: SessionContextValue = {
    state,
    dispatch,
    publicDemo,
    sessionNotice,
    sessionPersistenceWarning,
    handleRestart,
    handleRetryExtraction,
    handleUseRecorded,
    handleStartBundled,
    handleStartUpload,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

interface GateReady {
  status: "ready";
  initialState: AppState;
  sessionNotice: string | null;
}

interface GateRestoring {
  status: "restoring";
}

type GateState = GateRestoring | GateReady;

export interface SessionGateProps {
  publicDemo: boolean;
  children: ReactNode;
}

export function SessionGate({ publicDemo, children }: SessionGateProps) {
  const router = useRouter();
  const [gate, setGate] = useState<GateState>({ status: "restoring" });

  useEffect(() => {
    const { session, notice } = loadSession();
    const initialState = session ? appStateFromStored(session) : initialAppState;
    const targetRoute = routeForPhase(initialState.phase);
    router.replace(targetRoute);
    setGate({
      status: "ready",
      initialState,
      sessionNotice: notice,
    });
    // Restore runs once on mount; router identity is unstable in tests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gate.status === "restoring") {
    return <div data-testid="session-gate-restoring" />;
  }

  return (
    <SessionProvider
      publicDemo={publicDemo}
      initialState={gate.initialState}
      sessionNotice={gate.sessionNotice}
    >
      {children}
    </SessionProvider>
  );
}
