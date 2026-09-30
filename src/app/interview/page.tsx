"use client";

import { InterviewWorkspace } from "@/screens/InterviewWorkspace";
import { useSession } from "@/state/SessionProvider";

export default function InterviewPage() {
  const { state, dispatch, publicDemo } = useSession();

  if (state.phase !== "interview") {
    return null;
  }

  return (
    <InterviewWorkspace
      publicDemo={publicDemo}
      dossier={state.dossier}
      interview={state.interview}
      onAnswer={(event) => dispatch({ type: "answer", event })}
      onLeaveUnresolved={(fieldKey) =>
        dispatch({ type: "leave-unresolved", fieldKey })
      }
      onContinuePastBudget={() => dispatch({ type: "continue-past-budget" })}
      onContinueSupporting={() => dispatch({ type: "continue-supporting" })}
      onFinish={() => dispatch({ type: "finish" })}
    />
  );
}
