from __future__ import annotations

from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from analyzer import app, get_gemini_service, validate_rewrite_response
from schemas import (
    BulletRewriteResponse,
    ExtractedResumeDocument,
    GapAnalysis,
    ResumeDocument,
)


def _pdf_bytes(text: str | None = None) -> bytes:
    stream = BytesIO()
    pdf = canvas.Canvas(stream)
    if text:
        for index, line in enumerate([text] * 8):
            pdf.drawString(72, 760 - index * 20, line)
    pdf.showPage()
    pdf.save()
    return stream.getvalue()


def _extracted_resume() -> ExtractedResumeDocument:
    return ExtractedResumeDocument.model_validate(
        {
            "contact": {"full_name": "Jane Doe", "email": "jane@example.com"},
            "work_experience": [
                {
                    "employer": "Example",
                    "title": "Frontend Engineer",
                    "bullets": [{"text": "Built React interfaces used by 10 teams"}],
                }
            ],
        }
    )


class FakeGeminiService:
    def __init__(self) -> None:
        self.text_calls: list[str] = []
        self.pdf_calls = 0

    async def structure_resume_text(self, text: str) -> ExtractedResumeDocument:
        self.text_calls.append(text)
        return _extracted_resume()

    async def structure_resume_pdf(self, data: bytes) -> ExtractedResumeDocument:
        self.pdf_calls += 1
        assert data.startswith(b"%PDF-")
        return _extracted_resume()

    async def analyze(self, resume: ResumeDocument, job_description: str) -> GapAnalysis:
        return GapAnalysis.model_validate(
            {
                "match_score": 72,
                "keyword_gaps": [
                    {
                        "term": "Next.js",
                        "category": "technical_skill",
                        "importance": "Required in the role",
                    }
                ],
                "title_alignment": {
                    "target_title": "Senior Frontend Engineer",
                    "assessment": "partially_aligned",
                    "rationale": "Responsibilities overlap.",
                    "equivalent_title_suggestions": [],
                },
                "actionable_recommendations": ["A", "B", "C"],
            }
        )

    async def rewrite(
        self, resume: ResumeDocument, job_description: str, bullet_ids: list[str]
    ) -> BulletRewriteResponse:
        bullet = resume.work_experience[0].bullets[0]
        return BulletRewriteResponse.model_validate(
            {
                "items": [
                    {
                        "bullet_id": bullet.id,
                        "original_text": bullet.text,
                        "alternatives": [
                            {
                                "text": "Built accessible React interfaces used by 10 teams",
                                "incorporated_keywords": ["accessible"],
                            },
                            {
                                "text": "Delivered React interfaces supporting 10 product teams",
                                "incorporated_keywords": ["React"],
                            },
                        ],
                    }
                ]
            }
        )


@pytest.fixture
def fake_service() -> FakeGeminiService:
    service = FakeGeminiService()
    app.dependency_overrides[get_gemini_service] = lambda: service
    yield service
    app.dependency_overrides.clear()


def test_ingest_text_pdf_without_persisting_upload(fake_service: FakeGeminiService) -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/resumes/ingest",
            files={
                "file": (
                    "resume.pdf",
                    _pdf_bytes("Frontend engineer resume content"),
                    "application/pdf",
                )
            },
            data={"ai_processing_consent": "true", "allow_vision_fallback": "true"},
        )

    assert response.status_code == 200
    assert response.json()["extraction_method"] == "pdf_text"
    assert response.json()["resume"]["contact"]["full_name"] == "Jane Doe"
    assert fake_service.text_calls
    assert fake_service.pdf_calls == 0


def test_ingest_scanned_pdf_requires_explicit_vision_permission(
    fake_service: FakeGeminiService,
) -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/resumes/ingest",
            files={"file": ("resume.pdf", _pdf_bytes(), "application/pdf")},
            data={"ai_processing_consent": "true", "allow_vision_fallback": "false"},
        )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "vision_consent_required"
    assert fake_service.pdf_calls == 0


def test_ingest_scanned_pdf_uses_inline_vision(fake_service: FakeGeminiService) -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/resumes/ingest",
            files={"file": ("resume.pdf", _pdf_bytes(), "application/pdf")},
            data={"ai_processing_consent": "true", "allow_vision_fallback": "true"},
        )

    assert response.status_code == 200
    assert response.json()["extraction_method"] == "gemini_vision"
    assert fake_service.pdf_calls == 1


def test_analysis_requires_consent(fake_service: FakeGeminiService) -> None:
    resume = _extracted_resume().to_resume_document()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/analyses",
            json={
                "resume": resume.model_dump(mode="json"),
                "job_description": "Senior frontend engineer " * 10,
                "ai_processing_consent": False,
            },
        )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "ai_consent_required"


def test_analysis_returns_strict_response(fake_service: FakeGeminiService) -> None:
    resume = _extracted_resume().to_resume_document()
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/analyses",
            json={
                "resume": resume.model_dump(mode="json"),
                "job_description": "Senior frontend engineer " * 10,
                "ai_processing_consent": True,
            },
        )

    assert response.status_code == 200
    assert response.json()["match_score"] == 72


def test_rewrite_validation_rejects_new_metrics() -> None:
    resume = _extracted_resume().to_resume_document()
    bullet = resume.work_experience[0].bullets[0]
    response = BulletRewriteResponse.model_validate(
        {
            "items": [
                {
                    "bullet_id": bullet.id,
                    "original_text": bullet.text,
                    "alternatives": [
                        {
                            "text": "Built React interfaces used by 10 teams",
                            "incorporated_keywords": [],
                        },
                        {
                            "text": "Improved conversion by 35% across 10 teams",
                            "incorporated_keywords": [],
                        },
                    ],
                }
            ]
        }
    )

    with pytest.raises(ValueError, match="new numeric facts"):
        validate_rewrite_response(resume, [bullet.id], response)


def test_docx_endpoint_streams_word_document(fake_service: FakeGeminiService) -> None:
    resume = _extracted_resume().to_resume_document()
    with TestClient(app) as client:
        response = client.post("/api/v1/documents/docx", json=resume.model_dump(mode="json"))

    assert response.status_code == 200
    assert response.content.startswith(b"PK")
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
