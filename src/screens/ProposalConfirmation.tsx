import { Button } from "@/components/ui/button";
import { KETTLE_FIELDS } from "@/domain/fields";
import type { Proposal } from "@/domain/types";

export interface ProposalConfirmationProps {
  proposals: Proposal[];
  onAccept: (proposals: Proposal[]) => void;
  onDiscard: () => void;
}

function fieldLabel(fieldKey: string): string {
  return (
    KETTLE_FIELDS.find((field) => field.key === fieldKey)?.label ?? fieldKey
  );
}

export function ProposalConfirmation({
  proposals,
  onAccept,
  onDiscard,
}: ProposalConfirmationProps) {
  const acceptLabel = `Write ${proposals.length} proposal${proposals.length === 1 ? "" : "s"}`;

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="proposal-title">
      <p className="eyebrow mb-[6px]">Proposal · awaiting confirmation</p>
      <h3 id="proposal-title">
        The model interpreted your answer into proposed updates
      </h3>
      <p className="note mt-[8px]">
        Nothing is written to the dossier until you confirm. Accepted proposals
        become user-provided values — never confirmed.
      </p>
      <div className="stack mt-[var(--gap-md)]">
        {proposals.map((proposal) => (
          <div key={proposal.fieldKey} className="proposal-card">
            <span className="meta">{fieldLabel(proposal.fieldKey)}</span>
            <div className="p-value">{String(proposal.proposedValue)}</div>
            <span className="note">
              from your answer: &ldquo;{proposal.answerText}&rdquo;
            </span>
          </div>
        ))}
      </div>
      <div className="row mt-[var(--gap-lg)]">
        <Button type="button" onClick={() => onAccept(proposals)}>
          {acceptLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onDiscard}>
          Discard all
        </Button>
      </div>
    </div>
  );
}
