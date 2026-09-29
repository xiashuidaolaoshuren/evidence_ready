import { applyEvent, type ApplyEvent } from "./domain/apply";
import { nextQuestion, SOFT_CAP } from "./domain/planner";
import type {
  DossierField,
  ExtractionMode,
  InterviewPhase,
  InterviewState,
  RejectedCandidate,
} from "./domain/types";

export type AppPhase = InterviewPhase | "extracted";

export interface FailedSource {
  id: string;
  filename: string;
  code: string;
  message: string;
}

export interface ExtractionCounts {
  extracted: number;
  rejected: number;
  conflicts: number;
  missing: number;
}

export interface AppState {
  phase: AppPhase;
  mode: ExtractionMode;
  dossier: DossierField[];
  rejected: RejectedCandidate[];
  counts: ExtractionCounts | null;
  failedSources: FailedSource[] | undefined;
  interview: InterviewState;
  error: { code: string; message: string; envVar?: string } | null;
  progress: {
    currentStage: number;
    stageStatus: "started" | "done" | null;
  } | null;
}

export type AppAction =
  | { type: "start-extract"; mode: ExtractionMode }
  | {
      type: "extract-progress";
      currentStage: number;
      stageStatus: "started" | "done";
    }
  | { type: "extract-success"; coverage: "interview" | "insufficient"; dossier: DossierField[]; rejected: RejectedCandidate[]; counts: ExtractionCounts; failedSources?: FailedSource[]; mode: ExtractionMode }
  | { type: "extract-failure"; error: { code: string; message: string; envVar?: string } }
  | { type: "open-interview" }
  | { type: "continue-anyway" }
  | { type: "answer"; event: ApplyEvent }
  | { type: "leave-unresolved"; fieldKey: string }
  | { type: "continue-past-budget" }
  | { type: "continue-supporting" }
  | { type: "finish" }
  | { type: "restart" };

export const initialInterviewState: InterviewState = {
  phase: "intake",
  currentQuestionFieldKey: null,
  askedFieldKeys: [],
  answeredFieldKeys: [],
  declaredUnavailableFieldKeys: [],
  questionCount: 0,
  continuePastBudget: false,
  completionReason: null,
};

export const initialAppState: AppState = {
  phase: "intake",
  mode: "recorded",
  dossier: [],
  rejected: [],
  counts: null,
  failedSources: undefined,
  interview: initialInterviewState,
  error: null,
  progress: null,
};

function unresolvedEssentials(dossier: DossierField[]): DossierField[] {
  return dossier.filter(
    (field) =>
      field.tier === "essential" &&
      (field.status === "conflicting" ||
        field.status === "missing" ||
        field.status === "unverified"),
  );
}

function unresolvedSupporting(dossier: DossierField[]): DossierField[] {
  return dossier.filter(
    (field) =>
      field.tier === "supporting" &&
      (field.status === "conflicting" ||
        field.status === "missing" ||
        field.status === "unverified"),
  );
}

function advanceInterview(
  state: AppState,
  dossier: DossierField[],
  interview: InterviewState,
): AppState {
  const essentialsRemaining = unresolvedEssentials(dossier);
  const supportingRemaining = unresolvedSupporting(dossier);

  if (
    interview.questionCount >= SOFT_CAP &&
    !interview.continuePastBudget &&
    !interview.pausedForBudget
  ) {
    const pendingQuestion = nextQuestion(dossier, {
      ...interview,
      pausedForBudget: false,
    });
    if (pendingQuestion) {
      return {
        ...state,
        phase: "interview",
        dossier,
        interview: {
          ...interview,
          phase: "interview",
          pausedForBudget: true,
          currentQuestionFieldKey: null,
        },
      };
    }
  }

  const question = nextQuestion(dossier, interview);
  if (!question) {
    if (essentialsRemaining.length === 0 && supportingRemaining.length > 0) {
      return {
        ...state,
        phase: "interview",
        dossier,
        interview: {
          ...interview,
          phase: "interview",
          essentialsClear: true,
          currentQuestionFieldKey: null,
          pausedForBudget: false,
        },
      };
    }

    return {
      ...state,
      phase: "report",
      dossier,
      interview: {
        ...interview,
        phase: "report",
        currentQuestionFieldKey: null,
        completionReason: "resolved",
        pausedForBudget: false,
      },
    };
  }

  return {
    ...state,
    phase: "interview",
    dossier,
    interview: {
      ...interview,
      phase: "interview",
      currentQuestionFieldKey: question.fieldKey,
      pausedForBudget: false,
    },
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  if (action.type === "start-extract") {
    return {
      ...state,
      phase: "extracting",
      mode: action.mode,
      error: null,
      progress: null,
    };
  }

  if (action.type === "extract-progress") {
    return {
      ...state,
      progress: {
        currentStage: action.currentStage,
        stageStatus: action.stageStatus,
      },
    };
  }

  if (action.type === "extract-success") {
    const interview: InterviewState = {
      ...state.interview,
      phase: action.coverage,
      currentQuestionFieldKey: null,
      askedFieldKeys: [],
      answeredFieldKeys: [],
      declaredUnavailableFieldKeys: [],
      questionCount: 0,
      continuePastBudget: false,
      completionReason: null,
    };
    return {
      ...state,
      phase: action.coverage === "interview" ? "extracted" : action.coverage,
      mode: action.mode,
      dossier: action.dossier,
      rejected: action.rejected,
      counts: action.counts,
      failedSources: action.failedSources,
      interview,
      error: null,
      progress: null,
    };
  }

  if (action.type === "extract-failure") {
    return {
      ...state,
      error: action.error,
    };
  }

  if (action.type === "open-interview") {
    const interview: InterviewState = {
      ...state.interview,
      phase: "interview",
    };
    const question = nextQuestion(state.dossier, interview);
    return {
      ...state,
      phase: "interview",
      interview: {
        ...interview,
        currentQuestionFieldKey: question?.fieldKey ?? null,
      },
    };
  }

  if (action.type === "continue-anyway") {
    const interview: InterviewState = {
      ...state.interview,
      phase: "interview",
    };
    const question = nextQuestion(state.dossier, interview);
    return {
      ...state,
      phase: "interview",
      interview: {
        ...interview,
        currentQuestionFieldKey: question?.fieldKey ?? null,
      },
    };
  }

  if (action.type === "finish") {
    return {
      ...state,
      phase: "report",
      interview: {
        ...state.interview,
        phase: "report",
        completionReason: state.interview.completionReason ?? "user-finished",
      },
    };
  }

  if (action.type === "restart") {
    return initialAppState;
  }

  if (action.type === "answer") {
    const { dossier } = applyEvent(state.dossier, action.event);
    const fieldKey = "fieldKey" in action.event ? action.event.fieldKey : null;
    const askedFieldKeys =
      fieldKey && !state.interview.askedFieldKeys.includes(fieldKey)
        ? [...state.interview.askedFieldKeys, fieldKey]
        : state.interview.askedFieldKeys;
    const answeredFieldKeys =
      fieldKey && action.event.type !== "declare-unavailable"
        ? [...state.interview.answeredFieldKeys, fieldKey]
        : state.interview.answeredFieldKeys;
    const declaredUnavailableFieldKeys =
      action.event.type === "declare-unavailable" && fieldKey
        ? [...state.interview.declaredUnavailableFieldKeys, fieldKey]
        : state.interview.declaredUnavailableFieldKeys;

    const interview: InterviewState = {
      ...state.interview,
      askedFieldKeys,
      answeredFieldKeys,
      declaredUnavailableFieldKeys,
      questionCount: state.interview.questionCount + 1,
    };

    return advanceInterview(state, dossier, interview);
  }

  if (action.type === "leave-unresolved") {
    const exhaustedFieldKeys = state.interview.exhaustedFieldKeys ?? [];
    const askedFieldKeys = state.interview.askedFieldKeys.includes(
      action.fieldKey,
    )
      ? state.interview.askedFieldKeys
      : [...state.interview.askedFieldKeys, action.fieldKey];

    const interview: InterviewState = {
      ...state.interview,
      askedFieldKeys,
      exhaustedFieldKeys: exhaustedFieldKeys.includes(action.fieldKey)
        ? exhaustedFieldKeys
        : [...exhaustedFieldKeys, action.fieldKey],
      questionCount: state.interview.questionCount + 1,
    };

    return advanceInterview(state, state.dossier, interview);
  }

  if (action.type === "continue-past-budget") {
    const interview: InterviewState = {
      ...state.interview,
      continuePastBudget: true,
      pausedForBudget: false,
    };
    const question = nextQuestion(state.dossier, interview);
    return {
      ...state,
      phase: "interview",
      interview: {
        ...interview,
        currentQuestionFieldKey: question?.fieldKey ?? null,
      },
    };
  }

  if (action.type === "continue-supporting") {
    const interview: InterviewState = {
      ...state.interview,
      continueSupporting: true,
      essentialsClear: true,
    };
    const question = nextQuestion(state.dossier, interview);
    return {
      ...state,
      phase: "interview",
      interview: {
        ...interview,
        currentQuestionFieldKey: question?.fieldKey ?? null,
      },
    };
  }

  return state;
}
