"""Strict request, response, and resume models shared across application layers."""

from __future__ import annotations

from enum import StrEnum
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _new_id() -> str:
    return uuid4().hex


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ContactInfo(StrictModel):
    full_name: str = Field(min_length=1, max_length=160)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=80)
    location: str | None = Field(default=None, max_length=160)
    links: list[str] = Field(default_factory=list, max_length=10)


class ExtractedBullet(StrictModel):
    text: str = Field(min_length=1, max_length=1_000)


class ResumeBullet(ExtractedBullet):
    id: str = Field(default_factory=_new_id, min_length=1, max_length=64)


class ExtractedWorkExperience(StrictModel):
    employer: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=160)
    start_date: str | None = Field(default=None, max_length=80)
    end_date: str | None = Field(default=None, max_length=80)
    bullets: list[ExtractedBullet] = Field(default_factory=list, max_length=30)


class WorkExperience(StrictModel):
    id: str = Field(default_factory=_new_id, min_length=1, max_length=64)
    employer: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=160)
    start_date: str | None = Field(default=None, max_length=80)
    end_date: str | None = Field(default=None, max_length=80)
    bullets: list[ResumeBullet] = Field(default_factory=list, max_length=30)


class SkillGroup(StrictModel):
    label: str | None = Field(default=None, max_length=100)
    items: list[str] = Field(default_factory=list, max_length=100)


class Education(StrictModel):
    institution: str = Field(min_length=1, max_length=200)
    credential: str = Field(min_length=1, max_length=200)
    field_of_study: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=160)
    dates: str | None = Field(default=None, max_length=100)
    details: list[str] = Field(default_factory=list, max_length=20)


class ExtractedProject(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    role: str | None = Field(default=None, max_length=200)
    dates: str | None = Field(default=None, max_length=100)
    link: str | None = Field(default=None, max_length=300)
    bullets: list[ExtractedBullet] = Field(default_factory=list, max_length=20)


class Project(StrictModel):
    id: str = Field(default_factory=_new_id, min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    role: str | None = Field(default=None, max_length=200)
    dates: str | None = Field(default=None, max_length=100)
    link: str | None = Field(default=None, max_length=300)
    bullets: list[ResumeBullet] = Field(default_factory=list, max_length=20)


class AdditionalSection(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    items: list[str] = Field(default_factory=list, max_length=50)


class ExtractedResumeDocument(StrictModel):
    contact: ContactInfo
    professional_summary: str | None = Field(default=None, max_length=2_000)
    work_experience: list[ExtractedWorkExperience] = Field(default_factory=list, max_length=30)
    skills: list[SkillGroup] = Field(default_factory=list, max_length=30)
    education: list[Education] = Field(default_factory=list, max_length=20)
    certifications: list[str] = Field(default_factory=list, max_length=30)
    projects: list[ExtractedProject] = Field(default_factory=list, max_length=30)
    additional_sections: list[AdditionalSection] = Field(default_factory=list, max_length=20)

    def to_resume_document(self) -> ResumeDocument:
        return ResumeDocument(
            contact=self.contact,
            professional_summary=self.professional_summary,
            work_experience=[
                WorkExperience(
                    employer=role.employer,
                    title=role.title,
                    location=role.location,
                    start_date=role.start_date,
                    end_date=role.end_date,
                    bullets=[ResumeBullet(text=bullet.text) for bullet in role.bullets],
                )
                for role in self.work_experience
            ],
            skills=self.skills,
            education=self.education,
            certifications=self.certifications,
            projects=[
                Project(
                    name=project.name,
                    role=project.role,
                    dates=project.dates,
                    link=project.link,
                    bullets=[ResumeBullet(text=bullet.text) for bullet in project.bullets],
                )
                for project in self.projects
            ],
            additional_sections=self.additional_sections,
        )


class ResumeDocument(StrictModel):
    contact: ContactInfo
    professional_summary: str | None = Field(default=None, max_length=2_000)
    work_experience: list[WorkExperience] = Field(default_factory=list, max_length=30)
    skills: list[SkillGroup] = Field(default_factory=list, max_length=30)
    education: list[Education] = Field(default_factory=list, max_length=20)
    certifications: list[str] = Field(default_factory=list, max_length=30)
    projects: list[Project] = Field(default_factory=list, max_length=30)
    additional_sections: list[AdditionalSection] = Field(default_factory=list, max_length=20)


class ExtractionMethod(StrEnum):
    PDF_TEXT = "pdf_text"
    DOCX_TEXT = "docx_text"
    GEMINI_VISION = "gemini_vision"


class ResumeIngestionResponse(StrictModel):
    resume: ResumeDocument
    extraction_method: ExtractionMethod
    warnings: list[str] = Field(default_factory=list)


class KeywordCategory(StrEnum):
    TECHNICAL_SKILL = "technical_skill"
    TOOL = "tool"
    SOFT_SKILL = "soft_skill"
    DOMAIN = "domain"
    OTHER = "other"


class KeywordGap(StrictModel):
    term: str = Field(min_length=1, max_length=120)
    category: KeywordCategory
    importance: str = Field(min_length=1, max_length=200)


class TitleAssessment(StrEnum):
    ALIGNED = "aligned"
    PARTIALLY_ALIGNED = "partially_aligned"
    NOT_ALIGNED = "not_aligned"


class TitleAlignment(StrictModel):
    target_title: str = Field(min_length=1, max_length=200)
    assessment: TitleAssessment
    rationale: str = Field(min_length=1, max_length=1_000)
    equivalent_title_suggestions: list[str] = Field(default_factory=list, max_length=5)


class GapAnalysis(StrictModel):
    match_score: int = Field(ge=0, le=100)
    keyword_gaps: list[KeywordGap] = Field(default_factory=list, max_length=30)
    title_alignment: TitleAlignment
    actionable_recommendations: list[str] = Field(min_length=3, max_length=5)


class AnalysisRequest(StrictModel):
    resume: ResumeDocument
    job_description: str = Field(min_length=50, max_length=50_000)
    ai_processing_consent: bool


class RewriteAlternative(StrictModel):
    text: str = Field(min_length=1, max_length=1_000)
    incorporated_keywords: list[str] = Field(default_factory=list, max_length=2)

    @field_validator("text")
    @classmethod
    def enforce_word_limit(cls, value: str) -> str:
        if len(value.split()) > 40:
            raise ValueError("Rewrite alternatives must contain at most 40 words.")
        return value


class BulletRewriteResult(StrictModel):
    bullet_id: str = Field(min_length=1, max_length=64)
    original_text: str = Field(min_length=1, max_length=1_000)
    alternatives: list[RewriteAlternative] = Field(min_length=2, max_length=3)


class BulletRewriteResponse(StrictModel):
    items: list[BulletRewriteResult] = Field(min_length=1, max_length=10)


class BulletRewriteRequest(StrictModel):
    resume: ResumeDocument
    job_description: str = Field(min_length=50, max_length=50_000)
    bullet_ids: list[str] = Field(min_length=1, max_length=10)
    ai_processing_consent: bool


class ApiError(StrictModel):
    code: str
    message: str
    retryable: bool = False


class HealthResponse(StrictModel):
    status: str
    gemini_configured: bool


class RuntimeConfig(StrictModel):
    max_upload_bytes: int = Field(ge=1)
    accepted_extensions: list[str] = Field(min_length=1, max_length=10)
    vision_fallback_available: bool
    gemini_model: str = Field(min_length=1, max_length=128)
