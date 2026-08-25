"""Test-only FastAPI app setup with a deterministic, local Gemini substitute."""

from __future__ import annotations

import json
from pathlib import Path

import analyzer
from schemas import BulletRewriteResponse, ExtractedResumeDocument, GapAnalysis, ResumeDocument
from settings import Settings

SCENARIO = json.loads(
    (Path(__file__).parent / "fixtures" / "integration_scenario.json").read_text()
)

# An empty environment value is a non-null SecretStr. Keep the production lifespan,
# but make this test-only app resolve the empty child key as an absent setting.
analyzer.get_settings = lambda: Settings(gemini_api_key=None)
app = analyzer.app
get_gemini_service = analyzer.get_gemini_service


class IntegrationGeminiService:
    """Return fixed schema-valid data without constructing or calling a Gemini client."""

    def __init__(self) -> None:
        self._resume = ExtractedResumeDocument.model_validate(SCENARIO["resume"])
        self._analysis = GapAnalysis.model_validate(SCENARIO["analysis"])
        self._rewrites = {item["original_text"]: item for item in SCENARIO["rewrites"]}

    async def structure_resume_text(self, text: str) -> ExtractedResumeDocument:
        del text
        return self._resume

    async def structure_resume_pdf(self, data: bytes) -> ExtractedResumeDocument:
        del data
        return self._resume

    async def analyze(self, resume: ResumeDocument, job_description: str) -> GapAnalysis:
        del resume, job_description
        return self._analysis

    async def rewrite(
        self, resume: ResumeDocument, job_description: str, bullet_ids: list[str]
    ) -> BulletRewriteResponse:
        del job_description
        bullets = {
            bullet.id: bullet.text
            for entries in (resume.work_experience, resume.projects)
            for entry in entries
            for bullet in entry.bullets
        }
        return BulletRewriteResponse.model_validate(
            {
                "items": [
                    {
                        "bullet_id": bullet_id,
                        "original_text": bullets[bullet_id],
                        "alternatives": self._rewrites[bullets[bullet_id]]["alternatives"],
                    }
                    for bullet_id in bullet_ids
                ]
            }
        )


app.dependency_overrides[get_gemini_service] = IntegrationGeminiService
