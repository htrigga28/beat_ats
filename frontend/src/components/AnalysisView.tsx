import type { GapAnalysis } from "../types";

export function AnalysisView({ analysis }: { analysis: GapAnalysis }) {
  return (
    <section className="analysis-register" aria-labelledby="analysis-title">
      <div className="analysis-heading">
        <div>
          <p className="eyebrow">ADVISORY COMPARISON</p>
          <h3 id="analysis-title">Estimated alignment</h3>
        </div>
        <strong className="analysis-score">
          {analysis.match_score}
          <span>/100</span>
        </strong>
      </div>
      <p className="muted">
        This is an evidence-based estimate, not a score from a specific ATS vendor.
      </p>
      {analysis.keyword_gaps?.length ? (
        <div className="analysis-section">
          <h4>Relevant gaps</h4>
          <ul>
            {analysis.keyword_gaps.map((gap) => (
              <li key={`${gap.term}-${gap.category}`}>
                <strong>{gap.term}</strong>
                <span>{gap.importance}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="empty-note">No material keyword gaps were returned.</div>
      )}
      <div className="analysis-section">
        <h4>Title alignment</h4>
        <p>
          <strong>{analysis.title_alignment.target_title}</strong> ·{" "}
          {analysis.title_alignment.assessment.replaceAll("_", " ")}
        </p>
        <p>{analysis.title_alignment.rationale}</p>
        {analysis.title_alignment.equivalent_title_suggestions?.length ? (
          <p className="muted">
            Advisory equivalents: {analysis.title_alignment.equivalent_title_suggestions.join(", ")}
            . Keep your official title unless you can truthfully verify a clarification.
          </p>
        ) : null}
      </div>
      <div className="analysis-section">
        <h4>Highest-impact improvements</h4>
        <ul>
          {analysis.actionable_recommendations.map((recommendation) => (
            <li key={recommendation}>{recommendation}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
