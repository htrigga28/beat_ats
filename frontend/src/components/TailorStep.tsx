import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileSearch,
  Lightbulb,
  LockKeyhole,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import emptyStateIllustration from "../assets/tailoring-empty-state.png";
import type {
  AppliedChange,
  BulletRewriteResult,
  GapAnalysis,
  ResumeDocument,
  RewriteAlternative,
} from "../types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface Props {
  resume: ResumeDocument;
  analysis: GapAnalysis;
  jobDescription: string;
  rewritesByBulletId: Record<string, BulletRewriteResult>;
  selectedIds: string[];
  activeBulletId: string | null;
  selectionLocked: boolean;
  openedSuggestionIds: string[];
  appliedChanges: Record<string, AppliedChange>;
  busy: boolean;
  onSelectionChange: (ids: string[]) => void;
  onGenerate: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onChangeSelection: () => void;
  onApply: (bulletId: string, text: string) => void;
  onRestore: (bulletId: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function TailorStep({
  resume,
  analysis,
  jobDescription,
  rewritesByBulletId,
  selectedIds,
  activeBulletId,
  selectionLocked,
  openedSuggestionIds,
  appliedChanges,
  busy,
  onSelectionChange,
  onGenerate,
  onOpen,
  onChangeSelection,
  onApply,
  onRestore,
  onBack,
  onContinue,
}: Props) {
  const [glowingBullet, setGlowingBullet] = useState<string | null>(null);
  const rewriteCount = Object.keys(rewritesByBulletId).length;
  const allReviewed =
    selectedIds.length === 0 ||
    (rewriteCount > 0 && selectedIds.every((id) => openedSuggestionIds.includes(id)));

  useEffect(() => {
    if (activeBulletId && rewritesByBulletId[activeBulletId]) onOpen(activeBulletId);
  }, [activeBulletId, onOpen, rewritesByBulletId]);

  const toggle = (id: string) => {
    if (selectionLocked) return;
    if (selectedIds.includes(id)) onSelectionChange(selectedIds.filter((item) => item !== id));
    else if (selectedIds.length < 10) onSelectionChange([...selectedIds, id]);
  };

  const apply = (bulletId: string, text: string) => {
    onApply(bulletId, text);
    setGlowingBullet(bulletId);
    window.setTimeout(() => setGlowingBullet(null), 1000);
  };

  const resumePane = (
    <ResumeSelectionPane
      resume={resume}
      selectedIds={selectedIds}
      activeBulletId={activeBulletId}
      selectionLocked={selectionLocked}
      rewrites={rewritesByBulletId}
      appliedChanges={appliedChanges}
      glowingBullet={glowingBullet}
      busy={busy}
      onToggle={toggle}
      onOpen={onOpen}
      onRestore={onRestore}
    />
  );
  const suggestionPane = (
    <SuggestionPane
      result={activeBulletId ? rewritesByBulletId[activeBulletId] : undefined}
      currentText={activeBulletId ? findBullet(resume, activeBulletId) : null}
      hasGenerated={rewriteCount > 0}
      onApply={apply}
    />
  );

  return (
    <section className="stage-enter tailor-stage" aria-labelledby="tailor-title">
      <div className="stage-intro tailor-intro">
        <span className="stage-kicker">Stage 3 · Advisory tailoring</span>
        <h2 id="tailor-title">Tailor the wording, preserve the truth</h2>
        <p>
          Choose up to ten evidence-backed bullets. Gemini proposes alternatives, but only your
          explicit “Apply wording” action changes the resume.
        </p>
      </div>

      <AnalysisSummary analysis={analysis} />
      <details className="job-description-disclosure">
        <summary>Review target job description</summary>
        <p>{jobDescription}</p>
      </details>

      <div className="tailor-toolbar">
        <div className="selection-pill" aria-live="polite">
          <span>Selected</span>
          <strong>{selectedIds.length} / 10</strong>
          <span>bullets</span>
        </div>
        <div>
          {selectionLocked ? (
            <Button type="button" variant="secondary" onClick={onChangeSelection} disabled={busy}>
              <RefreshCw aria-hidden="true" /> Change selection
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => onGenerate(selectedIds)}
              disabled={busy || selectedIds.length === 0}
            >
              <Sparkles aria-hidden="true" />
              {busy ? "Generating suggestions…" : "Generate suggestions"}
            </Button>
          )}
        </div>
      </div>

      <div className="tailor-desktop">
        <section className="studio-pane resume-pane" aria-label="Selectable resume bullets">
          {resumePane}
        </section>
        <section className="studio-pane suggestion-pane" aria-label="AI wording alternatives">
          {suggestionPane}
        </section>
      </div>

      <Tabs defaultValue="resume" className="tailor-mobile">
        <TabsList aria-label="Tailoring workspace">
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        </TabsList>
        <TabsContent value="resume" className="studio-pane resume-pane">
          {resumePane}
        </TabsContent>
        <TabsContent value="suggestions" className="studio-pane suggestion-pane">
          {suggestionPane}
        </TabsContent>
      </Tabs>

      <div className="sticky-action-bar tailor-footer">
        <Button type="button" variant="secondary" onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> Back to review
        </Button>
        <div>
          {selectedIds.length > 0 && !allReviewed && (
            <span className="footer-assurance">
              Open each selected bullet’s suggestion panel before export.
            </span>
          )}
          <Button type="button" size="lg" disabled={!allReviewed || busy} onClick={onContinue}>
            {selectedIds.length === 0 ? "Continue without tailoring" : "Proceed to final export"}
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function AnalysisSummary({ analysis }: { analysis: GapAnalysis }) {
  const scoreClass =
    analysis.match_score >= 80 ? "is-high" : analysis.match_score >= 60 ? "is-medium" : "is-low";
  return (
    <section className="analysis-summary" aria-labelledby="analysis-summary-title">
      <div className={`score-orb ${scoreClass}`}>
        <strong>{analysis.match_score}</strong>
        <span>Advisory score</span>
      </div>
      <div className="analysis-summary-copy">
        <span className="stage-kicker">Comparison snapshot</span>
        <h3 id="analysis-summary-title">{analysis.title_alignment.target_title}</h3>
        <p>{analysis.title_alignment.rationale}</p>
      </div>
      <div className="gap-preview">
        <span>Important gaps</span>
        <div>
          {analysis.keyword_gaps.slice(0, 4).map((gap) => (
            <span className="gap-chip" key={gap.term} title={gap.importance}>
              {gap.term}
            </span>
          ))}
          {analysis.keyword_gaps.length === 0 && (
            <span className="no-gaps">No material gaps found</span>
          )}
        </div>
      </div>
      <Accordion type="single" collapsible className="recommendation-disclosure">
        <AccordionItem value="recommendations">
          <AccordionTrigger>View recommendations</AccordionTrigger>
          <AccordionContent>
            <ul>
              {analysis.actionable_recommendations.map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

function ResumeSelectionPane({
  resume,
  selectedIds,
  activeBulletId,
  selectionLocked,
  rewrites,
  appliedChanges,
  glowingBullet,
  busy,
  onToggle,
  onOpen,
  onRestore,
}: {
  resume: ResumeDocument;
  selectedIds: string[];
  activeBulletId: string | null;
  selectionLocked: boolean;
  rewrites: Record<string, BulletRewriteResult>;
  appliedChanges: Record<string, AppliedChange>;
  glowingBullet: string | null;
  busy: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const groups = useMemo(
    () => [
      ...resume.work_experience.map((role) => ({
        id: role.id,
        eyebrow: role.employer,
        title: role.title,
        bullets: role.bullets,
      })),
      ...resume.projects.map((project) => ({
        id: project.id,
        eyebrow: "Project",
        title: project.name,
        bullets: project.bullets,
      })),
    ],
    [resume],
  );

  return (
    <>
      <header className="studio-pane-header">
        <div>
          <span className="studio-pane-kicker">Resume evidence</span>
          <h3>Work experience & projects</h3>
        </div>
        {selectionLocked && (
          <span className="locked-pill">
            <LockKeyhole aria-hidden="true" /> Selection locked
          </span>
        )}
      </header>
      <div className="experience-list">
        {groups.length === 0 && (
          <div className="studio-empty-copy">
            No work or project bullets are available to tailor.
          </div>
        )}
        {groups.map((group) => (
          <section className="experience-group" key={group.id}>
            <span>{group.eyebrow}</span>
            <h4>{group.title}</h4>
            <div className="selectable-bullets">
              {group.bullets.map((bullet) => {
                const selected = selectedIds.includes(bullet.id);
                const active = activeBulletId === bullet.id;
                const disabled = busy || selectionLocked || (!selected && selectedIds.length >= 10);
                return (
                  <article
                    className={`selectable-bullet ${selected ? "is-selected" : ""} ${active ? "is-active" : ""} ${glowingBullet === bullet.id ? "applied-glow" : ""}`}
                    key={bullet.id}
                  >
                    <Checkbox
                      checked={selected}
                      disabled={disabled}
                      aria-label={`Select bullet: ${bullet.text}`}
                      onCheckedChange={() => onToggle(bullet.id)}
                    />
                    <button
                      type="button"
                      disabled={!rewrites[bullet.id]}
                      onClick={() => onOpen(bullet.id)}
                    >
                      {bullet.text}
                    </button>
                    {appliedChanges[bullet.id] && (
                      <div className="applied-bullet-row">
                        <span>
                          <Check aria-hidden="true" /> Applied wording
                        </span>
                        <Button variant="link" size="sm" onClick={() => onRestore(bullet.id)}>
                          Restore original
                        </Button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function SuggestionPane({
  result,
  currentText,
  hasGenerated,
  onApply,
}: {
  result?: BulletRewriteResult;
  currentText: string | null;
  hasGenerated: boolean;
  onApply: (bulletId: string, text: string) => void;
}) {
  if (!hasGenerated) {
    return (
      <div className="tailor-empty-state">
        <img src={emptyStateIllustration} alt="" />
        <span className="empty-state-icon">
          <FileSearch aria-hidden="true" />
        </span>
        <h3>Select the evidence worth tailoring</h3>
        <p>
          Choose bullet points on the left, then generate suggestions to compare source wording with
          fact-preserving alternatives.
        </p>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="tailor-empty-state compact">
        <span className="empty-state-icon">
          <Lightbulb aria-hidden="true" />
        </span>
        <h3>Open a selected bullet</h3>
        <p>Choose a generated bullet on the resume pane to review its alternatives.</p>
      </div>
    );
  }
  return (
    <div className="suggestion-content">
      <header className="studio-pane-header">
        <div>
          <span className="studio-pane-kicker">AI alternatives</span>
          <h3>Review before applying</h3>
        </div>
        <span className="advisory-pill">Advisory only</span>
      </header>
      <div className="original-wording">
        <span>Original wording</span>
        <p>{result.original_text}</p>
      </div>
      <div className="proposal-list">
        {result.alternatives.map((alternative, index) => (
          <ProposalCard
            key={alternative.text}
            index={index}
            alternative={alternative}
            applied={currentText === alternative.text}
            onApply={() => onApply(result.bullet_id, alternative.text)}
          />
        ))}
      </div>
    </div>
  );
}

function ProposalCard({
  index,
  alternative,
  applied,
  onApply,
}: {
  index: number;
  alternative: RewriteAlternative;
  applied: boolean;
  onApply: () => void;
}) {
  const missing = alternative.incorporated_keywords.filter(
    (keyword) => !alternative.text.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
  );
  return (
    <article className={`proposal-card ${applied ? "is-applied" : ""}`}>
      <div className="proposal-heading">
        <span>Proposal {index + 1}</span>
        {applied && (
          <span className="applied-label">
            <Check aria-hidden="true" /> Applied
          </span>
        )}
      </div>
      <p>{highlightKeywords(alternative.text, alternative.incorporated_keywords)}</p>
      {missing.length > 0 && (
        <div className="metadata-keywords" aria-label="Suggested keywords not present verbatim">
          {missing.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      )}
      <Button type="button" variant={applied ? "secondary" : "primary"} onClick={onApply}>
        {applied ? "Apply again" : "Apply wording"}
      </Button>
    </article>
  );
}

function highlightKeywords(text: string, keywords: string[]): ReactNode {
  const exact = keywords.filter((keyword) =>
    text.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
  );
  if (exact.length === 0) return text;
  const escaped = exact.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const normalized = new Set(exact.map((keyword) => keyword.toLocaleLowerCase()));
  return text
    .split(pattern)
    .map((part, index) =>
      normalized.has(part.toLocaleLowerCase()) ? (
        <mark key={`${part}-${index}`}>{part}</mark>
      ) : (
        <Fragment key={`${part}-${index}`}>{part}</Fragment>
      ),
    );
}

function findBullet(resume: ResumeDocument, id: string): string | null {
  for (const role of resume.work_experience) {
    const bullet = role.bullets.find((item) => item.id === id);
    if (bullet) return bullet.text;
  }
  for (const project of resume.projects) {
    const bullet = project.bullets.find((item) => item.id === id);
    if (bullet) return bullet.text;
  }
  return null;
}

export function changedBulletCount(resume: ResumeDocument, original: ResumeDocument): number {
  const current = [
    ...resume.work_experience.flatMap((role) => role.bullets),
    ...resume.projects.flatMap((project) => project.bullets),
  ];
  const originalMap = new Map([
    ...original.work_experience.flatMap((role) =>
      role.bullets.map((bullet) => [bullet.id, bullet.text] as const),
    ),
    ...original.projects.flatMap((project) =>
      project.bullets.map((bullet) => [bullet.id, bullet.text] as const),
    ),
  ]);
  return current.filter((bullet) => originalMap.get(bullet.id) !== bullet.text).length;
}
