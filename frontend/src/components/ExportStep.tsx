import type { ResumeDocument } from "../types";

interface Props {
  resume: ResumeDocument;
  original: ResumeDocument;
  analysisStale: boolean;
  busy: boolean;
  downloadUrl: string | null;
  onGenerate: () => void;
  onReanalyze: () => void;
  onBack: () => void;
}

export function ExportStep({
  resume,
  original,
  analysisStale,
  busy,
  downloadUrl,
  onGenerate,
  onReanalyze,
  onBack,
}: Props) {
  const originalBullets = new Map(
    (original.work_experience ?? []).flatMap((role) =>
      (role.bullets ?? []).map((bullet) => [bullet.id, bullet.text] as const),
    ),
  );
  const changedCount = (resume.work_experience ?? [])
    .flatMap((role) => role.bullets ?? [])
    .filter((bullet) => originalBullets.get(bullet.id) !== bullet.text).length;
  return (
    <section className="reading-column wide-column" aria-labelledby="export-title">
      <p className="eyebrow">FINAL PROOF</p>
      <h2 id="export-title">Verify and export</h2>
      <p className="lead">
        <strong>{changedCount}</strong> work-experience bullet{changedCount === 1 ? "" : "s"}{" "}
        changed. Review the final wording before download.
      </p>
      <div className="alert alert-warning" role="note">
        <strong>Truth check</strong>
        <span>Verify every metric and statement before submitting the document.</span>
      </div>
      {analysisStale && (
        <div className="stale-banner" role="status">
          <strong>Your latest edits have not been re-analyzed.</strong>
          <button className="text-button" type="button" onClick={onReanalyze} disabled={busy}>
            Re-run analysis
          </button>
        </div>
      )}
      <article className="preview-sheet">
        <h3>{resume.contact.full_name}</h3>
        {resume.contact.links?.length ? (
          <p className="muted">{resume.contact.links.join(" · ")}</p>
        ) : null}
        {resume.professional_summary && <p>{resume.professional_summary}</p>}
        {(resume.work_experience ?? []).map((role) => (
          <div className="preview-role" key={role.id}>
            <h4>
              {role.title} · {role.employer}
            </h4>
            <p className="muted">
              {[
                role.location,
                role.start_date && `${role.start_date} — ${role.end_date ?? "Present"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <ul>
              {(role.bullets ?? []).map((bullet) => (
                <li key={bullet.id}>
                  {bullet.text}
                  {originalBullets.get(bullet.id) !== bullet.text && (
                    <span className="accepted-mark">Accepted change</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {(resume.skills ?? []).length > 0 && (
          <div className="preview-role">
            <h4>Skills</h4>
            {(resume.skills ?? []).map((group, index) => (
              <p key={index}>
                <strong>{group.label}</strong>
                {group.label ? ": " : ""}
                {group.items?.join(", ")}
              </p>
            ))}
          </div>
        )}
      </article>
      <div className="form-actions">
        <button className="button button-secondary" type="button" onClick={onBack}>
          Back to tailoring
        </button>
        <button
          className="button button-primary"
          type="button"
          onClick={onGenerate}
          disabled={busy}
        >
          {busy ? "Building Word file…" : "Generate ATS-safe Word file"}
        </button>
        {downloadUrl && (
          <a
            className="button button-primary download-link"
            href={downloadUrl}
            download="tailored_resume.docx"
          >
            Download tailored_resume.docx
          </a>
        )}
      </div>
      {!downloadUrl && (
        <p className="muted">The download control appears after the Word file is generated.</p>
      )}
    </section>
  );
}
