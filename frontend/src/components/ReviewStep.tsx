import { AlertTriangle, ChevronLeft, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { ResumeDocument } from "../types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";

interface Props {
  resume: ResumeDocument;
  original?: ResumeDocument;
  jobDescription: string;
  analysisStale: boolean;
  warnings: string[];
  busy: boolean;
  onSave: (resume: ResumeDocument, analyze: boolean) => void;
  onJobDescriptionChange: (jobDescription: string) => void;
  onDismissWarning?: (warning: string) => void;
  onBackConfirmed?: () => void;
}

type ResumeSection = Exclude<keyof ResumeDocument, "contact">;

function newId(): string {
  return crypto.randomUUID();
}

function compact(values: string[]): string[] {
  return values.map((value) => value.trim()).filter(Boolean);
}

export function ReviewStep({
  resume: sourceResume,
  original = sourceResume,
  jobDescription,
  analysisStale,
  warnings,
  busy,
  onSave,
  onJobDescriptionChange,
  onDismissWarning,
  onBackConfirmed,
}: Props) {
  const [resume, setResume] = useState(() => structuredClone(sourceResume));
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => setResume(structuredClone(sourceResume)), [sourceResume]);

  const mutate = (change: (draft: ResumeDocument) => void) => {
    setResume((current) => {
      const draft = structuredClone(current);
      change(draft);
      return draft;
    });
  };

  const restore = (section: ResumeSection) => {
    mutate((draft) => {
      Object.assign(draft, { [section]: structuredClone(original[section]) });
    });
  };

  const changed = (section: keyof ResumeDocument) =>
    JSON.stringify(resume[section]) !== JSON.stringify(original[section]);
  const targetCharacterCount = jobDescription.trim().length;
  const targetError =
    targetCharacterCount < 50
      ? `Enter at least 50 characters before comparison. ${targetCharacterCount} entered.`
      : null;

  const validate = (): string[] => {
    const next: string[] = [];
    if (!resume.contact.full_name.trim()) next.push("Contact: full name is required.");
    resume.work_experience.forEach((role, index) => {
      if (!role.title.trim() || !role.employer.trim())
        next.push(`Work experience ${index + 1}: title and employer are required.`);
      if (role.bullets.some((bullet) => !bullet.text.trim()))
        next.push(`Work experience ${index + 1}: empty bullets must be completed or removed.`);
    });
    resume.skills.forEach((group, index) => {
      if (group.items.length > 100)
        next.push(`Skills group ${index + 1}: use no more than 100 comma-separated skills.`);
    });
    resume.education.forEach((item, index) => {
      if (!item.institution.trim() || !item.credential.trim())
        next.push(`Education ${index + 1}: institution and credential are required.`);
    });
    resume.projects.forEach((project, index) => {
      if (!project.name.trim()) next.push(`Project ${index + 1}: project name is required.`);
      if (project.bullets.some((bullet) => !bullet.text.trim()))
        next.push(`Project ${index + 1}: empty bullets must be completed or removed.`);
    });
    resume.additional_sections.forEach((section, index) => {
      if (!section.title.trim()) next.push(`Additional section ${index + 1}: title is required.`);
    });
    return next;
  };

  const requestComparison = () => {
    const next = [...(targetError ? [targetError] : []), ...validate()];
    setErrors(next);
    if (next.length === 0) onSave(resume, true);
  };

  return (
    <section className="stage-enter review-workspace" aria-labelledby="review-title">
      {warnings.length > 0 && (
        <div className="warning-stack" role="region" aria-label="Parser warnings">
          {warnings.map((warning) => (
            <div className="parser-warning" role="status" key={warning}>
              <AlertTriangle aria-hidden="true" />
              <div>
                <strong>Check the extracted layout</strong>
                <span>{warning}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Dismiss warning: ${warning}`}
                onClick={() => onDismissWarning?.(warning)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="stage-intro review-intro">
        <span className="stage-kicker">Stage 2 · Fact check</span>
        <h2 id="review-title">Verify what was extracted</h2>
        <p>
          This is the working copy Beat ATS will compare. Inspect every field and correct parsing
          mistakes before requesting advisory analysis.
        </p>
      </div>

      <section className="target-description-panel" aria-labelledby="target-description-title">
        <div className="target-description-heading">
          <div>
            <h3 id="target-description-title">Target job description</h3>
            <p>Update this target before comparison. Your resume and accepted wording stay.</p>
          </div>
          <span id="target-description-count">
            {targetCharacterCount} / 50 minimum
          </span>
        </div>
        <label className="target-description-field">
          <span className="sr-only">Target job description</span>
          <textarea
            value={jobDescription}
            rows={7}
            aria-describedby="target-description-help target-description-count"
            aria-invalid={targetError ? true : undefined}
            onChange={(event) => onJobDescriptionChange(event.target.value)}
          />
        </label>
        <p id="target-description-help" className="target-description-help">
          A change clears generated suggestions, confirmations, and the Word file. Previous
          comparison results remain marked out of date until you request a new comparison.
        </p>
        {targetError && <p className="target-description-error">{targetError}</p>}
        {analysisStale && (
          <p className="target-description-stale" role="status">
            The previous advisory comparison is out of date. Request a new comparison before you
            use it.
          </p>
        )}
      </section>

      {errors.length > 0 && (
        <div className="field-errors" role="alert">
          <strong>Complete these fields before comparison</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <article className="resume-canvas">
        <header className="resume-contact-block">
          <TextField
            label="Full name"
            value={resume.contact.full_name}
            changed={resume.contact.full_name !== original.contact.full_name}
            onChange={(value) => mutate((draft) => (draft.contact.full_name = value))}
          />
          <div className="resume-contact-grid">
            <TextField
              label="Email"
              value={resume.contact.email ?? ""}
              onChange={(value) => mutate((draft) => (draft.contact.email = value || null))}
            />
            <TextField
              label="Phone"
              value={resume.contact.phone ?? ""}
              onChange={(value) => mutate((draft) => (draft.contact.phone = value || null))}
            />
            <TextField
              label="Location"
              value={resume.contact.location ?? ""}
              onChange={(value) => mutate((draft) => (draft.contact.location = value || null))}
            />
          </div>
          <ListEditor
            label="Links"
            values={resume.contact.links}
            max={10}
            emptyMessage="No links parsed. Add a portfolio or profile if it was missed."
            onChange={(values) => mutate((draft) => (draft.contact.links = values))}
          />
        </header>

        <Accordion
          type="multiple"
          defaultValue={[
            "summary",
            "experience",
            "skills",
            "education",
            "certifications",
            "projects",
            "additional",
          ]}
          className="resume-sections"
        >
          <ResumeSectionBlock
            value="summary"
            title="Professional summary"
            changed={changed("professional_summary")}
            onRestore={() => restore("professional_summary")}
          >
            <InlineEditor
              label="Professional summary"
              value={resume.professional_summary ?? ""}
              multiline
              placeholder="No professional summary parsed. Click to add one if it was missed."
              onChange={(value) => mutate((draft) => (draft.professional_summary = value || null))}
            />
          </ResumeSectionBlock>

          <ResumeSectionBlock
            value="experience"
            title="Work experience"
            count={resume.work_experience.length}
            changed={changed("work_experience")}
            onRestore={() => restore("work_experience")}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={resume.work_experience.length >= 30}
                onClick={() =>
                  mutate((draft) =>
                    draft.work_experience.push({
                      id: newId(),
                      employer: "",
                      title: "",
                      location: null,
                      start_date: null,
                      end_date: null,
                      bullets: [],
                    }),
                  )
                }
              >
                <Plus aria-hidden="true" /> Add role
              </Button>
            }
          >
            {resume.work_experience.length === 0 ? (
              <EmptyParsedState label="work experience" />
            ) : (
              resume.work_experience.map((role, roleIndex) => (
                <div className="document-entry" key={role.id}>
                  <div className="entry-action-row">
                    <span>Role {roleIndex + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="danger-text"
                      onClick={() => mutate((draft) => draft.work_experience.splice(roleIndex, 1))}
                    >
                      <Trash2 aria-hidden="true" /> Remove
                    </Button>
                  </div>
                  <div className="entry-grid">
                    <TextField
                      label="Job title"
                      value={role.title}
                      onChange={(value) =>
                        mutate((draft) => (draft.work_experience[roleIndex].title = value))
                      }
                    />
                    <TextField
                      label="Employer"
                      value={role.employer}
                      onChange={(value) =>
                        mutate((draft) => (draft.work_experience[roleIndex].employer = value))
                      }
                    />
                    <TextField
                      label="Location"
                      value={role.location ?? ""}
                      onChange={(value) =>
                        mutate(
                          (draft) => (draft.work_experience[roleIndex].location = value || null),
                        )
                      }
                    />
                    <TextField
                      label="Start date"
                      value={role.start_date ?? ""}
                      onChange={(value) =>
                        mutate(
                          (draft) => (draft.work_experience[roleIndex].start_date = value || null),
                        )
                      }
                    />
                    <TextField
                      label="End date"
                      value={role.end_date ?? ""}
                      onChange={(value) =>
                        mutate(
                          (draft) => (draft.work_experience[roleIndex].end_date = value || null),
                        )
                      }
                    />
                  </div>
                  <BulletEditor
                    label={`${role.title || `Role ${roleIndex + 1}`} bullets`}
                    bullets={role.bullets}
                    max={30}
                    onChange={(bullets) =>
                      mutate((draft) => (draft.work_experience[roleIndex].bullets = bullets))
                    }
                  />
                </div>
              ))
            )}
          </ResumeSectionBlock>

          <ResumeSectionBlock
            value="skills"
            title="Skills"
            count={resume.skills.length}
            changed={changed("skills")}
            onRestore={() => restore("skills")}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={resume.skills.length >= 30}
                onClick={() => mutate((draft) => draft.skills.push({ label: "", items: [] }))}
              >
                <Plus aria-hidden="true" /> Add group
              </Button>
            }
          >
            {resume.skills.length === 0 ? (
              <EmptyParsedState label="skills" />
            ) : (
              resume.skills.map((group, index) => (
                <div className="list-group-row" key={`skills-${index}`}>
                  <TextField
                    label="Group label"
                    value={group.label ?? ""}
                    onChange={(value) =>
                      mutate((draft) => (draft.skills[index].label = value || null))
                    }
                  />
                  <TextField
                    label="Skills (comma separated)"
                    value={group.items.join(", ")}
                    onChange={(value) =>
                      mutate((draft) => (draft.skills[index].items = compact(value.split(","))))
                    }
                  />
                  <IconRemove
                    label="Remove skill group"
                    onClick={() => mutate((draft) => draft.skills.splice(index, 1))}
                  />
                </div>
              ))
            )}
          </ResumeSectionBlock>

          <ResumeSectionBlock
            value="education"
            title="Education"
            count={resume.education.length}
            changed={changed("education")}
            onRestore={() => restore("education")}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={resume.education.length >= 20}
                onClick={() =>
                  mutate((draft) =>
                    draft.education.push({
                      institution: "",
                      credential: "",
                      field_of_study: null,
                      location: null,
                      dates: null,
                      details: [],
                    }),
                  )
                }
              >
                <Plus aria-hidden="true" /> Add education
              </Button>
            }
          >
            {resume.education.length === 0 ? (
              <EmptyParsedState label="education" />
            ) : (
              resume.education.map((item, index) => (
                <div className="document-entry" key={`education-${index}`}>
                  <div className="entry-action-row">
                    <span>Education {index + 1}</span>
                    <IconRemove
                      label="Remove education"
                      onClick={() => mutate((draft) => draft.education.splice(index, 1))}
                    />
                  </div>
                  <div className="entry-grid">
                    {(
                      [
                        ["Credential", "credential"],
                        ["Institution", "institution"],
                        ["Field of study", "field_of_study"],
                        ["Location", "location"],
                        ["Dates", "dates"],
                      ] as const
                    ).map(([label, key]) => (
                      <TextField
                        key={key}
                        label={label}
                        value={item[key] ?? ""}
                        onChange={(value) =>
                          mutate((draft) =>
                            Object.assign(draft.education[index], { [key]: value || null }),
                          )
                        }
                      />
                    ))}
                  </div>
                  <ListEditor
                    label="Education details"
                    values={item.details}
                    max={20}
                    emptyMessage="No education details parsed. Add one if needed."
                    onChange={(values) =>
                      mutate((draft) => (draft.education[index].details = values))
                    }
                  />
                </div>
              ))
            )}
          </ResumeSectionBlock>

          <ResumeSectionBlock
            value="certifications"
            title="Certifications"
            count={resume.certifications.length}
            changed={changed("certifications")}
            onRestore={() => restore("certifications")}
          >
            <ListEditor
              label="Certifications"
              values={resume.certifications}
              max={30}
              emptyMessage="No certifications parsed. Click '+' to add if missing."
              onChange={(values) => mutate((draft) => (draft.certifications = values))}
            />
          </ResumeSectionBlock>

          <ResumeSectionBlock
            value="projects"
            title="Projects"
            count={resume.projects.length}
            changed={changed("projects")}
            onRestore={() => restore("projects")}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={resume.projects.length >= 30}
                onClick={() =>
                  mutate((draft) =>
                    draft.projects.push({
                      id: newId(),
                      name: "",
                      role: null,
                      dates: null,
                      link: null,
                      bullets: [],
                    }),
                  )
                }
              >
                <Plus aria-hidden="true" /> Add project
              </Button>
            }
          >
            {resume.projects.length === 0 ? (
              <EmptyParsedState label="projects" />
            ) : (
              resume.projects.map((project, index) => (
                <div className="document-entry" key={project.id}>
                  <div className="entry-action-row">
                    <span>Project {index + 1}</span>
                    <IconRemove
                      label="Remove project"
                      onClick={() => mutate((draft) => draft.projects.splice(index, 1))}
                    />
                  </div>
                  <div className="entry-grid">
                    {(
                      [
                        ["Project name", "name"],
                        ["Role", "role"],
                        ["Dates", "dates"],
                        ["Link", "link"],
                      ] as const
                    ).map(([label, key]) => (
                      <TextField
                        key={key}
                        label={label}
                        value={project[key] ?? ""}
                        onChange={(value) =>
                          mutate((draft) =>
                            Object.assign(draft.projects[index], { [key]: value || null }),
                          )
                        }
                      />
                    ))}
                  </div>
                  <BulletEditor
                    label={`${project.name || `Project ${index + 1}`} bullets`}
                    bullets={project.bullets}
                    max={20}
                    onChange={(bullets) =>
                      mutate((draft) => (draft.projects[index].bullets = bullets))
                    }
                  />
                </div>
              ))
            )}
          </ResumeSectionBlock>

          <ResumeSectionBlock
            value="additional"
            title="Additional sections"
            count={resume.additional_sections.length}
            changed={changed("additional_sections")}
            onRestore={() => restore("additional_sections")}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={resume.additional_sections.length >= 20}
                onClick={() =>
                  mutate((draft) => draft.additional_sections.push({ title: "", items: [] }))
                }
              >
                <Plus aria-hidden="true" /> Add section
              </Button>
            }
          >
            {resume.additional_sections.length === 0 ? (
              <EmptyParsedState label="additional sections" />
            ) : (
              resume.additional_sections.map((section, index) => (
                <div className="document-entry" key={`additional-${index}`}>
                  <div className="entry-action-row">
                    <TextField
                      label="Section title"
                      value={section.title}
                      onChange={(value) =>
                        mutate((draft) => (draft.additional_sections[index].title = value))
                      }
                    />
                    <IconRemove
                      label="Remove additional section"
                      onClick={() => mutate((draft) => draft.additional_sections.splice(index, 1))}
                    />
                  </div>
                  <ListEditor
                    label={`${section.title || "Additional section"} items`}
                    values={section.items}
                    max={50}
                    emptyMessage="No items parsed. Add one if this section is incomplete."
                    onChange={(values) =>
                      mutate((draft) => (draft.additional_sections[index].items = values))
                    }
                  />
                </div>
              ))
            )}
          </ResumeSectionBlock>
        </Accordion>
      </article>

      <div className="sticky-action-bar">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="secondary">
              <ChevronLeft aria-hidden="true" /> Back to upload
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear this in-memory session?</AlertDialogTitle>
              <AlertDialogDescription>
                Returning to upload removes the extracted resume, job description, and every edit
                from this browser session. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
              <AlertDialogAction onClick={onBackConfirmed}>Clear and return</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <div>
          <span className="footer-assurance">Nothing is sent until you request comparison.</span>
          <Button type="button" size="lg" onClick={requestComparison} disabled={busy}>
            {busy ? "Comparing evidence…" : "Request advisory comparison"}
            <span aria-hidden="true">→</span>
          </Button>
        </div>
      </div>
    </section>
  );
}

function ResumeSectionBlock({
  value,
  title,
  count,
  changed,
  action,
  onRestore,
  children,
}: {
  value: string;
  title: string;
  count?: number;
  changed: boolean;
  action?: ReactNode;
  onRestore: () => void;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="resume-section">
      <div className="resume-section-heading">
        <AccordionTrigger>
          <span>{title}</span>
          {typeof count === "number" && <span className="section-count">{count}</span>}
          {changed && <span className="changed-badge">Edited</span>}
        </AccordionTrigger>
        <div className="section-actions">
          {action}
          {changed && (
            <Button type="button" variant="ghost" size="sm" onClick={onRestore}>
              <RotateCcw aria-hidden="true" /> Restore section
            </Button>
          )}
        </div>
      </div>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

function TextField({
  label,
  value,
  changed = false,
  onChange,
}: {
  label: string;
  value: string;
  changed?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`document-field ${changed ? "is-changed" : ""}`}>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
      <Pencil aria-hidden="true" />
    </label>
  );
}

function InlineEditor({
  label,
  value,
  placeholder,
  multiline = false,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <label className="inline-editor is-editing">
        <span className="sr-only">{label}</span>
        {multiline ? (
          <textarea
            autoFocus
            value={value}
            rows={4}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => setEditing(false)}
          />
        ) : (
          <input
            autoFocus
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={() => setEditing(false)}
          />
        )}
      </label>
    );
  }
  return (
    <button
      className={`inline-editor ${value ? "" : "is-empty"}`}
      type="button"
      onClick={() => setEditing(true)}
    >
      <span>{value || placeholder}</span>
      <Pencil aria-label={`Edit ${label}`} />
    </button>
  );
}

function BulletEditor({
  label,
  bullets,
  max,
  onChange,
}: {
  label: string;
  bullets: { id: string; text: string }[];
  max: number;
  onChange: (bullets: { id: string; text: string }[]) => void;
}) {
  return (
    <div className="bullet-list-editor">
      <span className="document-subheading">{label}</span>
      {bullets.length === 0 && <EmptyParsedState label="bullet points" compact />}
      {bullets.map((bullet, index) => (
        <div className="bullet-edit-row" key={bullet.id}>
          <span aria-hidden="true">•</span>
          <InlineEditor
            label={`${label}, bullet ${index + 1}`}
            value={bullet.text}
            placeholder="Click to add bullet wording."
            multiline
            onChange={(value) =>
              onChange(
                bullets.map((item) => (item.id === bullet.id ? { ...item, text: value } : item)),
              )
            }
          />
          <IconRemove
            label={`Remove bullet ${index + 1}`}
            onClick={() => onChange(bullets.filter((item) => item.id !== bullet.id))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={bullets.length >= max}
        onClick={() => onChange([...bullets, { id: newId(), text: "" }])}
      >
        <Plus aria-hidden="true" /> Add bullet
      </Button>
    </div>
  );
}

function ListEditor({
  label,
  values,
  max,
  emptyMessage,
  onChange,
}: {
  label: string;
  values: string[];
  max: number;
  emptyMessage: string;
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="list-editor">
      {values.length === 0 && (
        <EmptyParsedState label={label.toLowerCase()} message={emptyMessage} compact />
      )}
      {values.map((value, index) => (
        <div className="list-edit-row" key={`${label}-${index}`}>
          <InlineEditor
            label={`${label} ${index + 1}`}
            value={value}
            placeholder="Click to enter a value."
            onChange={(next) =>
              onChange(values.map((item, itemIndex) => (itemIndex === index ? next : item)))
            }
          />
          <IconRemove
            label={`Remove ${label.toLowerCase()} ${index + 1}`}
            onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={values.length >= max}
        onClick={() => onChange([...values, ""])}
      >
        <Plus aria-hidden="true" /> Add {label.toLowerCase().replace(/s$/, "")}
      </Button>
    </div>
  );
}

function EmptyParsedState({
  label,
  message,
  compact: isCompact = false,
}: {
  label: string;
  message?: string;
  compact?: boolean;
}) {
  return (
    <div className={`parsed-empty-state ${isCompact ? "is-compact" : ""}`}>
      <Plus aria-hidden="true" />
      <span>{message ?? `No ${label} parsed. Click '+' to add if missing.`}</span>
    </div>
  );
}

function IconRemove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick}>
      <Trash2 aria-hidden="true" />
    </Button>
  );
}
