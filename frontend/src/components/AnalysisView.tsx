import { gsap } from "gsap";
import { useLayoutEffect, useRef } from "react";
import { clearMotionStyles, prefersReducedMotion } from "../motion";
import type { GapAnalysis } from "../types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";

export function AnalysisView({ analysis }: { analysis: GapAnalysis }) {
  const rootRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const target = rootRef.current;
    if (!target) return;

    target.dataset.motionState = "running";
    if (prefersReducedMotion()) {
      clearMotionStyles(target, "opacity,transform");
      target.dataset.motionState = "settled";
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        target,
        { autoAlpha: 0.72 },
        {
          autoAlpha: 1,
          duration: 0.22,
          ease: "power2.out",
          onComplete: () => {
            clearMotionStyles(target, "opacity,transform");
            target.dataset.motionState = "settled";
          },
        },
      );
    }, target);

    return () => {
      context.revert();
      clearMotionStyles(target, "opacity,transform");
      target.dataset.motionState = "settled";
    };
  }, [analysis]);

  const scoreClass =
    analysis.match_score >= 80 ? "is-high" : analysis.match_score >= 60 ? "is-medium" : "is-low";

  return (
    <section
      ref={rootRef}
      className="analysis-summary"
      data-motion-ack="analysis"
      data-motion-state="settled"
      aria-labelledby="analysis-summary-title"
    >
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
        <AccordionItem value="full-analysis">
          <AccordionTrigger>View full analysis</AccordionTrigger>
          <AccordionContent>
            <div className="analysis-evidence">
              <section>
                <h4>Title alignment</h4>
                <p>
                  <strong>Assessment:</strong>{" "}
                  {analysis.title_alignment.assessment.replaceAll("_", " ")}
                </p>
                {analysis.title_alignment.equivalent_title_suggestions.length > 0 ? (
                  <>
                    <h5>Equivalent title suggestions</h5>
                    <ul>
                      {analysis.title_alignment.equivalent_title_suggestions.map((title) => (
                        <li key={title}>{title}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>No equivalent title suggestions were returned.</p>
                )}
              </section>
              <section>
                <h4>Keyword gaps</h4>
                {analysis.keyword_gaps.length > 0 ? (
                  <ul className="analysis-gap-evidence">
                    {analysis.keyword_gaps.map((gap) => (
                      <li key={`${gap.term}-${gap.category}`}>
                        <strong>{gap.term}</strong>
                        <span>Category: {gap.category.replaceAll("_", " ")}</span>
                        <span>Importance: {gap.importance}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No material gaps found.</p>
                )}
              </section>
              <section>
                <h4>Recommendations</h4>
                {analysis.actionable_recommendations.length > 0 ? (
                  <ul>
                    {analysis.actionable_recommendations.map((recommendation) => (
                      <li key={recommendation}>{recommendation}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No recommendations were returned.</p>
                )}
              </section>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
