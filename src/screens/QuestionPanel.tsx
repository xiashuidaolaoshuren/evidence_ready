import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ApplyEvent } from "@/domain/apply";
import { parseAnswer } from "@/domain/apply";
import { KETTLE_FIELDS } from "@/domain/fields";
import type { Question } from "@/domain/planner";
import type { DossierField, Evidence } from "@/domain/types";
import { interviewQuestion, interviewRationale } from "./interview-copy";

export interface QuestionPanelProps {
  question: Question;
  field: DossierField;
  dossier: DossierField[];
  questionNumber: number;
  onAnswer: (event: ApplyEvent) => void;
  onLeaveUnresolved: (fieldKey: string) => void;
  onOpenSource: (evidence: Evidence, label: string) => void;
  onSubmitMissingAnswer?: (
    fieldKey: string,
    answerText: string,
    sourceDescription?: string,
  ) => void | Promise<void>;
  interpretError?: string | null;
}

function fieldDefinition(fieldKey: string) {
  return KETTLE_FIELDS.find((entry) => entry.key === fieldKey);
}

function shapePillClass(shape: Question["shape"]): string {
  if (shape === "conflict") return "pill-conflict";
  if (shape === "unverified") return "pill-unverified";
  return "pill-missing";
}

function checkedDocuments(dossier: DossierField[]): string[] {
  const docs = new Set<string>();
  for (const entry of dossier) {
    for (const evidence of entry.evidence) {
      docs.add(evidence.documentId);
    }
    for (const rejected of entry.rejectedCandidates) {
      docs.add(rejected.citation.documentId);
    }
    for (const candidate of entry.conflictCandidates) {
      if (candidate.citation) {
        docs.add(candidate.citation.documentId);
      }
    }
  }
  return [...docs];
}

function ConflictQuestion({
  field,
  onAnswer,
  onLeaveUnresolved,
  onOpenSource,
}: {
  field: DossierField;
  onAnswer: (event: ApplyEvent) => void;
  onLeaveUnresolved: (fieldKey: string) => void;
  onOpenSource: (evidence: Evidence, label: string) => void;
}) {
  const customId = useId();
  const [customValue, setCustomValue] = useState("");

  return (
    <>
      <div className="grid-2">
        {field.conflictCandidates.map((candidate, index) => (
          <div key={index} className="candidate">
            <div className="cand-value">{String(candidate.value)}</div>
            {candidate.citation ? (
              <>
                <blockquote>&ldquo;{candidate.citation.quote}&rdquo;</blockquote>
                <span className="meta">
                  {candidate.source === "user"
                    ? "asserted by you earlier in this interview"
                    : `${candidate.citation.documentId} · page ${candidate.citation.page}`}
                </span>
                <div className="row">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const citation = candidate.citation!;
                      onOpenSource(
                        {
                          ...citation,
                          surroundingWindow:
                            (citation as Partial<Evidence>).surroundingWindow ??
                            "",
                        },
                        field.label,
                      );
                    }}
                  >
                    View source
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      onAnswer({
                        type: "adjudicate",
                        fieldKey: field.key,
                        selectedValue: candidate.value,
                      })
                    }
                  >
                    Use {String(candidate.value)}
                  </Button>
                </div>
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  onAnswer({
                    type: "adjudicate",
                    fieldKey: field.key,
                    selectedValue: candidate.value,
                  })
                }
              >
                Use {String(candidate.value)}
              </Button>
            )}
          </div>
        ))}
      </div>
      <div className="row mt-[var(--gap-md)] flex-wrap">
        <input
          id={customId}
          className="input max-w-[220px]"
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          placeholder="Enter a different value"
          aria-label="Different value"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            const trimmed = customValue.trim();
            if (!trimmed) return;
            onAnswer({
              type: "adjudicate",
              fieldKey: field.key,
              selectedValue: trimmed,
            });
          }}
        >
          Use entered value
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onLeaveUnresolved(field.key)}
        >
          Leave this conflict unresolved
        </Button>
      </div>
    </>
  );
}

function MissingQuestion({
  field,
  dossier,
  onAnswer,
  onLeaveUnresolved,
  onSubmitMissingAnswer,
  interpretError,
}: {
  field: DossierField;
  dossier: DossierField[];
  onAnswer: (event: ApplyEvent) => void;
  onLeaveUnresolved: (fieldKey: string) => void;
  onSubmitMissingAnswer?: (
    fieldKey: string,
    answerText: string,
    sourceDescription?: string,
  ) => void | Promise<void>;
  interpretError?: string | null;
}) {
  const answerId = useId();
  const sourceId = useId();
  const [answerText, setAnswerText] = useState("");
  const [sourceText, setSourceText] = useState("");
  const docs = checkedDocuments(dossier);

  return (
    <>
      <div>
        <span className="meta uppercase tracking-[0.05em]">
          Evidence already checked
        </span>
        <div className="row mt-[6px] flex-wrap gap-[var(--gap-xs)]">
          {docs.map((doc) => (
            <span key={doc} className="tag">
              {doc}
            </span>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor={answerId}>Your answer</label>
        <textarea
          id={answerId}
          className="textarea"
          value={answerText}
          onChange={(event) => setAnswerText(event.target.value)}
          placeholder="Type the value, in your own words if you like"
        />
      </div>
      <div className="field">
        <label htmlFor={sourceId}>
          Where does this answer come from? (optional)
        </label>
        <input
          id={sourceId}
          className="input"
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder="e.g. purchase order PO-2214, supplier email"
        />
      </div>
      <div className="row flex-wrap">
        <Button
          type="button"
          onClick={() => {
            if (onSubmitMissingAnswer) {
              void onSubmitMissingAnswer(
                field.key,
                answerText,
                sourceText.trim() || undefined,
              );
              return;
            }
            onAnswer(parseAnswer(field.key, answerText));
          }}
        >
          Submit answer
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            onAnswer({ type: "declare-unavailable", fieldKey: field.key })
          }
        >
          Mark as unavailable
        </Button>
        {field.tier === "supporting" ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => onLeaveUnresolved(field.key)}
          >
            Leave missing
          </Button>
        ) : null}
      </div>
      {interpretError ? (
        <p className="note text-[var(--danger)]" role="alert">
          {interpretError}
        </p>
      ) : null}
    </>
  );
}

function UnverifiedQuestion({
  field,
  onAnswer,
}: {
  field: DossierField;
  onAnswer: (event: ApplyEvent) => void;
}) {
  const customId = useId();
  const [showReplace, setShowReplace] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const rejected = field.rejectedCandidates[0];
  const displayValue =
    field.normalizedValue ?? field.originalValue ?? rejected?.value;

  return (
    <>
      {rejected ? (
        <div className="rejected stack gap-[var(--gap-xs)]">
          <div className="row-between">
            <span className="meta uppercase tracking-[0.05em]">
              Rejected candidate
            </span>
            <span className="pill pill-unverified">not evidence</span>
          </div>
          <div className="rej-value">{String(rejected.value)}</div>
          <span className="meta">
            claimed: {rejected.citation.documentId}, page {rejected.citation.page}{" "}
            · &ldquo;{rejected.citation.quote}&rdquo;
          </span>
          <span className="note">{rejected.rejectionReason}</span>
        </div>
      ) : null}
      <p className="note">
        Confirming makes this value <strong>user-provided</strong>, never
        confirmed — no evidence ever supported it.
      </p>
      <div className="row flex-wrap">
        <Button
          type="button"
          onClick={() =>
            onAnswer({
              type: "provide-answer",
              fieldKey: field.key,
              value: displayValue,
            })
          }
        >
          Confirm {String(displayValue)} as user-provided
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowReplace(true)}
        >
          Replace with a different value
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            onAnswer({ type: "declare-unavailable", fieldKey: field.key })
          }
        >
          Reject the value
        </Button>
      </div>
      {showReplace ? (
        <div className="row flex-wrap">
          <input
            id={customId}
            className="input max-w-[220px]"
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            placeholder="e.g. 2000 W"
            aria-label="Replacement value"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              const trimmed = customValue.trim();
              if (!trimmed) return;
              onAnswer({
                type: "provide-answer",
                fieldKey: field.key,
                value: trimmed,
              });
            }}
          >
            Use entered value
          </Button>
        </div>
      ) : null}
    </>
  );
}

export function QuestionPanel({
  question,
  field,
  dossier,
  questionNumber,
  onAnswer,
  onLeaveUnresolved,
  onOpenSource,
  onSubmitMissingAnswer,
  interpretError,
}: QuestionPanelProps) {
  const def = fieldDefinition(field.key);
  const fallbackQuestion =
    def?.question ?? `What is the ${field.label.toLowerCase()}?`;
  const fallbackRationale =
    def?.rationale ??
    "This field needs your input because the documents do not resolve it.";
  const questionText = interviewQuestion(
    field.key,
    question.shape,
    fallbackQuestion,
  );
  const rationale = interviewRationale(
    field.key,
    question.shape,
    fallbackRationale,
  );

  return (
    <div className="card stack q-enter">
      <div className="row-between flex-wrap">
        <span className={`pill ${shapePillClass(question.shape)}`}>
          {question.shape}
        </span>
        <span className="meta">
          question {questionNumber} · {field.label.toLowerCase()}
        </span>
      </div>
      <h3 className="text-[22px]">{questionText}</h3>
      <p className="note text-[var(--fg)]">{rationale}</p>
      {question.shape === "conflict" ? (
        <ConflictQuestion
          field={field}
          onAnswer={onAnswer}
          onLeaveUnresolved={onLeaveUnresolved}
          onOpenSource={onOpenSource}
        />
      ) : null}
      {question.shape === "missing" ? (
        <MissingQuestion
          field={field}
          dossier={dossier}
          onAnswer={onAnswer}
          onLeaveUnresolved={onLeaveUnresolved}
          onSubmitMissingAnswer={onSubmitMissingAnswer}
          interpretError={interpretError}
        />
      ) : null}
      {question.shape === "unverified" ? (
        <UnverifiedQuestion field={field} onAnswer={onAnswer} />
      ) : null}
    </div>
  );
}
