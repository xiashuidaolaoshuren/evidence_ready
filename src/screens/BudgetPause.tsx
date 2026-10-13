import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useOverlayKeyboard } from "./overlay-focus";

export interface BudgetPauseProps {
  open: boolean;
  onContinue: () => void;
  onFinish: () => void;
}

export function BudgetPause({ open, onContinue, onFinish }: BudgetPauseProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useOverlayKeyboard({
    open,
    containerRef: dialogRef,
    trapFocus: true,
  });

  if (!open) {
    return null;
  }

  return (
    <div className="modal-veil open">
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-pause-title"
      >
        <p className="eyebrow mb-[6px]">Question budget</p>
        <h3 id="budget-pause-title">Five questions asked — pause and check in</h3>
        <p className="note mt-[8px]">
          The planner does not abandon a blocker it has already identified, but
          it will not keep you in an unbounded interview either. Continue, or
          finish now and open the readiness report with the current dossier.
        </p>
        <div className="row mt-[var(--gap-lg)]">
          <Button type="button" variant="secondary" onClick={onContinue}>
            Continue the interview
          </Button>
          <Button type="button" onClick={onFinish}>
            Finish and view report
          </Button>
        </div>
      </div>
    </div>
  );
}
