# Simplicity Review

## Verdict

Simplification recommended

## Findings

| Classification | Plan area | Evidence | Recommendation | Preserved outcome |
| --- | --- | --- | --- | --- |
| Simplify | Request-generation guard in Phase 3 | `frontend/src/SessionContext.tsx` already has `nextRequestId` and stores the current request ID in `requestRef`; plan lines 97 and 281 propose adding another request-generation ref. | Reuse the existing monotonic request ID as the completion token. On a source change, cancellation, or clear, abort the controller and advance that ID. Refactor `run` so success dispatches occur only after the captured ID and signal pass the guard. Do not add a parallel generation counter. | Late analysis, rewrite, and DOCX results cannot update state, advance the stage, start a download, or clear newer request state. |
| Simplify | Integration server and fake-service isolation in Phase 2 | `frontend/playwright.config.ts` already delegates process lifetime to Playwright `webServer`; `analyzer.py:363-379` creates a Gemini client only when a key exists; `analyzer.py:737-744` already serves `public/` or `frontend/dist`; plan lines 220-224 add a replacement lifespan, custom port handling, server lifetime handling, asset copying, and a marker. | Keep the test-only dependency override and the exact-build marker. Set the integration `webServer` working directory to the repository root, set its child environment so `GEMINI_API_KEY` is empty, and keep `reuseExistingServer: false`. Limit custom preparation code to the validated clean static target and marker. Let Playwright own port rejection, startup, and shutdown. Do not replace the FastAPI lifespan only to suppress a client that the empty child environment already prevents. | The test uses a fresh real FastAPI process, cannot create or call a real Gemini client, serves the current build, rejects an occupied port, and does not reuse another process. |
| Simplify | Integration fixture layout in Phase 1 | Plan lines 193-195 introduce two JSON fixture files for one integration scenario, while plan line 93 describes one shared fixture packet and no second consumer is identified. | Put the two dated source records, the selected stable excerpt, the fixed extracted resume, and the fixed analysis in one `integration_scenario.json`. Keep the runtime PDF generator separate because Playwright needs a file path. | Two current sources remain traceable, tests remain offline and deterministic, and one scenario drives the fake service and UI assertions. |
| Simplify | GSAP Strict Mode test contract in Phase 4 | The accepted adversarial outcome is cleanup under Strict Mode and interruption. Plan lines 323 and 330 additionally require every implementation context to be observed as reverted exactly once, which couples the test to one cleanup implementation. | Test the postcondition: after Strict Mode replay, interruption, and unmount, no tween targets or active timelines remain, inline motion styles are clear, and only the current stage is present. Do not require an exact internal `context.revert()` call count. | Strict Mode, interruption, reduced-motion, and unmount cleanup remain directly verified without freezing the implementation to one GSAP call pattern. |

## Protected Complexity

- Keep the real-stack Playwright scenario, deterministic fake Gemini dependency, runtime synthetic PDF, private-resume environment path, DOCX inspection, and retained-Blob repeat-download check. Together they prove the required cross-layer behavior without sending private data to Gemini.
- Keep centralized reducer invalidation and a guarded asynchronous completion token. Abort alone does not protect against a delayed result that resolves after a target edit.
- Keep the stale-build safeguard. `analyzer.py` can prefer an ignored `public/` directory over `frontend/dist`, so the integration run must clean or replace the exact served target and prove which build it loaded.
- Keep one GSAP stage handoff, isolated state acknowledgements, reduced-motion handling, and cleanup tests. These controls preserve the required motion thesis without making animation the state authority.
- Keep the coherent removal and rollback unit for the non-streaming ingestion route. The route is documented, so code, tests, API types, documentation, and release evidence must change together.
- Keep the deployer-owned signed-out provider check and localhost-only fallback. Repository configuration cannot prove a private provider boundary.

## Plan Feedback For Revision

- Revise Phase 3 to reuse the current request ID as the sole generation token.
- Revise Phase 2 so Playwright owns the server process and the child process receives an empty Gemini key. Retain only the custom static-target preparation that is required to prove the current build.
- Merge the two JSON fixtures into one integration scenario packet.
- Replace the exact GSAP cleanup-call-count assertion with observable lifecycle cleanup assertions.

## Residual Risk

- The narrower integration launcher must still prove that the exact new build is served and that inherited provider credentials cannot create a Gemini client.
- Reusing the current request ID requires regression coverage for an old request finishing after a newer request starts, especially so an old `finally` block cannot clear the newer busy state.
- A behavior-based GSAP test can miss an internal leak that has no visible target. Include an assertion that GSAP reports no active tween for each owned target after replay, interruption, and unmount.

## Confidence

High - The recommendations remove duplicate counters, process controls, fixture files, and implementation-coupled assertions while retaining every explicit requirement and accepted adversarial safeguard.
