import { useState, type FormEvent } from "react";
import type { RuntimeConfig } from "../types";

interface Props {
  config: RuntimeConfig | null;
  busy: boolean;
  onUpload: (file: File, jobDescription: string, consent: boolean, visionConsent: boolean) => void;
}

export function UploadStep({ config, busy, onUpload }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [consent, setConsent] = useState(false);
  const [visionConsent, setVisionConsent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const maxBytes = config?.max_upload_bytes ?? 10 * 1024 * 1024;
  const maxLabel = `${maxBytes / (1024 * 1024)} MB`;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: string[] = [];
    if (!file) next.push("Choose a PDF or DOCX resume before continuing.");
    else if (!config?.accepted_extensions.includes(file.name.split(".").pop()?.toLowerCase() ?? ""))
      next.push("Only PDF and DOCX resumes are supported.");
    else if (file.size > maxBytes)
      next.push(`This file is larger than the deployment limit of ${maxLabel}.`);
    if (jobDescription.trim().length < 50)
      next.push("Paste a complete job description of at least 50 characters.");
    if (!consent) next.push("Consent is required before resume content is sent to Gemini.");
    setErrors(next);
    if (!next.length && file) onUpload(file, jobDescription, consent, visionConsent);
  }

  return (
    <section className="reading-column" aria-labelledby="upload-title">
      <p className="eyebrow">SOURCE INTAKE</p>
      <h2 id="upload-title">Upload your current resume</h2>
      <p className="lead">
        Add a PDF or DOCX and the complete frontend job description. You will verify every extracted
        field before analysis.
      </p>
      <div className="note-block">
        <strong>Gemini privacy note</strong>
        <p>
          Free-tier and billing-enabled projects have different data handling terms. Use a
          billing-enabled project for production-sensitive resumes.
        </p>
      </div>
      {config && (
        <p className="limit-note">
          Deployment limit: <strong>{maxLabel}</strong> · accepted:{" "}
          {config.accepted_extensions.map((extension) => extension.toUpperCase()).join(" and ")} ·
          AI: <strong>{config.gemini_model}</strong>
        </p>
      )}
      {!config && (
        <p className="status-line" role="status">
          Loading deployment settings…
        </p>
      )}
      <form className="form-sheet" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="resume-file">Resume file</label>
          <input
            id="resume-file"
            type="file"
            accept=".pdf,.docx"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={busy}
            aria-describedby="file-help"
          />
          <small id="file-help">
            Maximum {maxLabel}. Scanned PDFs ask for separate vision permission.
          </small>
        </div>
        <div className="field">
          <label htmlFor="job-description">Target job description</label>
          <textarea
            id="job-description"
            value={jobDescription}
            onChange={(event) => setJobDescription(event.target.value)}
            placeholder="Paste the complete role description, including location and eligibility."
            rows={12}
            disabled={busy}
          />
          <small>{jobDescription.trim().length} / 50 minimum characters</small>
        </div>
        <fieldset className="consent-group">
          <legend>Before extraction</legend>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={busy}
            />{" "}
            <span>
              I consent to sending my resume content and job description to Gemini for this session.
            </span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={visionConsent}
              onChange={(event) => setVisionConsent(event.target.checked)}
              disabled={busy || !config?.vision_fallback_available}
            />{" "}
            <span>Allow inline Gemini vision processing if this PDF has no selectable text.</span>
          </label>
        </fieldset>
        {errors.length > 0 && (
          <div className="field-errors" role="alert">
            <strong>Review before sending</strong>
            <ul>
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="disclaimer">
          The AI rewrites content based on your input. Verify every metric and statement for
          accuracy before submitting.
        </p>
        <button className="button button-primary" type="submit" disabled={busy || !config}>
          {busy ? "Extracting…" : "Extract resume"}
        </button>
      </form>
    </section>
  );
}
