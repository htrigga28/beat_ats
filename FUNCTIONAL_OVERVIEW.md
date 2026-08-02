# Beat ATS: Current Product Functionality

## Document purpose

This document describes the application as it works today. It is intended to be the
functional foundation for a new UI design specification: what the product must help a
user do, what information each stage contains, which states the interface must
represent, and where the current experience has functional or presentation gaps.

This is a current-state document, not a visual design proposal. Items under **Current
limitations** and **Design implications** should inform the redesign without being
treated as fixed requirements.

## Product summary

Beat ATS is a private, single-user web application for tailoring an existing resume to
one target job description. It converts a PDF or DOCX resume into structured data,
helps the user verify that data, compares the resume with the target role, proposes
evidence-constrained alternatives for selected work-experience bullets, and exports an
ATS-safe Word document.

The product is built around user control and factual integrity:

- AI can extract, compare, and propose wording, but it does not silently apply edits.
- The user is expected to verify extracted content and approve each rewrite.
- Match results are advisory and are not represented as results from a specific ATS.
- Resume and job-description data exist only for the current in-memory session.

## Primary user and job to be done

The current release serves one job seeker using a private deployment.

> When applying for a specific role, I want to understand how well my current resume
> reflects the role, improve only the experience I can truthfully support, and download
> a clean Word resume without losing control of my facts.

## End-to-end workflow

The application is a linear, four-stage workflow:

1. **Upload** — provide a resume and target job description, then grant the required AI
   processing consent.
2. **Review** — inspect and edit the structured resume, then request an advisory
   comparison.
3. **Tailor** — select up to ten work-experience bullets, review AI alternatives, and
   explicitly apply chosen wording.
4. **Export** — perform a final truth check, generate an ATS-safe DOCX, and download it.

The user can move backward from Tailor to Review and from Export to Tailor. The stage
register communicates progress but is not currently interactive. Returning to Upload
requires clearing or refreshing the session.

## Core functional areas

### 1. Resume and job intake

The user provides both source materials required for the workflow:

- One PDF or DOCX resume.
- One target job description with at least 50 characters.
- Consent to send resume content and the job description to Gemini.
- Optional permission to send a scanned PDF to Gemini as inline visual input when no
  usable text can be extracted locally.

The interface loads deployment-specific configuration before submission and displays:

- Accepted file extensions.
- Maximum upload size.
- Whether visual PDF processing is available.
- The configured Gemini model.

The backend validates file type, file size, encryption, corruption, parseability, and
AI consent. The default local and Docker upload limit is 10 MiB; the current Vercel
deployment configuration uses 4 MiB.

### 2. Resume extraction and structuring

For text-based PDFs and DOCX files, the application extracts text locally and sends the
text to Gemini for schema-constrained structuring. If a PDF has insufficient selectable
text, the application can send the original PDF inline to Gemini only when the user has
granted the separate visual-processing permission.

The structured resume model supports:

- Contact information: full name, email, phone, location, and links.
- Professional summary.
- Work experience: employer, title, location, dates, and bullets.
- Grouped skills.
- Education and education details.
- Certifications.
- Projects and project bullets.
- Additional titled sections with list items.

Extraction is instructed to preserve source facts and wording rather than improve or
invent content. The application may return parsing warnings for the user to review.

### 3. Resume fact-checking and editing

After extraction, the application presents the resume as an editable form. The user
can correct the structured content before it is analyzed or exported.

The current editor exposes:

- Contact information and links.
- Professional summary.
- Work-experience roles and bullets.
- Skill groups and skill items.
- Education entries and details.
- Certifications.
- Projects and project bullets.

The user can remove work-experience roles, education entries, and projects. They can
save changes without analysis or save and immediately request analysis. Required field
validation currently covers the candidate name and the title and employer for each
work-experience role.

If an analyzed resume is edited and saved, the interface marks the existing analysis as
stale. Saving also clears previously generated rewrites and any generated DOCX because
those outputs no longer correspond to the current resume.

### 4. Resume-to-role analysis

The user can request an evidence-based comparison between the verified resume and the
target job description. The result contains:

- An estimated match score from 0 to 100.
- Material keyword gaps, each with a category and explanation of importance.
- Target-title alignment: aligned, partially aligned, or not aligned.
- A rationale for the title assessment.
- Up to five advisory equivalent-title suggestions.
- Three to five highest-impact improvement recommendations.

The scoring rubric used by the AI is fixed in the backend prompt:

- Skills and tools: 35%.
- Responsibilities: 35%.
- Title and seniority: 15%.
- Domain, soft skills, and education: 15%.

The interface explicitly states that the result is an advisory estimate rather than a
score from a named ATS provider. If the underlying resume changes, the interface warns
that the previous analysis should be re-run before it is relied on.

### 5. Evidence-constrained bullet tailoring

The tailoring stage operates only on work-experience bullets. The user can select up to
ten bullets per rewrite request. For each selected bullet, Gemini returns two or three
alternatives that are intended to:

- Preserve the original fact and tense.
- Remain at or below 40 words.
- Use no more than two supported job-description keywords.
- Avoid inventing metrics, dates, employers, clients, titles, tools,
  responsibilities, or outcomes.

The backend additionally rejects a rewrite response when it changes the source bullet
reference, omits or adds selected bullet IDs, returns duplicate alternatives, or
introduces numeric facts that did not appear in the source bullet.

The user reviews each source bullet beside its alternatives, selects one alternative
per bullet, and applies the choices explicitly. The first returned alternative is
preselected by the current implementation, but no content changes until the user uses
the apply action. The user can also continue to export without requesting or applying
more rewrites.

Applying alternatives updates the in-memory resume, moves the workflow to Export, and
marks the earlier analysis as stale.

### 6. Final proof and DOCX export

The final stage shows:

- The number of changed work-experience bullets compared with the originally extracted
  resume.
- A truth-check reminder to verify every metric and statement.
- A stale-analysis warning with an action to re-run analysis when applicable.
- An on-screen preview of the candidate name, links, professional summary, work
  experience, and skills.
- A visible marker beside changed work-experience bullets.

The user then generates and downloads `tailored_resume.docx`. Generation is
deterministic and does not require another AI request.

The Word document includes all populated structured sections, including education,
certifications, projects, and additional sections. It uses a single-column layout,
Arial typography, real Word paragraphs and bullets, standard page geometry, and no
tables, images, headers, footers, text boxes, hidden text, or white-font content.

### 7. Session, privacy, and data handling

The product has no accounts, database, saved documents, or history. Uploaded bytes are
processed in request memory. The browser keeps the structured resume, job description,
analysis, rewrite choices, and generated file only in application memory.

The interface provides a global **Clear session** action. Clearing or refreshing the
page removes the working document. The application does not intentionally use cookies,
local storage, session storage, IndexedDB, a service worker, an application result
cache, or a Gemini context cache for resume data.

Prompt bodies, resume text, job descriptions, and model responses are not logged. API
request metadata includes a request ID, method, path, and response status.

### 8. Loading, errors, and recovery

Only one application request is treated as active at a time. Beginning a new request
cancels the prior one. The UI provides contextual status messages for configuration
loading, extraction, analysis, rewrite generation, and DOCX generation.

Errors are normalized into a user-facing message with:

- A retryable or non-retryable presentation.
- A retry action when the failed operation is safe to repeat.
- A request ID when one is available for troubleshooting.

Expected error cases include unavailable AI configuration, missing consent, unsupported
or oversized files, encrypted or corrupt documents, scanned PDFs without visual
permission, provider rate limits, provider outages, invalid AI output, and network
failure.

## Current information architecture

### Global application shell

- Product name and truth-focused tagline.
- Clear-session action.
- Four-stage progress register with completed, current, and pending states.
- Current stage title and active-request status.
- Global error or retry message.
- In-memory privacy reminder and API documentation link.

### Stage-level content

| Stage | Primary content | Primary action | Secondary actions |
| --- | --- | --- | --- |
| Upload | File, job description, privacy note, runtime limits, consent | Extract resume | None |
| Review | Extraction warnings, structured resume editor, analysis result | Save & analyze | Save edits; continue after analysis |
| Tailor | Selectable source bullets, generated alternatives | Generate alternatives / apply choices | Back to Review; continue without more rewrites |
| Export | Change summary, truth warning, preview | Generate Word file / download | Re-run stale analysis; back to Tailor |

## Important product states for the UI specification

The redesign should define a clear visual and interaction treatment for each of these
states:

- Deployment settings loading, loaded, or unavailable.
- Empty intake form, locally invalid form, and ready-to-submit form.
- Resume extraction in progress.
- Text extraction success, extraction success with warnings, and scanned-PDF permission
  required.
- Long populated resume with repeated roles, bullets, education, and projects.
- Unsaved editor changes, saved changes, and invalid required fields.
- Analysis absent, loading, available, stale, empty-gap, or failed.
- No bullets selected, one to ten selected, and selection limit reached.
- Rewrite generation in progress, alternatives available, choices selected, and choices
  applied.
- Final proof with zero changes, one change, or multiple changes.
- DOCX not generated, generating, ready to download, or invalidated by later edits.
- Retryable error, non-retryable error, and session cleared.
- Narrow-screen layouts and keyboard-focus states throughout the workflow.

## Current limitations and functional gaps

These are properties of the implementation today, not necessarily desired future
behavior:

- There are no user accounts, authentication, saved projects, history, autosave, or
  cross-device continuation.
- The app handles one resume and one job description per session.
- The workflow stage register is informational and cannot be used for navigation.
- The target job description cannot be reviewed or edited after successful ingestion
  without starting a new session.
- The resume editor can remove some repeated records but has no controls to add roles,
  bullets, skill groups, education entries, projects, or project bullets.
- Additional resume sections are supported by extraction and DOCX generation but are
  not exposed in the current editor.
- Tailoring is limited to work-experience bullets; summaries, skills, projects, and
  other sections do not receive rewrite alternatives.
- The UI does not visibly display each rewrite alternative's `incorporated_keywords`
  metadata.
- The final on-screen proof is incomplete: it omits email, phone, location, education,
  certifications, projects, and additional sections even though the DOCX can contain
  them.
- The change counter and accepted-change markers cover work-experience bullets only;
  manual edits elsewhere are not summarized.
- There is no side-by-side whole-document diff, undo history, restore-original action,
  or per-change rejection after alternatives have been applied.
- The downloadable format is DOCX only. There is no PDF export or selectable resume
  template.
- There is no local OCR; scanned PDF handling depends on Gemini visual processing and
  separate user permission.
- There is no independent ATS parsing test, vendor-specific score, application tracker,
  job-board integration, or hiring-outcome prediction.

## Design implications for the next UI specification

The redesign should preserve the underlying safety model while reducing the amount of
effort and uncertainty in the current long-form workflow.

### Make the primary journey unmistakable

At every stage, the user should understand what they are doing, what information will
be sent to AI, what changed, and what the single next best action is. Backward
navigation and session-reset consequences should be explicit.

### Design for dense document work

Review and tailoring can contain many repeated fields and long bullets. The design
specification should address scanning, section navigation, progressive disclosure,
sticky context or actions, and responsive behavior for genuinely long resumes—not only
the empty or short happy path.

### Separate source, analysis, suggestion, and accepted content

These four content types have different levels of authority and must never blur
together. Their labels, placement, and states should communicate that distinction
without relying on color alone.

### Make change control first-class

The redesign should make it easy to compare original and proposed text, understand why
a suggestion may help, accept or decline it, review all accepted changes, and recover
from a mistaken choice. Any future undo or restore behavior should be specified
explicitly.

### Resolve preview and editor coverage

The UI specification should decide whether every supported resume section can be added,
edited, reordered, removed, previewed, and included in export. The final proof should
accurately represent the content that will be downloaded.

### Treat trust and privacy as functional interface content

Consent, AI transmission, visual-PDF processing, session ephemerality, stale results,
and the advisory nature of the score should be understandable at the point of action,
without overwhelming the main task.

### Specify complete state behavior

Loading, empty, error, stale, invalidated, selected, accepted, disabled, and success
states need designed behavior and copy. The UI should not rely on a spinner or color as
the only explanation of what is happening.

### Preserve accessibility requirements

The current implementation uses visible labels, semantic field groups, focus styles,
status announcements, stage-heading focus on navigation, and a responsive single-column
fallback. The next specification should retain keyboard access, clear focus treatment,
sufficient contrast, non-color status cues, readable line lengths, and layouts that do
not introduce horizontal scrolling on narrow screens.

## Non-negotiable product principles

- Do not invent candidate facts.
- Do not silently replace source content with AI output.
- Do not imply that an advisory comparison guarantees ATS or hiring success.
- Do not use keyword stuffing, hidden text, or other ATS manipulation tactics.
- Require explicit consent before AI processing and separate permission for scanned-PDF
  visual processing.
- Keep stale analysis and invalidated outputs visible.
- Keep exported documents structurally simple and conventionally parseable.
- Make destructive session clearing and irreversible content changes understandable.

## Recommended outputs from the UI design specification

The next design phase should produce:

- A revised end-to-end user flow, including backward navigation and recovery paths.
- Screen specifications for Upload, Review, Analysis, Tailor, and Final Proof/Export.
- A decision on whether Analysis remains inside Review or becomes a distinct workspace.
- A complete resume-section management model: add, edit, remove, reorder, and restore.
- A comparison and change-review interaction model.
- Component specifications for navigation, document editors, source content,
  suggestions, analysis results, consent, warnings, errors, loading, and downloads.
- Responsive layouts for desktop and narrow screens.
- Keyboard, focus, screen-reader, validation, and status-announcement behavior.
- Content rules for AI disclaimers, privacy, stale results, score interpretation, and
  truth verification.
- A full state matrix and clickable prototype covering both the happy path and major
  recovery paths.

## Source of truth

This overview was derived from the current React workflow and state model, FastAPI
routes and schemas, extraction and DOCX generation logic, automated tests, and the
existing product and design notes in this repository. Where those notes and the UI
differ, this document describes the implemented behavior and lists the difference as a
current limitation.
