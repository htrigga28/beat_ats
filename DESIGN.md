---
name: Beat ATS
description: A high-contrast resume verification studio for truthful, controlled tailoring.
colors:
  canvas: "#F8FAFC"
  surface: "#FFFFFF"
  ink: "#0F172A"
  muted: "#475569"
  rule: "#E2E8F0"
  indigo: "#4F46E5"
  indigo-deep: "#4338CA"
  emerald: "#059669"
  amber: "#D97706"
  error: "#DC2626"
typography:
  family: "Inter Variable, ui-sans-serif, system-ui, sans-serif"
  display: "30px / 36px, 650"
  title: "24px / 32px, 650"
  section: "20px / 28px, 650"
  body: "16px / 24px, 400"
  small: "14px / 20px, 400"
rounded:
  control: "6px"
  surface: "12px"
  dialog: "8px"
spacing:
  unit: "4px"
  compact: "8px"
  control: "12px"
  section: "24px"
  workspace: "32px"
  page: "48px"
---

# Beat ATS design system

## Visual contract

**Thesis.** Beat ATS is a verification studio, not a score game. The interface makes
source material, advisory evidence, proposed wording, and accepted edits visibly
distinct while keeping the next safe action obvious.

**Own world.** Cool Slate work surfaces, sharp white document canvases, precise Indigo
controls, Emerald confirmation marks, and Amber verification warnings. Soft-square
geometry, compact enterprise density, and restrained elevation create a clinical but
approachable working environment.

**Story.** A candidate brings a document into a private workspace, verifies every fact,
compares evidence with one role, applies only truthful wording, and signs off before a
parseable Word file is created.

**First viewport.** A fixed-height application header contains the brand and non-clickable
four-stage register. The active stage fills a centered workspace up to 1280px. Upload is
a balanced source/job-description split; document-heavy stages use the full width.

**Form.** Operate surface. Familiar controls and scanability outrank decorative expression.
The supplied Stitch revamp establishes the composition; misleading prototype claims and
persistence controls are excluded.

## Palette

- **Slate 50 / Canvas (`#F8FAFC`)** — full application background.
- **White / Surface (`#FFFFFF`)** — document canvas and focused work surfaces.
- **Slate 900 / Ink (`#0F172A`)** — primary copy and structural anchors.
- **Slate 600 / Muted (`#475569`)** — supporting instructions and metadata.
- **Slate 200 / Rule (`#E2E8F0`)** — outlines, separators, and inactive steps.
- **Indigo 600 (`#4F46E5`)** — primary actions, focus, active navigation, and advisory data.
- **Indigo 700 (`#4338CA`)** — hover and pressed primary controls.
- **Emerald 600 (`#059669`)** — applied wording, confirmed truth, matched terms, and high alignment.
- **Amber 600 (`#D97706`)** — parsing warnings, missing evidence, and unverified states.
- **Red 600 (`#DC2626`)** — destructive actions and errors only.

Color never communicates status alone. Every state also uses text, iconography, or a
structural change. Scores remain explicitly advisory: 80–100 uses Emerald, 60–79 Indigo,
and 0–59 Amber without pass/fail language.

## Typography

Inter Variable is bundled locally. The body defaults to 16px/24px with Slate 900 copy.
Page titles use 30px/36px, section titles 20px/28px, and metadata 14px/20px. Resume
content stays within a 65–75 character reading measure. Uppercase tracking is reserved
for compact metadata and status labels, not routine headings.

## Layout

- Maximum workspace width: 1280px with 24px desktop gutters and 16px mobile gutters.
- Spacing follows an 8px rhythm with 4px increments inside compact controls.
- The application stepper remains visible and informational; explicit buttons control
  navigation.
- Sticky stage action bars keep the recovery and primary actions in view.
- Desktop tailoring uses equal split panes. Below 1024px it becomes an accessible
  Resume/Suggestions tabbed workspace.
- Document editors use progressive disclosure and `content-visibility` for long sections.
- No horizontal scrolling at 320px or wider.

## Shape and depth

Controls use 6px radii, dialogs 8px, and major work surfaces 12px. Chips alone may be
pill-shaped. Surfaces use either a Slate 200 border or a soft offset shadow; nested
border-and-shadow cards are avoided. Modals and sticky action bars receive the strongest
elevation because they interrupt or protect state.

## Interaction and motion

- Stage entry: opacity plus 12px vertical movement, 300ms exponential ease-out.
- Drag-over: dashed Slate border becomes solid Indigo and the target scales to 0.99 over 200ms.
- Accordions: height reveal over 300ms ease-in-out.
- Applied wording: one 1000ms Emerald confirmation wash on the changed bullet.
- Progress uses real upload percentage and streamed backend milestones; no fake looping progress.
- `prefers-reduced-motion` removes transforms and shortens nonessential transitions.

Motion confirms direction, state change, or causality. It is never applied as decoration.

## Component rules

### Application shell

Show Beat ATS, the non-clickable four-stage register, privacy status, API help, and Clear
Session. Do not show accounts, saved drafts, persistence, or a theme toggle.

### Buttons and controls

Primary buttons are Indigo with white copy; secondary buttons are white with Slate 200
outlines; destructive text/actions are Red. Controls have visible labels, 44px minimum
touch height where practical, and a two-pixel Indigo focus ring with adequate offset.

### Document editor

Read mode resembles a precise resume canvas. Hover and keyboard focus reveal an edit
affordance; activation exposes labelled native inputs rather than `contenteditable`.
Changed blocks show a text label and reset action. Empty optional sections remain visible
with a dashed add affordance.

### Advisory analysis

Scores, title alignment, gaps, and recommendations are compact evidence—not celebratory
metrics. Missing evidence uses Amber. Equivalent titles remain explicitly advisory.

### Tailoring studio

The left pane owns source bullets and selection. The right pane owns original wording and
AI proposals. Emerald keyword treatment appears only when the returned keyword exists in
the proposal. Nothing updates the resume until Apply Wording is used.

### Export proof

The preview represents every populated section in the generated DOCX order. Truth and
advisory acknowledgements are required before compile/download. The interface never
promises a hiring outcome or presents a vendor ATS score.

## Accessibility and resilience

- All functionality is available to keyboard and touch users; hover is enhancement only.
- Stage changes move focus to the new stage heading.
- Busy overlays and destructive dialogs manage and restore focus.
- Status changes use appropriate live regions without repeatedly announcing cosmetic updates.
- Errors identify the problem, consequence, and recovery action.
- Long resumes, empty resumes, network errors, streamed failures, stale analysis, selection
  limits, and reduced-motion preferences are first-class states.

## Anti-patterns

- No gradients, glass effects, gamification, nested card grids, decorative metric rings,
  or looping spinners.
- No Save Draft, account avatar, PDF export, hidden persistence, or fabricated scores.
- No AI wording is pre-applied or auto-selected.
- No incomplete preview that differs materially from the downloaded document.
