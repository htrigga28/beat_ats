import { FileText, LockKeyhole, RefreshCw, ShieldCheck, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import type { IngestionStreamEvent, RuntimeConfig } from "../types";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Progress } from "./ui/progress";

interface Props {
  config: RuntimeConfig | null;
  busy: boolean;
  uploadProgress?: number;
  ingestionPhase?: Extract<IngestionStreamEvent, { type: "progress" }> | null;
  onCancel?: () => void;
  onUpload: (file: File, jobDescription: string, consent: boolean, visionConsent: boolean) => void;
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function UploadStep({
  config,
  busy,
  uploadProgress = 0,
  ingestionPhase,
  onCancel,
  onUpload,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [consent, setConsent] = useState(false);
  const [visionConsent, setVisionConsent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const maxBytes = config?.max_upload_bytes ?? 10 * 1024 * 1024;
  const maxMebibytes = maxBytes / (1024 * 1024);
  const maxLabel = `${Number.isInteger(maxMebibytes) ? maxMebibytes : maxMebibytes.toFixed(1)} MiB`;
  const descriptionLength = jobDescription.trim().length;

  useEffect(() => {
    if (busy) overlayRef.current?.focus();
  }, [busy]);

  function chooseFile(nextFile: File | null) {
    setFile(nextFile);
    setErrors([]);
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) chooseFile(event.dataTransfer.files[0] ?? null);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: string[] = [];
    const extension = file?.name.split(".").pop()?.toLowerCase() ?? "";
    if (!file) next.push("Choose a PDF or DOCX resume before continuing.");
    else if (!config?.accepted_extensions.includes(extension))
      next.push("Only PDF and DOCX resumes are supported.");
    else if (file.size > maxBytes)
      next.push(`This file is larger than the deployment limit of ${maxLabel}.`);
    if (descriptionLength < 50)
      next.push("Paste a complete job description of at least 50 characters.");
    if (!consent) next.push("Consent is required before resume content is sent to Gemini.");
    setErrors(next);
    if (!next.length && file) onUpload(file, jobDescription, consent, visionConsent);
  }

  const phaseSequence = ingestionPhase?.sequence ?? 0;
  const overallProgress = uploadProgress < 100 ? uploadProgress * 0.25 : 25 + phaseSequence * 25;

  return (
    <section className="stage-enter" aria-labelledby="upload-title">
      <div className="stage-intro">
        <span className="stage-kicker">Stage 1 · Source intake</span>
        <h2 id="upload-title">Start with the evidence</h2>
        <p>
          Upload the resume you already use and the complete target role. You will verify every
          extracted field before Beat ATS compares or rewrites anything.
        </p>
      </div>

      <form className="upload-grid" onSubmit={submit} noValidate>
        <section className="upload-card" aria-labelledby="resume-upload-title">
          <div className="card-heading-row">
            <div>
              <span className="card-step">01</span>
              <h3 id="resume-upload-title">Current resume</h3>
            </div>
            <FileText aria-hidden="true" />
          </div>

          {!file ? (
            <div
              className={`dropzone ${dragging ? "is-dragging" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
              }}
              onDrop={drop}
            >
              <span className="dropzone-icon">
                <UploadCloud aria-hidden="true" />
              </span>
              <strong>Drop your resume here</strong>
              <span>or choose a file from this device</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Browse files
              </Button>
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept=".pdf,.docx"
                onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                disabled={busy}
                aria-label="Resume file"
              />
            </div>
          ) : (
            <div className="file-card">
              <span className="file-card-icon">
                <FileText aria-hidden="true" />
              </span>
              <div>
                <strong>{file.name}</strong>
                <span>{fileSize(file.size)}</span>
              </div>
              <div className="file-card-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RefreshCw aria-hidden="true" /> Replace
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Clear selected resume"
                  onClick={() => chooseFile(null)}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept=".pdf,.docx"
                onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
                disabled={busy}
                aria-label="Replace resume file"
              />
            </div>
          )}

          <p className="file-help">
            {config ? (
              <>
                Accepted: {config.accepted_extensions.map((item) => `.${item}`).join(", ")}
                <span>Maximum size: {maxLabel}</span>
              </>
            ) : (
              <span role="status">Loading deployment settings…</span>
            )}
          </p>

          <div className="consent-stack">
            <label className="consent-row" htmlFor="ai-consent">
              <Checkbox
                id="ai-consent"
                checked={consent}
                onCheckedChange={(checked) => setConsent(checked === true)}
                disabled={busy}
              />
              <span>
                <strong>Required</strong>I consent to processing my resume and job description data
                via Gemini.
              </span>
            </label>
            <label className="consent-row" htmlFor="vision-consent">
              <Checkbox
                id="vision-consent"
                checked={visionConsent}
                onCheckedChange={(checked) => setVisionConsent(checked === true)}
                disabled={busy || !config?.vision_fallback_available}
              />
              <span>
                <strong>Optional · Visual PDF processing</strong>
                Use this for scanned PDFs or files whose text cannot be highlighted.
              </span>
            </label>
          </div>
        </section>

        <section className="upload-card" aria-labelledby="job-description-title">
          <div className="card-heading-row">
            <div>
              <span className="card-step">02</span>
              <h3 id="job-description-title">Target job description</h3>
            </div>
            <ShieldCheck aria-hidden="true" />
          </div>
          <label className="textarea-shell" htmlFor="job-description">
            <span className="sr-only">Target job description</span>
            <textarea
              id="job-description"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the complete role description, including responsibilities, requirements, location, and eligibility…"
              rows={18}
              disabled={busy}
            />
            <span
              className={`character-count ${descriptionLength >= 50 ? "is-valid" : ""}`}
              aria-live="polite"
            >
              {descriptionLength.toLocaleString()} / 50 minimum
            </span>
          </label>
          <div className="privacy-note">
            <LockKeyhole aria-hidden="true" />
            <div>
              <strong>Private, in-memory session</strong>
              <span>Refreshing or clearing this page removes the working document.</span>
            </div>
          </div>
        </section>

        {errors.length > 0 && (
          <div className="field-errors upload-errors" role="alert">
            <strong>Review before sending</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="upload-action-row">
          <p>
            Gemini provides advisory wording only. You remain responsible for every fact and applied
            change.
          </p>
          <Button type="submit" size="lg" disabled={busy || !config}>
            Review extracted resume
            <span aria-hidden="true">→</span>
          </Button>
        </div>
      </form>

      {busy && (
        <div
          className="processing-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="processing-title"
        >
          <div className="processing-card" ref={overlayRef} tabIndex={-1}>
            <span className="processing-icon">
              <FileText aria-hidden="true" />
            </span>
            <span className="stage-kicker">Secure session processing</span>
            <h3 id="processing-title">Building your editable resume</h3>
            <p aria-live="polite">
              {uploadProgress < 100
                ? `Uploading your document… ${Math.round(uploadProgress)}%`
                : (ingestionPhase?.message ?? "Preparing secure processing…")}
            </p>
            <Progress value={overallProgress} aria-label="Resume processing progress" />
            <ol className="processing-steps">
              {["Parsing local structure", "Structuring with Gemini", "Validating resume data"].map(
                (label, index) => (
                  <li className={phaseSequence > index ? "is-complete" : ""} key={label}>
                    <span>{phaseSequence > index ? "✓" : index + 1}</span>
                    {label}
                  </li>
                ),
              )}
            </ol>
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel processing
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
