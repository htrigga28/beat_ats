# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The first release serves one job seeker in a private deployment. The user uploads an
existing resume, compares it with a target frontend job description, reviews AI
suggestions, and downloads an ATS-safe tailored Word document.

## Product Purpose

Beat ATS helps a candidate identify meaningful resume gaps and rewrite selected work
experience bullets without fabricating their history. Success means the user can move
from an uploaded PDF or DOCX and a job description to a verified, parseable DOCX while
remaining in control of every factual change.

## Positioning

The product combines strict structured resume data, evidence-constrained rewriting,
and deterministic ATS-safe document generation. It does not use keyword stuffing,
hidden text, or automatic factual invention.

## Operating Context

The application runs as a React single-page frontend backed by a private FastAPI
service. It uses Gemini for structured extraction, gap analysis, and selected bullet
alternatives. Resume data is held only in request memory and browser state; users can
clear the session at any point.

## Capabilities and Constraints

- Accept text-based PDF and DOCX resumes up to 10 MB; scanned PDFs require explicit
  consent for inline Gemini vision processing.
- Keep every extracted resume field editable before analysis or export.
- Treat match scores as advisory estimates, not vendor ATS scores.
- Require explicit application of each AI rewrite and an explicit action to re-analyze.
- Generate single-column DOCX output without tables, images, headers, footers, text
  boxes, hidden text, or white-font content.
- The first release has no accounts, database, saved history, public sharing, or local
  OCR.

## Evidence on Hand

- The candidate's source resume is available locally as
  `Holyworth_Akhigbe_Frontend_resume.pdf` and must never be committed.
- No customer claims, ATS benchmark data, logos, testimonials, or brand assets exist;
  future work must not fabricate them.

## Product Principles

- Candidate truth is immutable unless the user explicitly edits it.
- Show evidence and limitations instead of promising an ATS outcome.
- Keep AI costs and data transmission visible and user-controlled.
- Make the shortest safe path through upload, review, tailor, and export obvious.
- Prefer robust document semantics over decorative formatting.

## Accessibility & Inclusion

All controls require visible labels, keyboard access, readable focus treatment, clear
error recovery, and sufficient contrast. The workflow must remain usable on narrow
screens and must not communicate status through color alone.
