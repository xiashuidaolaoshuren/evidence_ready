import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, interpretAnswer } from "@/api";
import { Button } from "@/components/ui/button";
import type { ApplyEvent } from "@/domain/apply";
import { needsInterpretation, parseAnswer } from "@/domain/apply";
import { nextQuestion } from "@/domain/planner";
import type { DossierField, Evidence, Proposal } from "@/domain/types";
import type { InterviewState } from "@/domain/types";
import { BudgetPause } from "./BudgetPause";
import { DossierPanel } from "./DossierPanel";
import { ProposalConfirmation } from "./ProposalConfirmation";
import { QuestionPanel } from "./QuestionPanel";
import { SourceDrawer } from "./SourceDrawer";

export const INTERVIEW_REFRESH_NOTE =
  "Refresh keeps applied dossier changes and interview progress, and does not keep an unfinished answer or an unaccepted proposal.";

export const PUBLIC_DEMO_ONE_FIELD_GUIDANCE =
  "This demo takes one field at a time. Enter only this field's value — answer interpretation is not available here.";

export interface InterviewWorkspaceProps {
  dossier: DossierField[];
  interview: InterviewState;
  publicDemo?: boolean;
  onAnswer: (event: ApplyEvent) => void;
  onLeaveUnresolved: (fieldKey: string) => void;
  onContinuePastBudget: () => void;
  onContinueSupporting: () => void;
  onFinish: () => void;
}

interface DrawerState {
  kind: string;
  title: string;
  meta: string;
  passage: string;
  quote: string;
  note: string;
}

const EMPTY_DRAWER: DrawerState = {
  kind: "Evidence",
  title: "",
  meta: "",
  passage: "",
  quote: "",
  note: "",
};

function unresolvedEssentialCount(dossier: DossierField[]): number {
  return dossier.filter(
    (field) =>
      field.tier === "essential" &&
      (field.status === "conflicting" ||
        field.status === "missing" ||
        field.status === "unverified"),
  ).length;
}

function dossierCounts(dossier: DossierField[]): string {
  const confirmed = dossier.filter((field) => field.status === "confirmed").length;
  const unresolved = dossier.filter(
    (field) =>
      field.status === "conflicting" ||
      field.status === "missing" ||
      field.status === "unverified",
  ).length;
  return `${confirmed} confirmed · ${unresolved} unresolved`;
}

export function InterviewWorkspace({
  dossier,
  interview,
  publicDemo = false,
  onAnswer,
  onLeaveUnresolved,
  onContinuePastBudget,
  onContinueSupporting,
  onFinish,
}: InterviewWorkspaceProps) {
  const [drawer, setDrawer] = useState<DrawerState>(EMPTY_DRAWER);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingProposals, setPendingProposals] = useState<Proposal[] | null>(
    null,
  );
  const [interpretError, setInterpretError] = useState<string | null>(null);
  const [demoGuidance, setDemoGuidance] = useState<string | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [flashEpoch, setFlashEpoch] = useState(0);
  const interpretAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      interpretAbort.current?.abort();
      interpretAbort.current = null;
    };
  }, []);

  const question = useMemo(
    () => nextQuestion(dossier, interview),
    [dossier, interview],
  );

  const currentField = question
    ? dossier.find((field) => field.key === question.fieldKey)
    : undefined;

  const showBudgetPause =
    interview.pausedForBudget === true && !interview.continuePastBudget;
  const showEssentialsClear =
    interview.essentialsClear === true && !question && !showBudgetPause;

  function openEvidence(evidence: Evidence, label: string) {
    setDrawer({
      kind: "Evidence",
      title: label,
      meta: `${evidence.documentId} · page ${evidence.page}`,
      passage: evidence.surroundingWindow || evidence.quote,
      quote: evidence.quote,
      note: "Captured passage from the same page. Raw uploads are discarded after processing — this excerpt is what traceability survives a refresh on.",
    });
    setDrawerOpen(true);
  }

  function openRejected(fieldKey: string, rejectedIndex = 0) {
    const field = dossier.find((entry) => entry.key === fieldKey);
    const rejected = field?.rejectedCandidates[rejectedIndex];
    if (!field || !rejected) return;

    setDrawer({
      kind: "Rejected candidate",
      title: field.label,
      meta: `${rejected.citation.documentId} · cited page ${rejected.citation.page}`,
      passage: rejected.citation.quote,
      quote: rejected.citation.quote,
      note: `Rejected: ${rejected.rejectionReason} A rejected candidate is retained and visible, but it can never support a value.`,
    });
    setDrawerOpen(true);
  }

  function handleAnswer(event: ApplyEvent) {
    if ("fieldKey" in event) {
      setFlashKey(event.fieldKey);
      setFlashEpoch((epoch) => epoch + 1);
    } else {
      setFlashKey(null);
    }
    onAnswer(event);
  }

  async function handleMissingSubmit(
    fieldKey: string,
    answerText: string,
    sourceDescription?: string,
  ) {
    setInterpretError(null);
    setDemoGuidance(null);
    const parsed = parseAnswer(fieldKey, answerText);
    if (parsed.type !== "provide-answer") {
      handleAnswer(parsed);
      return;
    }
    if (publicDemo && needsInterpretation(fieldKey, answerText)) {
      setDemoGuidance(PUBLIC_DEMO_ONE_FIELD_GUIDANCE);
      return;
    }
    if (!needsInterpretation(fieldKey, answerText)) {
      handleAnswer({
        type: "provide-answer",
        fieldKey,
        value: parsed.value,
        sourceDescription,
      });
      return;
    }

    interpretAbort.current?.abort();
    const controller = new AbortController();
    interpretAbort.current = controller;

    try {
      const { proposals } = await interpretAnswer(
        fieldKey,
        answerText.trim(),
        dossier,
        controller.signal,
      );
      if (proposals.length === 0) {
        setInterpretError("Could not interpret the answer. Please rephrase.");
        return;
      }
      setPendingProposals(proposals);
    } catch (error) {
      if (error instanceof ApiError && error.code === "rephrase") {
        setInterpretError(error.message);
        return;
      }
      setInterpretError("Could not interpret the answer. Please rephrase.");
    }
  }

  return (
    <section className="screen-pad screen-enter">
      <div className="mx-auto max-w-[var(--container)]">
        <div className="row-between flex-wrap">
          <div>
            <p className="eyebrow mb-[6px]">Evidence interview</p>
            <h2 className="text-[clamp(24px,2.6vw,32px)]">
              Resolve what the documents can&apos;t.
            </h2>
            <p className="note mt-[8px]">{INTERVIEW_REFRESH_NOTE}</p>
          </div>
          <div className="row">
            <span className="meta">
              {interview.questionCount} answered ·{" "}
              {unresolvedEssentialCount(dossier)} essential unresolved
            </span>
            <Button type="button" variant="secondary" size="sm" onClick={onFinish}>
              Finish and view report
            </Button>
          </div>
        </div>

        <div className="split mt-[var(--gap-lg)]">
          <div>
            {question && currentField ? (
              <QuestionPanel
                key={question.fieldKey}
                question={question}
                field={currentField}
                dossier={dossier}
                questionNumber={interview.questionCount + 1}
                onAnswer={handleAnswer}
                onLeaveUnresolved={onLeaveUnresolved}
                onOpenSource={openEvidence}
                onSubmitMissingAnswer={handleMissingSubmit}
                interpretError={interpretError ?? demoGuidance}
              />
            ) : showEssentialsClear ? (
              <div className="banner stack">
                <h3>Every essential field is resolved.</h3>
                <p className="note text-[var(--fg)]">
                  What remains is supporting information — it enriches the dossier
                  and never blocks readiness. Finish to view the readiness report,
                  or continue with supporting fields.
                </p>
                <div className="row">
                  <Button type="button" onClick={onContinueSupporting}>
                    Continue with supporting fields
                  </Button>
                  <Button type="button" variant="secondary" onClick={onFinish}>
                    Finish and view report
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="dossier">
            <div className="row-between mb-[var(--gap-sm)]">
              <span className="meta uppercase tracking-[0.06em]">
                Live dossier · ARK-1500
              </span>
              <span className="meta">{dossierCounts(dossier)}</span>
            </div>
            <div className="card px-[22px] py-[18px]">
              <DossierPanel
                dossier={dossier}
                flashKey={flashKey ?? undefined}
                flashEpoch={flashEpoch}
                onOpenSource={openEvidence}
                onOpenRejected={openRejected}
              />
            </div>
          </aside>
        </div>
      </div>

      <SourceDrawer
        open={drawerOpen}
        kind={drawer.kind}
        title={drawer.title}
        meta={drawer.meta}
        passage={drawer.passage}
        quote={drawer.quote}
        note={drawer.note}
        onClose={() => setDrawerOpen(false)}
      />

      <BudgetPause
        open={showBudgetPause}
        onContinue={onContinuePastBudget}
        onFinish={onFinish}
      />

      {pendingProposals ? (
        <div className="modal-veil open">
          <ProposalConfirmation
            proposals={pendingProposals}
            onAccept={(proposals) => {
              setPendingProposals(null);
              onAnswer({ type: "apply-proposals", proposals });
            }}
            onDiscard={() => setPendingProposals(null)}
          />
        </div>
      ) : null}

      {flashKey ? (
        <span className="sr-only" aria-live="polite">
          Updated {flashKey}
        </span>
      ) : null}
    </section>
  );
}
