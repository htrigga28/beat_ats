import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import type { AppliedChange, ResumeDocument, TruthConfirmations } from "../types";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { ResumePreview } from "./ResumePreview";

interface Props {
  resume: ResumeDocument;
  original: ResumeDocument;
  appliedChanges: Record<string, AppliedChange>;
  truthConfirmations: TruthConfirmations;
  analysisStale: boolean;
  busy: boolean;
  exportStatus: "idle" | "compiling" | "downloading";
  onTruthChange: (key: keyof TruthConfirmations, checked: boolean) => void;
  onGenerate: () => void;
  onReanalyze: () => void;
  onBack: () => void;
}

const sectionLabels: [keyof ResumeDocument, string][] = [
  ["contact", "Contact details"],
  ["professional_summary", "Professional summary"],
  ["work_experience", "Work experience"],
  ["skills", "Skills"],
  ["education", "Education"],
  ["certifications", "Certifications"],
  ["projects", "Projects"],
  ["additional_sections", "Additional sections"],
];

export function ExportStep({
  resume,
  original,
  appliedChanges,
  truthConfirmations,
  analysisStale,
  busy,
  exportStatus,
  onTruthChange,
  onGenerate,
  onReanalyze,
  onBack,
}: Props) {
  const applied = Object.values(appliedChanges);
  const manuallyChangedSections = sectionLabels.filter(
    ([key]) => JSON.stringify(resume[key]) !== JSON.stringify(original[key]),
  );
  const ready = truthConfirmations.factual && truthConfirmations.advisory;
  const exporting = busy || exportStatus !== "idle";
  const exportLabel =
    exportStatus === "compiling"
      ? "Compiling ATS-safe document…"
      : exportStatus === "downloading"
        ? "Downloading file…"
        : "Download ATS-optimized Word document (.docx)";

  return (
    <section className="stage-enter export-stage" aria-labelledby="export-title">
      <div className="stage-intro export-intro">
        <span className="stage-kicker">Stage 4 · Final proof</span>
        <h2 id="export-title">Verify the final document</h2>
        <p>
          This preview follows the Word document’s information order. Confirm the facts and the
          advisory nature of the result before compiling your download.
        </p>
      </div>

      {analysisStale && (
        <div className="stale-analysis-card" role="status">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Your score predates the latest edits</strong>
            <span>
              The document is still exportable. Re-analysis is optional and may produce a different
              advisory result.
            </span>
          </div>
          <Button type="button" variant="secondary" onClick={onReanalyze} disabled={busy}>
            <RefreshCw aria-hidden="true" /> Re-run analysis
          </Button>
        </div>
      )}

      <div className="export-layout">
        <div className="export-preview-column">
          <div className="preview-heading-row">
            <div>
              <span className="stage-kicker">Complete document preview</span>
              <h3>tailored_resume.docx</h3>
            </div>
            <span className="docx-badge">DOCX</span>
          </div>
          <ResumePreview resume={resume} />
        </div>

        <aside className="export-verification" aria-labelledby="truth-check-title">
          <div className="verification-icon">
            <FileCheck2 aria-hidden="true" />
          </div>
          <span className="stage-kicker">Human-in-the-loop</span>
          <h3 id="truth-check-title">Truth verification check</h3>
          <p>Both confirmations are required. Beat ATS will never confirm these facts for you.</p>

          <div className="change-summary">
            <h4>Change summary</h4>
            <div>
              <span>
                <strong>{applied.length}</strong> AI wording change{applied.length === 1 ? "" : "s"}
              </span>
              <span>
                <strong>{manuallyChangedSections.length}</strong> edited section
                {manuallyChangedSections.length === 1 ? "" : "s"}
              </span>
            </div>
            {manuallyChangedSections.length > 0 && (
              <ul>
                {manuallyChangedSections.map(([, label]) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            )}
            {applied.length > 0 && (
              <details>
                <summary>Review applied wording</summary>
                {applied.map((change) => (
                  <div className="applied-change-summary" key={change.bulletId}>
                    <span>Before</span>
                    <p>{change.before}</p>
                    <span>After</span>
                    <p>{change.after}</p>
                  </div>
                ))}
              </details>
            )}
          </div>

          <div className="truth-checks">
            <label htmlFor="truth-factual">
              <Checkbox
                id="truth-factual"
                checked={truthConfirmations.factual}
                onCheckedChange={(checked) => onTruthChange("factual", checked === true)}
                disabled={exporting}
              />
              <span>
                I confirm that all bullet points, numbers, and experiences added during tailoring
                are truthful and factual.
              </span>
            </label>
            <label htmlFor="truth-advisory">
              <Checkbox
                id="truth-advisory"
                checked={truthConfirmations.advisory}
                onCheckedChange={(checked) => onTruthChange("advisory", checked === true)}
                disabled={exporting}
              />
              <span>
                I understand these results are advisory and are not a guaranteed match with any
                specific ATS.
              </span>
            </label>
          </div>

          <Button
            type="button"
            size="lg"
            className="export-button"
            onClick={onGenerate}
            disabled={!ready || exporting}
          >
            {exportStatus === "idle" ? (
              <Download aria-hidden="true" />
            ) : (
              <ShieldCheck aria-hidden="true" />
            )}
            {exportLabel}
          </Button>
          {ready ? (
            <span className="export-ready">
              <CheckCircle2 aria-hidden="true" /> Ready to compile locally
            </span>
          ) : (
            <span className="export-locked">Complete both truth checks to unlock download.</span>
          )}
        </aside>
      </div>

      <div className="export-back-row">
        <Button type="button" variant="secondary" onClick={onBack} disabled={exporting}>
          <ArrowLeft aria-hidden="true" /> Back to Tailor Studio
        </Button>
      </div>
    </section>
  );
}
