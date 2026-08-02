import type { ResumeDocument } from "../types";

export function ResumePreview({ resume }: { resume: ResumeDocument }) {
  const contactLine = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    ...resume.contact.links,
  ].filter(Boolean);
  return (
    <article className="final-resume-preview" aria-label="Final resume preview">
      <header>
        <h3>{resume.contact.full_name}</h3>
        {contactLine.length > 0 && <p>{contactLine.join(" · ")}</p>}
      </header>
      {resume.professional_summary && (
        <PreviewSection title="Professional summary">
          <p>{resume.professional_summary}</p>
        </PreviewSection>
      )}
      {resume.work_experience.length > 0 && (
        <PreviewSection title="Work experience">
          {resume.work_experience.map((role) => (
            <div className="preview-entry" key={role.id}>
              <div>
                <h5>{role.title}</h5>
                <strong>{role.employer}</strong>
              </div>
              <p className="preview-meta">
                {[role.location, [role.start_date, role.end_date].filter(Boolean).join(" — ")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {role.bullets.length > 0 && (
                <ul>
                  {role.bullets.map((bullet) => (
                    <li key={bullet.id}>{bullet.text}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </PreviewSection>
      )}
      {resume.skills.length > 0 && (
        <PreviewSection title="Skills">
          {resume.skills.map((group, index) => (
            <p key={`${group.label}-${index}`}>
              {group.label && <strong>{group.label}: </strong>}
              {group.items.join(", ")}
            </p>
          ))}
        </PreviewSection>
      )}
      {resume.education.length > 0 && (
        <PreviewSection title="Education">
          {resume.education.map((item, index) => (
            <div className="preview-entry" key={`${item.institution}-${index}`}>
              <div>
                <h5>{item.credential}</h5>
                <strong>{item.institution}</strong>
              </div>
              <p className="preview-meta">
                {[item.field_of_study, item.location, item.dates].filter(Boolean).join(" · ")}
              </p>
              {item.details.length > 0 && (
                <ul>
                  {item.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </PreviewSection>
      )}
      {resume.certifications.length > 0 && (
        <PreviewSection title="Certifications">
          <ul>
            {resume.certifications.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </PreviewSection>
      )}
      {resume.projects.length > 0 && (
        <PreviewSection title="Projects">
          {resume.projects.map((project) => (
            <div className="preview-entry" key={project.id}>
              <div>
                <h5>{project.name}</h5>
                {project.role && <strong>{project.role}</strong>}
              </div>
              <p className="preview-meta">
                {[project.dates, project.link].filter(Boolean).join(" · ")}
              </p>
              {project.bullets.length > 0 && (
                <ul>
                  {project.bullets.map((bullet) => (
                    <li key={bullet.id}>{bullet.text}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </PreviewSection>
      )}
      {resume.additional_sections.map((section, index) => (
        <PreviewSection title={section.title} key={`${section.title}-${index}`}>
          {section.items.length > 0 && (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </PreviewSection>
      ))}
    </article>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4>{title}</h4>
      {children}
    </section>
  );
}
