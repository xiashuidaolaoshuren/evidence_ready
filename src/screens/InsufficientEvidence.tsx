import { Button } from "@/components/ui/button";
import type { FailedSource } from "@/state/app-state";
import {
  ESSENTIAL_COVERAGE_THRESHOLD,
} from "@/domain/coverage";
import { essentialKeys } from "@/domain/fields";
import type { DossierField } from "@/domain/types";

export interface InsufficientEvidenceProps {
  dossier: DossierField[];
  failedSources: FailedSource[] | undefined;
  onAddDocument: () => void;
  onContinueAnyway: () => void;
}

function formatValue(field: DossierField): string {
  const value = field.normalizedValue ?? field.originalValue;
  if (Array.isArray(value)) {
    return value.map(String).join(" · ");
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function formatCitation(field: DossierField): string {
  const citation = field.evidence[0];
  if (!citation) {
    return "";
  }
  return `${citation.documentId} p.${citation.page} · quote verified`;
}

function essentialPresentCount(dossier: DossierField[]): number {
  const essential = new Set(essentialKeys());
  return dossier.filter(
    (field) => essential.has(field.key) && field.status !== "missing",
  ).length;
}

function essentialThresholdCount(): number {
  return Math.ceil(essentialKeys().length * ESSENTIAL_COVERAGE_THRESHOLD);
}

export function InsufficientEvidence({
  dossier,
  failedSources,
  onAddDocument,
  onContinueAnyway,
}: InsufficientEvidenceProps) {
  const foundFields = dossier.filter((field) => field.status !== "missing");
  const essentialTotal = essentialKeys().length;
  const essentialPresent = essentialPresentCount(dossier);
  const threshold = essentialThresholdCount();

  return (
    <section className="screen-pad screen-enter">
      <div className="mx-auto max-w-[860px]">
        <p className="eyebrow">Extraction outcome · Low essential coverage</p>
        <h2>
          These documents don&apos;t carry enough product information to work
          from.
        </h2>
        <p className="lead">
          The documents parsed, but too few essential fields produced any
          candidate. The coverage threshold is a declared constant — not a model
          judgement — so this state is deterministic.
        </p>

        <div className="card stack mt-[var(--gap-lg)]">
          <h3>What was found</h3>
          {foundFields.length > 0 ? (
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Candidate</th>
                  <th>Citation</th>
                </tr>
              </thead>
              <tbody>
                {foundFields.map((field) => (
                  <tr key={field.key}>
                    <td>{field.label}</td>
                    <td className="num">{formatValue(field)}</td>
                    <td className="meta">{formatCitation(field)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="note">No field candidates were extracted.</p>
          )}
          <p className="note m-0">
            {essentialPresent} of {essentialTotal} essential fields produced a
            candidate; the threshold is {threshold}. Rather than become a
            data-entry form that made you upload a file first, the interview
            does not open.
          </p>
        </div>

        {failedSources && failedSources.length > 0 ? (
          <div className="mt-[var(--gap-md)]">
            <p className="meta">Failed sources</p>
            <ul className="note mt-[6px] list-none p-0">
              {failedSources.map((source) => (
                <li key={source.id}>
                  {source.filename} — {source.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-[var(--gap-lg)] flex flex-wrap items-center gap-[var(--gap-md)]">
          <Button type="button" onClick={onAddDocument}>
            Add another document
          </Button>
          <Button type="button" variant="secondary" onClick={onContinueAnyway}>
            Continue anyway
          </Button>
        </div>
      </div>
    </section>
  );
}
