# Platform Hardening And Purposeful Motion

## Status

- Type: improvement
- Implementation delegation: always
- Delegation source: repository kickoff configuration, confirmed by the user
- Planning worker: `gpt-5.6-sol` with high reasoning
- Planning worker source: `.agent/kickoff/kickoff.yaml`
- Review worker: `gpt-5.6-sol` with high reasoning in fresh sessions
- Review worker source: `.agent/kickoff/kickoff.yaml`
- Implementation worker: `gpt-5.6-terra` with xhigh reasoning
- Implementation worker source: `.agent/kickoff/kickoff.yaml`
- Planning mode: full
- Worktree manager: Forest
- Branch: `codex/platform-hardening-motion`
- Worktree path: `C:\Users\ASUS\Desktop\projects\beat_ats\.forest\worktrees\codex\platform-hardening-motion`
- Task workspace: `C:\Users\ASUS\Desktop\projects\beat_ats\.forest\worktrees\codex\platform-hardening-motion\.agent\kickoff`
- Created: 2026-08-25
- Target date: not specified; the work is feasible but needs full regression and browser validation
- Current phase: implementation

## Objective

Make Beat ATS a safer and more useful private resume-tailoring tool. Fix the gaps found by the adversarial, simplicity, and end-to-end reviews. Add restrained GSAP motion that explains progress, state changes, and accepted edits without slowing the user.

## Context

The baseline already rejects empty DOCX files, validates duplicate identifiers, keeps vision settings consistent, supports repeated DOCX downloads, serves the compiled frontend through FastAPI, and passes the existing local checks. The current browser suite mocks every API response, so it does not prove that the compiled frontend, FastAPI routes, document parser, fake Gemini service, and DOCX generator work together.

The product is a private, single-user application. It must not gain accounts, saved history, a database, or public sharing. Resume data must remain in request memory and browser memory. The supplied resume is test input only and must not be committed.

## Requirements

- Add one real local end-to-end test from the compiled SPA through FastAPI with a deterministic fake Gemini service. Use `C:\Users\ASUS\Desktop\projects\beat_ats\Holyworth_Akhigbe_Frontend_resume.pdf` when it is available.
- Use current public job descriptions as realistic test input. At minimum, cover a React and TypeScript frontend role from a direct employer or application page.
- Verify that the generated DOCX contains the reviewed resume content in the expected section order. Keep the output parseable and repeatably downloadable.
- Let the user edit the target job description after upload without uploading the resume again. Mark earlier analysis and rewrites as stale or clear them before reuse.
- Resolve the contract mismatch for project bullets. Keep project-bullet tailoring because the current backend, frontend, and tests already support it. Update product documentation to match the implemented behavior.
- Review the non-streaming resume ingestion route. Remove it only if the frontend and tests have no required consumer. Keep one ingestion path when possible.
- Resolve the current high-severity `nanoid` advisory with the smallest supported dependency or lockfile update. Do not add a custom package-management layer.
- Define a safe private-deployment boundary. Do not build an account system. Prefer hosting-provider access controls and clear fail-safe deployment documentation over application authentication unless repository evidence proves that code-level protection is required.
- Add purposeful GSAP motion. Use one focal workflow transition plus small action acknowledgements. Motion must support stage continuity, analysis arrival, applied wording, and export completion where those states exist.
- Preserve the current Beat ATS design system, content hierarchy, keyboard behavior, narrow-screen behavior, and reduced-motion path.
- Run Impeccable's detector once after UI implementation. Run Ponytail Full before edits and Ponytail Review on the complete diff.
- Keep documentation in ADS-STE100 Simplified Technical English.

## Acceptance Criteria

- A test drives the built frontend against a real FastAPI process and deterministic fake Gemini behavior without intercepting the tested API requests in Playwright.
- The supplied PDF completes upload, review, analysis, optional rewrite, export, and repeated download in the real integration test.
- At least two current online frontend job descriptions are recorded as sample sources. Tests use stable local excerpts so external site changes do not make the suite flaky.
- The downloaded DOCX can be opened and its text matches the approved UI model for every populated section that the generator supports.
- The user can change the job description after extraction. The UI clearly invalidates old analysis, generated suggestions, acknowledgements, and generated files.
- Product and functional documentation agree on work-experience and project-bullet tailoring.
- The application has one required resume-ingestion path unless a documented compatibility need justifies both routes.
- `npm audit --omit=dev` reports no known high or critical production advisory from the current dependency graph, or the plan records a verified upstream blocker and safe containment.
- The motion thesis is specific to the four-stage verification workflow. Routine feedback completes within 100-300 ms. A focal transition stays within 500-800 ms. Reduced motion removes spatial movement and keeps state feedback clear.
- Existing accessibility, responsive, unit, API, type, lint, build, and browser checks pass. The new integration test also passes.
- No resume, job description, generated DOCX, API key, or private test artifact is committed.

## Evidence And Sources

- Product contract: `PRODUCT.md`
- Design contract: `DESIGN.md`
- Detailed behavior: `FUNCTIONAL_OVERVIEW.md`
- Backend routes and Gemini seams: `analyzer.py`
- Document generator: `generator.py`
- Frontend state and workflow: `frontend/src/SessionContext.tsx`, `frontend/src/state.ts`, and `frontend/src/App.tsx`
- Existing mocked browser coverage: `frontend/e2e/`
- Existing deployment files: `DEPLOYMENT.md`, `Dockerfile`, `compose.yaml`, and `vercel.json`
- Current dependency evidence: `npm audit --omit=dev` reports `nanoid <3.3.18` through the production dependency graph.
- Supplied test resume: `C:\Users\ASUS\Desktop\projects\beat_ats\Holyworth_Akhigbe_Frontend_resume.pdf`
- Current sample roles: Canonical Senior/Staff/Principal Engineer and Relay Senior Frontend Developer application pages.
- Mobbin reference, upload clarity: https://mobbin.com/screens/1bdd29a4-be46-42e8-a7b2-1222d9d667cf
- Mobbin reference, suggestion comparison: https://mobbin.com/screens/59508691-835e-43bb-8dca-f4f6c8b08bc0
- Mobbin reference, side-by-side comparison: https://mobbin.com/screens/ed82aafc-c4dc-442d-87fc-359f7347f940
- Mobbin reference, candidate flow: https://mobbin.com/flows/89235c83-e8c6-42b9-a018-3804608641d7

## Decisions

- Keep the private single-user product boundary.
- Keep project-bullet tailoring and correct the documents.
- Use stable local job-description excerpts in tests. Keep source links for traceability.
- Add GSAP only for motion that needs sequencing or interruption. Keep simple hover and focus states in CSS.
- Prefer one real integration scenario over a second large test harness.
- Use the existing FastAPI dependency override seam for deterministic fake Gemini behavior where possible.
- Treat the documented non-streaming ingestion route as having no supported external consumer. The product is a private single-user application, and the repository has no caller. Remove the route, API type, test, and documentation as one accepted breaking-change unit.
- Make the deployer the owner of the signed-out provider-protection check. If the deployer cannot record denial for the page, config route, and one sensitive POST route, the release remains localhost-only and must not process a real resume.

## Adversarial Review Dispositions

- Accepted, Major: protect target edits from late analysis, rewrite, or DOCX completions. Add a request-generation or equivalent cancellation guard and a delayed-response regression test.
- Accepted, Major: generate the synthetic PDF at test runtime with the existing Python tooling. Do not add an ignored binary fixture or a broad ignore exception.
- Accepted, Major: update `FUNCTIONAL_OVERVIEW.md` for editable job descriptions, invalidation, recovery, and current limitations.
- Accepted, Major: move Ponytail Full to a Phase 0 gate before all implementation edits. Keep Ponytail Review in final validation.
- Accepted, Minor: require one applied rewrite in the real-stack scenario. Assert that the DOCX contains the accepted text and not the replaced text. State that equal bytes prove repeat download from the retained Blob only.
- Accepted, Minor: run the integration server from the repository root and make the exact `frontend/dist` build the test-only static source. Do not reuse an existing server.
- Accepted, Minor: add direct tests for forward and backward motion, interrupted transitions, React Strict Mode cleanup, and computed reduced-motion styles.
- Accepted, Minor: treat provider protection as a manual release gate with a named deployer result. Keep localhost as the fail-closed result.
- Accepted, Question: remove the non-streaming ingestion contract as one coherent breaking-change and rollback unit because this private product has no supported external API consumer.
- Accepted, Minor: define rollback by complete commit or file set, including code, tests, API types, package files, documentation, and CI.

## Simplicity Review Dispositions

- Accepted, Simplify: reuse the existing monotonic request ID as the only completion token. Do not add a second generation counter. Advance the ID and abort on source change, cancellation, or clear. Guard success and final cleanup against the captured ID.
- Accepted, Simplify: let Playwright own integration-server startup, occupied-port failure, shutdown, and non-reuse. Start from the repository root with an empty child `GEMINI_API_KEY`. Keep only the exact static-target cleanup, fresh-build copy, and build marker needed to prove the served build.
- Accepted, Simplify: keep the two dated job sources, selected excerpt, fixed resume, and fixed analysis in one `integration_scenario.json`. Keep only the runtime PDF generator as a separate fixture helper.
- Accepted, Simplify: test GSAP cleanup through observable postconditions. Do not require an exact `context.revert()` call count. Assert no active tweens for owned targets, no stale inline motion styles, and only the current stage after replay, interruption, and unmount.

## Risks

- A browser test with the supplied resume can send private data to Gemini if the fake-service boundary is incomplete. The test must prove that no external model call occurs.
- DOCX download behavior can differ across Chromium and CI. The test needs an explicit download directory and content inspection.
- Editing the job description can leave stale derived state if invalidation is not centralized in the reducer.
- GSAP can duplicate React or CSS state transitions. The plan must keep React as the source of truth and scope GSAP to visual continuity.
- Deployment protection differs by host. Documentation must separate required protection from provider-specific examples.

## Open Questions

- None. The user asked the workflow to use discretion. The planner can select the smallest safe implementation that meets these requirements.

## Plan

- Reviewed Markdown plan: `.agent/kickoff/platform-hardening-motion-plan.md`
- Accepted visual plan archive: `.agent/kickoff/platform-hardening-motion-plan.accepted.html`
- Adversarial review: `.agent/kickoff/platform-hardening-motion-adversarial-review.md`
- Simplicity review: `.agent/kickoff/platform-hardening-motion-simplicity-review.md`
- All Major, Simplify, Question, and Minor findings have recorded dispositions. No material conflict remains.

## Execution Notes

- Baseline fix commit: `820fde0`
- Kickoff configuration commit: `5523f81`
- Kickoff version preflight: installed and canonical version are both `0.3.0` on 2026-08-25.
- The user approved the reviewed full plan on 2026-08-25.
- Implementation delegation is `always`. Execution uses `gpt-5.6-terra` with xhigh reasoning in dependency-aware waves.
