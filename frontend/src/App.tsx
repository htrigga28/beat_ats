import { Check, CircleHelp, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { ExportStep } from "./components/ExportStep";
import { ReviewStep } from "./components/ReviewStep";
import { TailorStep } from "./components/TailorStep";
import { UploadStep } from "./components/UploadStep";
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
} from "./components/ui/alert-dialog";
import { Button } from "./components/ui/button";
import { SessionProvider, useSession } from "./SessionContext";
import type { Step } from "./types";

const labels = ["Upload", "Review", "Tailor", "Export"] as const;

function Application() {
  const {
    state,
    dispatch,
    retry,
    uploadResume,
    saveResume,
    requestRewrites,
    selectBullets,
    openSuggestions,
    changeSelection,
    applySuggestion,
    restoreBullet,
    reanalyze,
    createDocx,
    downloadDocx,
    clearSession,
    cancelActiveRequest,
    setStep,
  } = useSession();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const hasPrivateData = state.resume !== null || state.jobDescription.length > 0;

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

  return (
    <div className="application-shell">
      <header className="application-header">
        <a className="brand-lockup" href="/" aria-label="Beat ATS home">
          <img className="brand-mark" src="/beat-ats-logo.png" alt="" width="44" height="44" />
          <span>
            <strong>Beat ATS</strong>
            <small>Evidence-led resume tailoring</small>
          </span>
        </a>
        <div className="header-actions">
          <span className="privacy-status">
            <ShieldCheck aria-hidden="true" /> Private session
          </span>
          <a className="header-link" href="/docs" target="_blank" rel="noreferrer">
            <CircleHelp aria-hidden="true" /> Help & API
          </a>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" disabled={!hasPrivateData}>
                <RotateCcw aria-hidden="true" /> Clear session
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all session data?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the uploaded resume, job description, analysis, rewrites, and export
                  file from memory. It cannot be recovered.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep session</AlertDialogCancel>
                <AlertDialogAction onClick={clearSession}>Clear session</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <nav className="workflow-stepper" aria-label="Resume tailoring progress">
        <ol>
          {labels.map((label, index) => {
            const step = (index + 1) as Step;
            const complete = state.step > step;
            const current = state.step === step;
            return (
              <li
                className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}
                key={label}
                aria-current={current ? "step" : undefined}
              >
                <span className="step-marker" aria-hidden="true">
                  {complete ? <Check /> : step}
                </span>
                <span className="step-label">
                  <small>Stage {step}</small>
                  <strong>{label}</strong>
                </span>
                {index < labels.length - 1 && <span className="step-line" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <main className="application-main">
        <h1 className="sr-only" ref={headingRef} tabIndex={-1}>
          Beat ATS · {labels[state.step - 1]}
        </h1>
        {state.error && (
          <div
            className={`request-alert ${state.error.retryable ? "is-warning" : "is-error"}`}
            role="alert"
          >
            <div>
              <strong>
                {state.error.retryable
                  ? "This request can be retried."
                  : "The request could not be completed."}
              </strong>
              <span>{state.error.message}</span>
              {state.error.requestId && <small>Request ID: {state.error.requestId}</small>}
            </div>
            {state.error.retryable && retry && (
              <Button type="button" variant="secondary" onClick={retry}>
                Retry
              </Button>
            )}
          </div>
        )}

        {state.step === 1 && (
          <UploadStep
            config={state.config}
            busy={Boolean(state.activeRequest)}
            uploadProgress={state.uploadProgress}
            ingestionPhase={state.ingestionPhase}
            onCancel={cancelActiveRequest}
            onUpload={uploadResume}
          />
        )}
        {state.step === 2 && state.resume && state.originalResume && (
          <ReviewStep
            resume={state.resume}
            original={state.originalResume}
            warnings={state.warnings.filter(
              (warning) => !state.dismissedWarnings.includes(warning),
            )}
            busy={Boolean(state.activeRequest)}
            onSave={saveResume}
            onDismissWarning={(warning) => dispatch({ type: "warningDismissed", warning })}
            onBackConfirmed={clearSession}
          />
        )}
        {state.step === 3 && state.resume && state.originalResume && state.analysis && (
          <TailorStep
            resume={state.resume}
            analysis={state.analysis}
            jobDescription={state.jobDescription}
            rewritesByBulletId={state.rewritesByBulletId}
            selectedIds={state.selectedBulletIds}
            activeBulletId={state.activeBulletId}
            selectionLocked={state.selectionLocked}
            openedSuggestionIds={state.openedSuggestionIds}
            appliedChanges={state.appliedChanges}
            busy={Boolean(state.activeRequest)}
            onSelectionChange={selectBullets}
            onGenerate={requestRewrites}
            onOpen={openSuggestions}
            onChangeSelection={changeSelection}
            onApply={applySuggestion}
            onRestore={restoreBullet}
            onBack={() => setStep(2)}
            onContinue={() => setStep(4)}
          />
        )}
        {state.step === 4 && state.resume && state.originalResume && (
          <ExportStep
            resume={state.resume}
            original={state.originalResume}
            appliedChanges={state.appliedChanges}
            truthConfirmations={state.truthConfirmations}
            analysisStale={state.analysisStale}
            busy={Boolean(state.activeRequest)}
            exportStatus={state.exportStatus}
            hasDownload={state.docxBlob !== null}
            onTruthChange={(key, checked) => dispatch({ type: "truthConfirmation", key, checked })}
            onGenerate={createDocx}
            onDownloadAgain={downloadDocx}
            onReanalyze={reanalyze}
            onBack={() => setStep(3)}
          />
        )}
      </main>

      <footer className="application-footer">
        <span>
          <LockKeyhole aria-hidden="true" /> In-memory only. No accounts, autosave, or browser
          storage.
        </span>
        <span>Advisory output · You approve every applied word</span>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <SessionProvider>
      <Application />
    </SessionProvider>
  );
}
