import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ExtractionMode } from "@/domain/types";
import { validateUploadFiles, MAX_UPLOAD_COUNT } from "./intake-upload";

export interface IntakeProps {
  publicDemo?: boolean;
  sessionNotice?: string | null;
  onStartBundled: (mode: ExtractionMode) => void;
  onStartUpload: (files: File[]) => void;
}

const PRIVACY_SENTENCE =
  "Image-only PDFs are unsupported — OCR is outside this prototype's scope. Document contents are sent to the extraction model; raw files are processed in memory and never stored.";

const COVERAGE_GATE_NOTE =
  "Documents can parse successfully and still fail the essential-coverage check if too few essential fields produce any candidate, the interview does not open. The threshold is a declared constant, not a model judgement, so a thin marketing PDF cannot turn the session into a data-entry form.";

export function Intake({
  publicDemo = false,
  sessionNotice = null,
  onStartBundled,
  onStartUpload,
}: IntakeProps) {
  const [mode, setMode] = useState<ExtractionMode>("recorded");
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const fileInputId = useId();
  const coverageNoteId = useId();

  return (
    <section className="screen-pad screen-enter">
      <p className="eyebrow">Evidence intake · Product documentation</p>
      <h1 className="title-measure">
        Know what your documents can prove before authoring begins.
      </h1>
      <p className="lead">
        EvidenceReady extracts a fixed product dossier from your source
        documents, verifies every citation against the page it names, and
        interviews you about whatever conflicts or is still missing.
      </p>

      {sessionNotice ? (
        <p className="note mt-[var(--gap-md)] text-[var(--st-unverified)]" role="status">
          {sessionNotice}
        </p>
      ) : null}

      {publicDemo ? (
        <p className="note mt-[var(--gap-md)]">
          Live extraction and uploading your own documents are not part of this
          demo.
        </p>
      ) : null}

      <div className={`${publicDemo ? "" : "grid-2"} mt-[var(--gap-xl)] items-start`}>
        <div className="card stack">
          <div>
            <h3>
              Bundled example · ARK-1500 electric kettle
            </h3>
            <p className="note mt-[6px]">
              Two clearly labelled synthetic documents. Together they produce
              one conflict, one gap, and one citation that fails verification.
            </p>
          </div>
          <div>
            <div className="doc-line">
              <span>ARK-1500_supplier-specification.pdf</span>
              <span className="meta">PDF · 3 pages</span>
            </div>
            <div className="doc-line">
              <span>ARK-1500_draft-manual.pdf</span>
              <span className="meta">PDF · 4 pages</span>
            </div>
          </div>
          {publicDemo ? (
            <p className="note">
              This public demo replays the bundled recorded extraction only.
            </p>
          ) : (
            <div
              className="stack gap-[var(--gap-sm)]"
              role="radiogroup"
              aria-label="Extraction mode"
            >
              <label
                className={`mode-card ${mode === "recorded" ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="mode"
                  value="recorded"
                  checked={mode === "recorded"}
                  onChange={() => setMode("recorded")}
                />
                <span>
                  <strong>Recorded extraction — default</strong>
                  <p>
                    Replays a stored extraction response. No API key needed;
                    always reproduces the same conflicts, gaps, and rejected
                    citation.
                  </p>
                </span>
              </label>
              <label
                className={`mode-card ${mode === "live" ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="mode"
                  value="live"
                  checked={mode === "live"}
                  onChange={() => setMode("live")}
                />
                <span>
                  <strong>Live extraction</strong>
                  <p>
                    Sends the same two documents to DeepSeek via OpenRouter.
                    Requires a server-side OpenRouter API key.
                  </p>
                </span>
              </label>
            </div>
          )}
          <div>
            <Button
              type="button"
              onClick={() => onStartBundled(publicDemo ? "recorded" : mode)}
            >
              Load the bundled example
            </Button>
          </div>
        </div>

        {!publicDemo ? (
        <div className="card stack">
          <div>
            <h3>
              Upload your own documents
            </h3>
            <p className="note mt-[6px]">Uploads always run live extraction.</p>
          </div>
          <label className="dropzone" htmlFor={fileInputId}>
            <strong className="text-[var(--fg)]">Choose PDF or TXT files</strong>
            <p className="note mt-[6px] mb-0">
              Up to 3 files · 4 MB total · text-based PDF only
            </p>
          </label>
          <input
            id={fileInputId}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.txt"
            onChange={(event) => {
              const incoming = Array.from(event.target.files ?? []);
              setUploadFiles((prev) => {
                const seen = new Set(
                  prev.map((file) => `${file.name}|${file.size}|${file.lastModified}`),
                );
                const merged = [...prev];
                for (const file of incoming) {
                  const key = `${file.name}|${file.size}|${file.lastModified}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(file);
                  }
                }
                return merged.slice(0, MAX_UPLOAD_COUNT);
              });
              setUploadError(null);
              event.target.value = "";
            }}
          />
          {uploadFiles.length > 0 ? (
            <div>
              {uploadFiles.map((file) => (
                <div key={file.name} className="doc-line">
                  <span>{file.name}</span>
                  <span className="meta">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {uploadError ? (
            <p className="note text-[var(--st-conflict)]">{uploadError}</p>
          ) : null}
          <p className="note m-0">{PRIVACY_SENTENCE}</p>
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const error = validateUploadFiles(uploadFiles);
                if (error) {
                  setUploadError(error);
                  return;
                }
                setUploadError(null);
                onStartUpload(uploadFiles);
              }}
            >
              Start from uploaded documents
            </Button>
          </div>
          <hr className="rule mt-[var(--gap-lg)]" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            aria-expanded={explainOpen}
            aria-controls={coverageNoteId}
            onClick={() => setExplainOpen((open) => !open)}
          >
            What happens when documents don&apos;t carry enough product
            information?
          </Button>
          {explainOpen ? (
            <p id={coverageNoteId} className="note m-0">
              {COVERAGE_GATE_NOTE}
            </p>
          ) : null}
        </div>
        ) : null}
      </div>
    </section>
  );
}
