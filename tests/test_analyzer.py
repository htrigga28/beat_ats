from __future__ import annotations

from collections.abc import Generator
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from google.genai import types
from reportlab.pdfgen import canvas

from analyzer import (
    GeminiProviderError,
    GeminiService,
    _gemini_json_schema,
    app,
    get_gemini_service,
    validate_rewrite_response,
)
from schemas import (
    BulletRewriteResponse,
    ExtractedResumeDocument,
    GapAnalysis,
    ResumeDocument,
)
from settings import Settings


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
def fake_service() -> Generator[FakeGeminiService, None, None]:
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


def test_api_root_describes_available_routes() -> None:
    with TestClient(app) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "Beat ATS" in response.text


def test_frontend_fallback_serves_spa_for_client_routes() -> None:
    with TestClient(app) as client:
        response = client.get("/review", headers={"accept": "text/html"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")


def test_runtime_config_exposes_default_upload_contract() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/config")

    assert response.status_code == 200
    assert response.json() == {
        "max_upload_bytes": 10 * 1024 * 1024,
        "accepted_extensions": ["pdf", "docx"],
        "vision_fallback_available": True,
        "gemini_model": "gemini-3.1-flash-lite",
    }


def test_gemini_schema_removes_unsupported_pydantic_constraints() -> None:
    schema = _gemini_json_schema(ExtractedResumeDocument.model_json_schema())
    serialized = str(schema)

    assert "minLength" not in serialized
    assert "maxLength" not in serialized
    assert "default" not in serialized
    assert "$defs" in schema
    assert "properties" in schema


def test_ingest_uses_runtime_upload_limit(
    fake_service: FakeGeminiService, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("analyzer.get_settings", lambda: Settings(max_upload_bytes=4 * 1024 * 1024))
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/resumes/ingest",
            files={"file": ("resume.pdf", b"%PDF-" + b"0" * (4 * 1024 * 1024), "application/pdf")},
            data={"ai_processing_consent": "true", "allow_vision_fallback": "true"},
        )

    assert response.status_code == 413
    assert "4 MB" in response.json()["detail"]["message"]


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


def test_rewrite_endpoint_returns_validated_alternatives(
    fake_service: FakeGeminiService,
) -> None:
    resume = _extracted_resume().to_resume_document()
    bullet_id = resume.work_experience[0].bullets[0].id
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/rewrites",
            json={
                "resume": resume.model_dump(mode="json"),
                "job_description": "Senior frontend engineer " * 10,
                "bullet_ids": [bullet_id],
                "ai_processing_consent": True,
            },
        )

    assert response.status_code == 200
    assert response.json()["items"][0]["bullet_id"] == bullet_id


class _FakeModels:
    def __init__(self, parsed: object, text: str = "") -> None:
        self.parsed = parsed
        self.text = text
        self.calls: list[dict[str, object]] = []

    async def generate_content(self, **kwargs: object) -> object:
        self.calls.append(kwargs)
        return type("FakeResponse", (), {"parsed": self.parsed, "text": self.text})()


class _FakeClient:
    def __init__(self, parsed: object, text: str = "") -> None:
        self.models = _FakeModels(parsed, text)
        self.aio = type("FakeAsyncClient", (), {"models": self.models})()


def _gemini_service(parsed: object, text: str = "") -> tuple[GeminiService, _FakeClient]:
    service = object.__new__(GeminiService)
    service._settings = Settings(gemini_api_key="test-key", gemini_max_attempts=1)
    client = _FakeClient(parsed, text)
    service._client = client
    return service, client


@pytest.mark.asyncio
async def test_gemini_service_structures_text_with_schema_config() -> None:
    service, client = _gemini_service(_extracted_resume().model_dump())

    result = await service.structure_resume_text("Jane Doe frontend engineer")

    assert result.contact.full_name == "Jane Doe"
    call = client.models.calls[0]
    assert call["model"] == "gemini-3.1-flash-lite"
    assert "<resume>" in str(call["contents"])
    config = call["config"]
    assert isinstance(config, types.GenerateContentConfig)
    assert config.response_mime_type == "application/json"
    assert config.response_json_schema == _gemini_json_schema(
        ExtractedResumeDocument.model_json_schema()
    )
    assert config.response_schema is None


@pytest.mark.asyncio
async def test_gemini_service_uses_inline_pdf_part() -> None:
    service, client = _gemini_service(_extracted_resume())

    await service.structure_resume_pdf(b"%PDF-test")

    contents = client.models.calls[0]["contents"]
    assert isinstance(contents, list)
    assert contents[0].inline_data.mime_type == "application/pdf"


@pytest.mark.asyncio
async def test_gemini_service_validates_json_text_fallback() -> None:
    service, _ = _gemini_service(None, _extracted_resume().model_dump_json())

    result = await service.structure_resume_text("Jane Doe")

    assert result.contact.email == "jane@example.com"


@pytest.mark.asyncio
async def test_gemini_service_rejects_invalid_structured_output() -> None:
    service, _ = _gemini_service(None, "not-json")

    with pytest.raises(GeminiProviderError, match="invalid structured response"):
        await service.structure_resume_text("Jane Doe")
