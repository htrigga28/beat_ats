from __future__ import annotations

import pytest
from pydantic import ValidationError

from schemas import (
    BulletRewriteRequest,
    ExtractedResumeDocument,
    GapAnalysis,
    ResumeDocument,
    RewriteAlternative,
)


def test_extracted_resume_gets_application_ids() -> None:
    extracted = ExtractedResumeDocument.model_validate(
        {
            "contact": {"full_name": "Jane Doe"},
            "work_experience": [
                {
                    "employer": "Example",
                    "title": "Frontend Engineer",
                    "bullets": [{"text": "Built accessible React interfaces"}],
                }
            ],
        }
    )

    resume = extracted.to_resume_document()

    assert isinstance(resume, ResumeDocument)
    assert resume.work_experience[0].id
    assert resume.work_experience[0].bullets[0].id
    assert "id" not in extracted.model_dump()


def test_analysis_enforces_score_and_recommendation_bounds() -> None:
    valid = {
        "match_score": 76,
        "keyword_gaps": [],
        "title_alignment": {
            "target_title": "Senior Frontend Engineer",
            "assessment": "partially_aligned",
            "rationale": "The responsibilities overlap.",
            "equivalent_title_suggestions": [],
        },
        "actionable_recommendations": ["A", "B", "C"],
    }
    assert GapAnalysis.model_validate(valid).match_score == 76

    with pytest.raises(ValidationError):
        GapAnalysis.model_validate({**valid, "match_score": 101})

    with pytest.raises(ValidationError):
        GapAnalysis.model_validate({**valid, "actionable_recommendations": ["Only one"]})


def test_rewrite_alternative_limits_keywords_and_length() -> None:
    RewriteAlternative(text="Built accessible React interfaces", incorporated_keywords=["React"])

    with pytest.raises(ValidationError):
        RewriteAlternative(
            text="Built accessible React interfaces",
            incorporated_keywords=["React", "TypeScript", "WCAG"],
        )

    with pytest.raises(ValidationError):
        RewriteAlternative(text=" ".join(["word"] * 41), incorporated_keywords=[])


def test_rewrite_request_limits_selected_bullets() -> None:
    resume = ResumeDocument.model_validate({"contact": {"full_name": "Jane Doe"}})

    with pytest.raises(ValidationError):
        BulletRewriteRequest(
            resume=resume,
            job_description="Frontend role " * 10,
            bullet_ids=[str(index) for index in range(11)],
            ai_processing_consent=True,
        )
