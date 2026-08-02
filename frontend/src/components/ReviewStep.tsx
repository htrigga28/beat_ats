import { useEffect, type ReactNode } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { AnalysisView } from "./AnalysisView";
import type { GapAnalysis, ResumeDocument } from "../types";

function toStringList(value: unknown, separator: string): string[] {
  const values = Array.isArray(value) ? value : String(value ?? "").split(separator);
  return values.map((item) => String(item).trim()).filter(Boolean);
}

interface Props {
  resume: ResumeDocument;
  warnings: string[];
  analysis: GapAnalysis | null;
  analysisStale: boolean;
  busy: boolean;
  onSave: (resume: ResumeDocument, analyze: boolean) => void;
  onContinue: () => void;
}

export function ReviewStep({
  resume,
  warnings,
  analysis,
  analysisStale,
  busy,
  onSave,
  onContinue,
}: Props) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResumeDocument>({ defaultValues: resume });
  const roles = useFieldArray({ control, name: "work_experience", keyName: "formKey" });
  const education = useFieldArray({ control, name: "education", keyName: "formKey" });
  const projects = useFieldArray({ control, name: "projects", keyName: "formKey" });
  useEffect(() => reset(resume), [reset, resume]);
  const submit = (analyze: boolean) =>
    handleSubmit((data) => onSave({ ...resume, ...data }, analyze))();

  return (
    <section className="reading-column wide-column" aria-labelledby="review-title">
      <p className="eyebrow">FACT CHECK</p>
      <h2 id="review-title">Review before analysis</h2>
      <p className="lead">
        Every extracted field is editable. Nothing is changed by AI at this stage.
      </p>
      {warnings.map((warning) => (
        <div className="alert alert-warning" role="status" key={warning}>
          {warning}
        </div>
      ))}
      <form className="form-sheet resume-editor" onSubmit={(event) => event.preventDefault()}>
        <fieldset>
          <legend>Contact</legend>
          <div className="field-grid">
            <Field label="Full name" error={errors.contact?.full_name?.message}>
              <input {...register("contact.full_name", { required: "Full name is required." })} />
            </Field>
            <Field label="Email">
              <input {...register("contact.email")} />
            </Field>
            <Field label="Phone">
              <input {...register("contact.phone")} />
            </Field>
            <Field label="Location">
              <input {...register("contact.location")} />
            </Field>
          </div>
          <Field label="Links — one per line">
            <textarea
              {...register("contact.links", {
                setValueAs: (value: unknown) => toStringList(value, "\n"),
              })}
              defaultValue={resume.contact.links?.join("\n")}
              rows={3}
            />
          </Field>
          <Field label="Professional summary">
            <textarea {...register("professional_summary")} rows={5} />
          </Field>
        </fieldset>
        <fieldset>
          <legend>Work experience</legend>
          {roles.fields.map((role, roleIndex) => (
            <div className="editor-section" key={role.formKey}>
              <div className="section-heading">
                <h3>{role.title || `Role ${roleIndex + 1}`}</h3>
                <button
                  className="text-button danger-text"
                  type="button"
                  onClick={() => roles.remove(roleIndex)}
                >
                  Remove role
                </button>
              </div>
              <input type="hidden" {...register(`work_experience.${roleIndex}.id`)} />
              <div className="field-grid">
                <Field label="Job title">
                  <input
                    {...register(`work_experience.${roleIndex}.title`, {
                      required: "Job title is required.",
                    })}
                  />
                </Field>
                <Field label="Employer">
                  <input
                    {...register(`work_experience.${roleIndex}.employer`, {
                      required: "Employer is required.",
                    })}
                  />
                </Field>
                <Field label="Location">
                  <input {...register(`work_experience.${roleIndex}.location`)} />
                </Field>
                <Field label="Start date">
                  <input {...register(`work_experience.${roleIndex}.start_date`)} />
                </Field>
                <Field label="End date">
                  <input {...register(`work_experience.${roleIndex}.end_date`)} />
                </Field>
              </div>
              <div className="bullet-editor">
                <span className="field-label">Bullets</span>
                {(role.bullets ?? []).map((bullet, bulletIndex) => (
                  <div className="bullet-row" key={bullet.id}>
                    <input
                      type="hidden"
                      {...register(`work_experience.${roleIndex}.bullets.${bulletIndex}.id`)}
                    />
                    <textarea
                      aria-label={`Bullet ${bulletIndex + 1} for ${role.title}`}
                      {...register(`work_experience.${roleIndex}.bullets.${bulletIndex}.text`, {
                        required: "Bullet text is required.",
                      })}
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </fieldset>
        <fieldset>
          <legend>Skills</legend>
          {(resume.skills ?? []).map((group, index) => (
            <div className="field-grid" key={`skill-${index}`}>
              <Field label="Skill group">
                <input {...register(`skills.${index}.label`)} defaultValue={group.label ?? ""} />
              </Field>
              <Field label="Skills — comma separated">
                <input
                  {...register(`skills.${index}.items`, {
                    setValueAs: (value: unknown) => toStringList(value, ","),
                  })}
                  defaultValue={group.items?.join(", ")}
                />
              </Field>
            </div>
          ))}
        </fieldset>
        <fieldset>
          <legend>Education</legend>
          {education.fields.map((item, index) => (
            <div className="editor-section compact-section" key={item.formKey}>
              <div className="section-heading">
                <h3>{item.credential || `Education ${index + 1}`}</h3>
                <button
                  className="text-button danger-text"
                  type="button"
                  onClick={() => education.remove(index)}
                >
                  Remove
                </button>
              </div>
              <div className="field-grid">
                <Field label="Credential">
                  <input {...register(`education.${index}.credential`)} />
                </Field>
                <Field label="Institution">
                  <input {...register(`education.${index}.institution`)} />
                </Field>
                <Field label="Field of study">
                  <input {...register(`education.${index}.field_of_study`)} />
                </Field>
                <Field label="Location">
                  <input {...register(`education.${index}.location`)} />
                </Field>
                <Field label="Dates">
                  <input {...register(`education.${index}.dates`)} />
                </Field>
              </div>
              <Field label="Details — one per line">
                <textarea
                  {...register(`education.${index}.details`, {
                    setValueAs: (value: unknown) => toStringList(value, "\n"),
                  })}
                  defaultValue={item.details?.join("\n")}
                  rows={3}
                />
              </Field>
            </div>
          ))}
        </fieldset>
        <Field label="Certifications — one per line">
          <textarea
            {...register("certifications", {
              setValueAs: (value: unknown) => toStringList(value, "\n"),
            })}
            defaultValue={resume.certifications?.join("\n")}
            rows={3}
          />
        </Field>
        <fieldset>
          <legend>Projects</legend>
          {projects.fields.map((item, index) => (
            <div className="editor-section compact-section" key={item.formKey}>
              <div className="section-heading">
                <h3>{item.name || `Project ${index + 1}`}</h3>
                <button
                  className="text-button danger-text"
                  type="button"
                  onClick={() => projects.remove(index)}
                >
                  Remove
                </button>
              </div>
              <input type="hidden" {...register(`projects.${index}.id`)} />
              <div className="field-grid">
                <Field label="Project name">
                  <input {...register(`projects.${index}.name`)} />
                </Field>
                <Field label="Project role">
                  <input {...register(`projects.${index}.role`)} />
                </Field>
                <Field label="Dates">
                  <input {...register(`projects.${index}.dates`)} />
                </Field>
                <Field label="Project link">
                  <input {...register(`projects.${index}.link`)} />
                </Field>
              </div>
              {(item.bullets ?? []).map((bullet, bulletIndex) => (
                <div className="bullet-row" key={bullet.id}>
                  <input
                    type="hidden"
                    {...register(`projects.${index}.bullets.${bulletIndex}.id`)}
                  />
                  <textarea
                    aria-label={`Project bullet ${bulletIndex + 1} for ${item.name}`}
                    {...register(`projects.${index}.bullets.${bulletIndex}.text`)}
                    defaultValue={bullet.text}
                    rows={2}
                  />
                </div>
              ))}
            </div>
          ))}
        </fieldset>
        <div className="form-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => submit(false)}
            disabled={busy}
          >
            Save edits
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => submit(true)}
            disabled={busy}
          >
            {busy ? "Analyzing…" : "Save & analyze"}
          </button>
        </div>
      </form>
      {analysis && (
        <>
          {analysisStale && (
            <div className="stale-banner" role="status">
              <strong>This analysis predates your latest edits.</strong> Re-run it before relying on
              the comparison.
            </div>
          )}
          <AnalysisView analysis={analysis} />
          <button className="button button-primary" type="button" onClick={onContinue}>
            Choose bullets to tailor
          </button>
        </>
      )}
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>
        {label}
        {children}
        {error && <small className="error-text">{error}</small>}
      </label>
    </div>
  );
}
