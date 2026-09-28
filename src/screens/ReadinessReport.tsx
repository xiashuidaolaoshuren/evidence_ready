import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ModeBadge } from "@/components/ModeBadge";
import { authoringReadiness } from "@/domain/readiness.js";
import type { DossierField, Evidence, ExtractionMode } from "@/domain/types.js";
import { DossierPanel } from "./DossierPanel.js";
import { formatFieldValue } from "./source-labels.js";
import { SourceDrawer } from "./SourceDrawer.js";

export interface ReadinessReportProps {
  dossier: DossierField[];
  mode: ExtractionMode;
  onBackToInterview: () => void;
  onRestart: () => void;
}

const STATUS_LABEL = {
  confirmed: "Confirmed",
  "user-provided": "User-provided",
  unverified: "Unverified",
  conflicting: "Conflicting",
  missing: "Missing",
} as const;

const STATUS_PILL = {
  confirmed: "pill-confirmed",
  "user-provided": "pill-user",
  unverified: "pill-unverified",
  conflicting: "pill-conflict",
  missing: "pill-missing",
} as const;

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

function Criterion({ pass, children }: { pass: boolean; children: string }) {
  return (
    <div className={`criterion ${pass ? "pass" : "fail"}`}>
      <span className="c-mark">{pass ? "✓" : "✗"}</span>
      <span>{children}</span>
    </div>
  );
}

export function ReadinessReport({
  dossier,
  mode,
  onBackToInterview,
  onRestart,
}: ReadinessReportProps) {
  const [drawer, setDrawer] = useState<DrawerState>(EMPTY_DRAWER);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { verdict, blockers } = authoringReadiness(dossier);
  const ready = verdict === "ready";
  const missingCount = blockers.filter((b) => b.reason === "missing").length;
  const conflictFields = dossier.filter((f) => f.status === "conflicting");
  const essentialConflictFields = conflictFields.filter(
    (f) => f.tier === "essential",
  );
  const supportingConflictFields = conflictFields.filter(
    (f) => f.tier === "supporting",
  );
  const hasUnverified = blockers.some((b) => b.reason === "unverified");
  const missingEssentials = dossier.filter(
    (f) => f.tier === "essential" && f.status === "missing",
  );
  const unavailable = missingEssentials.filter((f) =>
    f.markers.includes("declaredUnavailable"),
  );
  const neverInvestigated = missingEssentials.filter(
    (f) => !f.markers.includes("declaredUnavailable"),
  );
  const adjudicated = dossier.filter((f) => f.markers.includes("adjudicated"));
  const unverifiedOrUser = dossier.filter(
    (f) => f.status === "unverified" || f.status === "user-provided",
  );
  const evidenceRows = dossier.flatMap((entry) =>
    entry.evidence.map((evidence, index) => ({ entry, evidence, index })),
  );
  const rejectedRows = dossier.flatMap((entry) =>
    entry.rejectedCandidates.map((rejected, index) => ({
      entry,
      rejected,
      index,
    })),
  );

  const missingText =
    missingCount === 0
      ? "No essential field is missing"
      : `No essential field is missing — ${missingCount} still open`;
  const conflictText =
    essentialConflictFields.length === 0
      ? "No conflict remains unadjudicated"
      : `No conflict remains unadjudicated — ${essentialConflictFields.map((f) => f.label).join(", ")}`;

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
    const entry = dossier.find((item) => item.key === fieldKey);
    const rejected = entry?.rejectedCandidates[rejectedIndex];
    if (!entry || !rejected) return;
    setDrawer({
      kind: "Rejected candidate",
      title: entry.label,
      meta: `${rejected.citation.documentId} · cited page ${rejected.citation.page}`,
      passage: rejected.citation.quote,
      quote: rejected.citation.quote,
      note: `Rejected: ${rejected.rejectionReason} A rejected candidate is retained and visible, but it can never support a value.`,
    });
    setDrawerOpen(true);
  }

  return (
    <section className="screen-pad screen-enter">
      <div className="mx-auto max-w-[960px]">
        <p className="eyebrow">Readiness report · ARK-1500 kettle</p>
        <div className={`verdict ${ready ? "ready" : "review"}`}>
          <div className="row-between flex-wrap">
            <h2>
              {ready ? "Ready for manual authoring" : "Needs evidence review"}
            </h2>
            <ModeBadge mode={mode} />
          </div>
          <div className="mt-[var(--gap-md)]">
            <Criterion pass={missingCount === 0}>{missingText}</Criterion>
            <Criterion pass={essentialConflictFields.length === 0}>
              {conflictText}
            </Criterion>
            <Criterion pass={!hasUnverified}>
              Every essential value is confirmed or explicitly user-provided
            </Criterion>
          </div>
          <p className="note mt-[var(--gap-md)]">
            This session used {mode === "recorded" ? "recorded" : "live"}{" "}
            extraction. Readiness means this prototype dossier can move to
            authoring; it does not mean the information is legally sufficient or
            correct.
          </p>
        </div>

        <div className="stack mt-[var(--gap-xl)]">
          <h3>Blocking conflicts</h3>
          {essentialConflictFields.length === 0 ? (
            <p className="note">
              None — every conflict was adjudicated or none arose.
            </p>
          ) : (
            essentialConflictFields.map((entry) => (
              <div key={entry.key} className="card">
                <div className="row-between">
                  <strong>{entry.label}</strong>
                  <span className="pill pill-conflict">Conflicting</span>
                </div>
                <div className="grid-2 mt-[var(--gap-sm)]">
                  {entry.conflictCandidates.map((candidate, index) => (
                    <div key={index} className="candidate">
                      <div className="cand-value text-[18px]">
                        {String(candidate.value)}
                      </div>
                      <span className="meta">
                        {candidate.source === "user" || !candidate.citation
                          ? "asserted by user"
                          : `${candidate.citation.documentId} · p.${candidate.citation.page}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {supportingConflictFields.length > 0 ? (
          <div className="stack mt-[var(--gap-xl)]">
            <h3>Supporting conflicts</h3>
            <p className="note">These do not block readiness.</p>
            {supportingConflictFields.map((entry) => (
              <div key={entry.key} className="card">
                <div className="row-between">
                  <strong>{entry.label}</strong>
                  <span className="pill pill-conflict">Conflicting</span>
                </div>
                <div className="grid-2 mt-[var(--gap-sm)]">
                  {entry.conflictCandidates.map((candidate, index) => (
                    <div key={index} className="candidate">
                      <div className="cand-value text-[18px]">
                        {String(candidate.value)}
                      </div>
                      <span className="meta">
                        {candidate.source === "user" || !candidate.citation
                          ? "asserted by user"
                          : `${candidate.citation.documentId} · p.${candidate.citation.page}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="stack mt-[var(--gap-xl)]">
          <h3>Missing essential information</h3>
          {missingEssentials.length === 0 ? (
            <p className="note">None.</p>
          ) : (
            <>
              {unavailable.length > 0 ? (
                <p className="note">
                  Declared unavailable by you — still blocks readiness:{" "}
                  {unavailable.map((f) => f.label).join(", ")}.
                </p>
              ) : null}
              {neverInvestigated.length > 0 ? (
                <p className="note">
                  Never investigated:{" "}
                  {neverInvestigated.map((f) => f.label).join(", ")}.
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="stack mt-[var(--gap-xl)]">
          <h3>Unverified and user-provided values</h3>
          {unverifiedOrUser.length === 0 ? (
            <p className="note">None.</p>
          ) : (
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {unverifiedOrUser.map((entry) => (
                  <tr key={entry.key}>
                    <td>{entry.label}</td>
                    <td className="num">
                      {formatFieldValue(entry)}
                    </td>
                    <td>
                      <span className={`pill ${STATUS_PILL[entry.status]}`}>
                        {STATUS_LABEL[entry.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="stack mt-[var(--gap-xl)]">
          <h3>Adjudicated values</h3>
          {adjudicated.length === 0 ? (
            <p className="note">None.</p>
          ) : (
            adjudicated.map((entry) => (
              <div key={entry.key} className="card">
                <div className="row-between">
                  <strong>{entry.label}</strong>
                  <div className="row">
                    <span>{STATUS_LABEL[entry.status]}</span>
                    <span className="tag">Adjudicated</span>
                  </div>
                </div>
                <div className="num mt-[6px] text-[17px]">
                  {String(entry.normalizedValue ?? entry.originalValue)}
                </div>
                {entry.adjudicatedLosers.map((loser, index) => {
                  const provenance = loser.citation
                    ? ` — ${loser.citation.documentId}, p.${loser.citation.page} · evidence retained`
                    : " — asserted by user";
                  return (
                    <p key={index} className="note mt-[6px]">
                      {`Not chosen: ${String(loser.value)}${provenance}`}
                    </p>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="stack mt-[var(--gap-xl)]">
          <h3>The complete dossier</h3>
          <div className="card px-[22px] py-[8px]">
            <DossierPanel
              dossier={dossier}
              onOpenSource={openEvidence}
              onOpenRejected={openRejected}
            />
          </div>
        </div>

        <div className="stack mt-[var(--gap-xl)]">
          <h3>Evidence and rejected candidates</h3>
          <div className="card stack">
            {evidenceRows.map(({ entry, evidence, index }) => (
              <div key={`${entry.key}-ev-${index}`} className="doc-line">
                <span>
                  {entry.label} — “{evidence.quote}”
                </span>
                <button
                  type="button"
                  className="src-link"
                  onClick={() => openEvidence(evidence, entry.label)}
                >
                  view passage
                </button>
              </div>
            ))}
            {rejectedRows.map(({ entry, rejected, index }) => (
              <div key={`${entry.key}-rej-${index}`} className="doc-line">
                <span className="text-[var(--muted)]">
                  {entry.label} — rejected candidate “{String(rejected.value)}”:{" "}
                  {rejected.rejectionReason}
                </span>
                <button
                  type="button"
                  className="src-link"
                  onClick={() => openRejected(entry.key, index)}
                >
                  details
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="row mt-[var(--gap-xl)] flex-wrap">
          <Button type="button" variant="secondary" onClick={onBackToInterview}>
            Back to the interview
          </Button>
          <Button type="button" variant="ghost" onClick={onRestart}>
            Start a new session
          </Button>
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
    </section>
  );
}
