"""Streamlit interface for the private Beat ATS tailoring workflow.

THESIS: Resume tailoring is a document examination task, not a score game; the UI
refuses the dashboard-of-cards default and keeps source, suggestion, and acceptance
legible.
OWN-WORLD: Cool paper, white working sheets, editorial ink, thin rules, and verification
green create a proofreader's desk with compact rectangular controls.
STORY: Upload a source document, verify every extracted fact, choose supported rewrites,
then export a parseable Word resume.
FIRST VIEWPORT: A concise product statement leads into a four-stage registration strip
and the upload/JD form; privacy and truth constraints sit beside the action.
FORM: A document examination desk with one persistent working column and explicit change
registers; concept seed f0ad2ff5.
"""

from __future__ import annotations

import html
from collections.abc import Mapping
from typing import Any

import httpx
import streamlit as st
from pydantic import ValidationError

from schemas import (
    BulletRewriteResponse,
    GapAnalysis,
    ResumeBullet,
    ResumeDocument,
    ResumeIngestionResponse,
)
from settings import get_settings

DISCLAIMER = (
    "The AI rewrites content based on your input. Please verify all metrics and "
    "statements for accuracy before submitting."
)

STYLES = """
<style>
:root {
  --paper: #F5F7F3;
  --sheet: #FFFFFF;
  --ink: #17231C;
  --muted: #53615A;
  --rule: #C9D0C8;
  --green: #176B4D;
  --green-deep: #0E5038;
  --warning: #9A5B00;
  --error: #A33A35;
}
.stApp { background: var(--paper); color: var(--ink); }
[data-testid="stMainBlockContainer"] { max-width: 1080px; padding-top: 2.5rem; }
[data-testid="stHeader"] { background: var(--paper); }
h1, h2, h3 { color: var(--ink); letter-spacing: -0.025em; }
h1 { font-weight: 750; }
p, label { color: var(--ink); }
.beat-lead { max-width: 70ch; color: var(--muted); font-size: 1rem; margin-bottom: 1.7rem; }
.beat-register {
  display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: .55rem; margin: 1.5rem 0 2rem;
}
.beat-step {
  border-top: 2px solid var(--rule); color: var(--muted); padding-top: .55rem;
  font-size: .78rem; font-weight: 700;
}
.beat-step span {
  display: inline-grid; place-items: center; width: 1.35rem; height: 1.35rem;
  border: 1px solid currentColor; border-radius: 50%; margin-right: .4rem;
}
.beat-step .sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.beat-step.done { border-color: var(--green); color: var(--green); }
.beat-step.current { border-color: var(--ink); color: var(--ink); }
div[data-testid="stForm"] {
  background: var(--sheet); border: 1px solid var(--rule); border-radius: 12px;
  padding: 1.2rem 1.3rem 1.35rem;
}
div[data-testid="stExpander"] {
  border-color: var(--rule); border-radius: 8px; background: var(--sheet);
}
.stButton > button, .stDownloadButton > button {
  border-radius: 8px; min-height: 2.6rem; font-weight: 700;
}
.stButton > button[kind="primary"] {
  background: var(--green); border-color: var(--green); color: white;
}
.stButton > button[kind="primary"]:hover {
  background: var(--green-deep); border-color: var(--green-deep);
}
.stButton > button[kind="secondary"] {
  background: var(--sheet); border: 1px solid var(--rule); color: var(--ink);
}
.stButton > button[kind="secondary"]:hover {
  border-color: var(--ink); color: var(--ink);
}
.stButton > button:focus-visible, .stDownloadButton > button:focus-visible,
input:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--green) !important; outline-offset: 2px;
}
.beat-source {
  border-left: 1px solid var(--rule); padding-left: 1rem;
  color: var(--muted); margin: .4rem 0 1rem;
}
.beat-stale { color: var(--warning); font-weight: 700; }
.beat-footnote { color: var(--muted); font-size: .78rem; max-width: 72ch; }
@media (max-width: 700px) {
  [data-testid="stMainBlockContainer"] { padding: 1.25rem 1rem 3rem; }
  .beat-register { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  div[data-testid="stForm"] { padding: .9rem; }
}
</style>
"""


class FrontendApiError(RuntimeError):
    """A safe backend error suitable for direct display."""


def apply_rewrite_choices(resume: ResumeDocument, choices: Mapping[str, str]) -> ResumeDocument:
    """Return a new resume with only explicitly selected bullets replaced."""

    tailored = resume.model_copy(deep=True)
    for role in tailored.work_experience:
        for bullet in role.bullets:
            if bullet.id in choices:
                bullet.text = choices[bullet.id].strip()
    return tailored


def count_changed_bullets(original: ResumeDocument, current: ResumeDocument) -> int:
    original_bullets = {
        bullet.id: bullet.text for role in original.work_experience for bullet in role.bullets
    }
    return sum(
        original_bullets.get(bullet.id) != bullet.text
        for role in current.work_experience
        for bullet in role.bullets
        if bullet.id in original_bullets
    )


def _api_request(
    method: str,
    path: str,
    *,
    json_payload: dict[str, Any] | None = None,
    files: dict[str, Any] | None = None,
    data: dict[str, str] | None = None,
) -> httpx.Response:
    settings = get_settings()
    try:
        with httpx.Client(
            base_url=settings.backend_url,
            timeout=settings.gemini_timeout_seconds + 10,
        ) as client:
            response = client.request(
                method,
                path,
                json=json_payload,
                files=files,
                data=data,
            )
    except httpx.RequestError as exc:
        raise FrontendApiError(
            "The private API is unavailable. Start FastAPI and try again."
        ) from exc

    if response.is_error:
        try:
            body = response.json()
            detail = body.get("detail", body)
            message = detail.get("message", "The request could not be completed.")
        except (ValueError, AttributeError):
            message = "The request could not be completed."
        raise FrontendApiError(message)
    return response


def _initialize_state() -> None:
    defaults: dict[str, Any] = {
        "step": 1,
        "resume": None,
        "original_resume": None,
        "job_description": "",
        "analysis": None,
        "analysis_stale": False,
        "rewrite_options": None,
        "docx_bytes": None,
        "upload_nonce": 0,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def _clear_session() -> None:
    for key in list(st.session_state.keys()):
        del st.session_state[key]


def _render_progress(step: int) -> None:  # pragma: no cover - browser-verified UI
    labels = ["Upload", "Review", "Tailor", "Export"]
    blocks = []
    for index, label in enumerate(labels, start=1):
        state = "done" if index < step else "current" if index == step else "pending"
        status_text = "completed" if index < step else "current" if index == step else "pending"
        blocks.append(
            f'<div class="beat-step {state}"><span>{index}</span>{label}'
            f'<span class="sr-only"> {status_text}</span></div>'
        )
    st.markdown(
        '<nav class="beat-register" aria-label="Tailoring progress">' + "".join(blocks) + "</nav>",
        unsafe_allow_html=True,
    )


def _optional(value: str) -> str | None:
    stripped = value.strip()
    return stripped or None


def _bullet_lines(text: str, existing: list[ResumeBullet]) -> list[ResumeBullet]:
    lines = [line.strip().removeprefix("•").strip() for line in text.splitlines() if line.strip()]
    return [
        ResumeBullet(id=existing[index].id, text=line)
        if index < len(existing)
        else ResumeBullet(text=line)
        for index, line in enumerate(lines)
    ]


def _render_resume_editor(  # pragma: no cover - browser-verified UI
    resume: ResumeDocument,
) -> tuple[ResumeDocument | None, str | None]:
    with st.form("resume_editor"):
        st.subheader("Verify the extracted facts")
        st.caption("Every field below is editable. Nothing is changed by AI at this stage.")

        contact_columns = st.columns(2)
        full_name = contact_columns[0].text_input("Full name", resume.contact.full_name)
        email = contact_columns[1].text_input("Email", resume.contact.email or "")
        phone = contact_columns[0].text_input("Phone", resume.contact.phone or "")
        location = contact_columns[1].text_input("Location", resume.contact.location or "")
        links = st.text_area("Links — one per line", "\n".join(resume.contact.links), height=90)
        summary = st.text_area(
            "Professional summary", resume.professional_summary or "", height=120
        )

        role_values: list[dict[str, Any]] = []
        st.markdown("### Work experience")
        for index, role in enumerate(resume.work_experience):
            with st.expander(f"{role.title} — {role.employer}", expanded=index == 0):
                columns = st.columns(2)
                title = columns[0].text_input("Job title", role.title, key=f"role_title_{role.id}")
                employer = columns[1].text_input(
                    "Employer", role.employer, key=f"role_employer_{role.id}"
                )
                role_location = columns[0].text_input(
                    "Role location", role.location or "", key=f"role_location_{role.id}"
                )
                start_date = columns[1].text_input(
                    "Start date", role.start_date or "", key=f"role_start_{role.id}"
                )
                end_date = columns[1].text_input(
                    "End date", role.end_date or "", key=f"role_end_{role.id}"
                )
                bullets = st.text_area(
                    "Bullets — one per line",
                    "\n".join(bullet.text for bullet in role.bullets),
                    key=f"role_bullets_{role.id}",
                    height=max(120, len(role.bullets) * 55),
                )
                remove = st.checkbox("Remove this role", key=f"remove_role_{role.id}")
                if not remove:
                    role_values.append(
                        {
                            "id": role.id,
                            "title": title,
                            "employer": employer,
                            "location": _optional(role_location),
                            "start_date": _optional(start_date),
                            "end_date": _optional(end_date),
                            "bullets": _bullet_lines(bullets, role.bullets),
                        }
                    )

        skill_values: list[dict[str, Any]] = []
        st.markdown("### Skills")
        for index, group in enumerate(resume.skills):
            columns = st.columns([1, 3])
            label = columns[0].text_input(
                "Skill group", group.label or "", key=f"skill_label_{index}"
            )
            items = columns[1].text_input(
                "Skills — comma separated",
                ", ".join(group.items),
                key=f"skill_items_{index}",
            )
            parsed_items = [item.strip() for item in items.split(",") if item.strip()]
            if label.strip() or parsed_items:
                skill_values.append({"label": _optional(label), "items": parsed_items})

        education_values: list[dict[str, Any]] = []
        st.markdown("### Education")
        for index, education in enumerate(resume.education):
            with st.expander(f"{education.credential} — {education.institution}"):
                columns = st.columns(2)
                credential = columns[0].text_input(
                    "Credential", education.credential, key=f"edu_credential_{index}"
                )
                institution = columns[1].text_input(
                    "Institution", education.institution, key=f"edu_institution_{index}"
                )
                field = columns[0].text_input(
                    "Field of study", education.field_of_study or "", key=f"edu_field_{index}"
                )
                edu_location = columns[1].text_input(
                    "Education location",
                    education.location or "",
                    key=f"edu_location_{index}",
                )
                dates = columns[0].text_input(
                    "Education dates", education.dates or "", key=f"edu_dates_{index}"
                )
                details = st.text_area(
                    "Education details — one per line",
                    "\n".join(education.details),
                    key=f"edu_details_{index}",
                )
                remove = st.checkbox("Remove this education", key=f"remove_edu_{index}")
                if not remove:
                    education_values.append(
                        {
                            "credential": credential,
                            "institution": institution,
                            "field_of_study": _optional(field),
                            "location": _optional(edu_location),
                            "dates": _optional(dates),
                            "details": [
                                line.strip() for line in details.splitlines() if line.strip()
                            ],
                        }
                    )

        certifications = st.text_area(
            "Certifications — one per line", "\n".join(resume.certifications), height=100
        )

        project_values: list[dict[str, Any]] = []
        if resume.projects:
            st.markdown("### Projects")
        for project in resume.projects:
            with st.expander(project.name):
                columns = st.columns(2)
                name = columns[0].text_input(
                    "Project name", project.name, key=f"project_name_{project.id}"
                )
                role = columns[1].text_input(
                    "Project role", project.role or "", key=f"project_role_{project.id}"
                )
                dates = columns[0].text_input(
                    "Project dates", project.dates or "", key=f"project_dates_{project.id}"
                )
                link = columns[1].text_input(
                    "Project link", project.link or "", key=f"project_link_{project.id}"
                )
                bullets = st.text_area(
                    "Project bullets — one per line",
                    "\n".join(bullet.text for bullet in project.bullets),
                    key=f"project_bullets_{project.id}",
                )
                remove = st.checkbox("Remove this project", key=f"remove_project_{project.id}")
                if not remove:
                    project_values.append(
                        {
                            "id": project.id,
                            "name": name,
                            "role": _optional(role),
                            "dates": _optional(dates),
                            "link": _optional(link),
                            "bullets": _bullet_lines(bullets, project.bullets),
                        }
                    )

        additional_values: list[dict[str, Any]] = []
        if resume.additional_sections:
            st.markdown("### Additional sections")
        for index, section in enumerate(resume.additional_sections):
            columns = st.columns([1, 3])
            title = columns[0].text_input(
                "Section title", section.title, key=f"additional_title_{index}"
            )
            items = columns[1].text_area(
                "Items — one per line",
                "\n".join(section.items),
                key=f"additional_items_{index}",
                height=90,
            )
            parsed_items = [line.strip() for line in items.splitlines() if line.strip()]
            if title.strip() and parsed_items:
                additional_values.append({"title": title, "items": parsed_items})

        button_columns = st.columns([1, 1, 2])
        save = button_columns[0].form_submit_button("Save edits")
        analyze = button_columns[1].form_submit_button("Save & analyze", type="primary")

    if not save and not analyze:
        return None, None

    try:
        updated = ResumeDocument.model_validate(
            {
                "contact": {
                    "full_name": full_name,
                    "email": _optional(email),
                    "phone": _optional(phone),
                    "location": _optional(location),
                    "links": [line.strip() for line in links.splitlines() if line.strip()],
                },
                "professional_summary": _optional(summary),
                "work_experience": role_values,
                "skills": skill_values,
                "education": education_values,
                "certifications": [
                    line.strip() for line in certifications.splitlines() if line.strip()
                ],
                "projects": project_values,
                "additional_sections": additional_values,
            }
        )
    except ValidationError as exc:
        first_error = exc.errors()[0]
        st.error(f"Check {'.'.join(map(str, first_error['loc']))}: {first_error['msg']}")
        return None, None
    return updated, "analyze" if analyze else "save"


def _run_analysis(resume: ResumeDocument) -> GapAnalysis:
    response = _api_request(
        "POST",
        "/api/v1/analyses",
        json_payload={
            "resume": resume.model_dump(mode="json"),
            "job_description": st.session_state.job_description,
            "ai_processing_consent": True,
        },
    )
    return GapAnalysis.model_validate(response.json())


def _render_analysis(analysis: GapAnalysis) -> None:  # pragma: no cover - browser-verified UI
    st.markdown("---")
    st.subheader(f"Estimated alignment: {analysis.match_score}/100")
    st.caption("Advisory estimate only — not a score from a specific ATS vendor.")
    if analysis.keyword_gaps:
        st.markdown("#### Relevant gaps")
        for gap in analysis.keyword_gaps:
            st.markdown(f"- **{gap.term}** — {gap.importance}")
    st.markdown("#### Title alignment")
    st.write(analysis.title_alignment.rationale)
    if analysis.title_alignment.equivalent_title_suggestions:
        st.caption(
            "Equivalent-title suggestions are advisory. Keep your official title unless "
            "you can truthfully verify a clarification."
        )
        st.write(", ".join(analysis.title_alignment.equivalent_title_suggestions))
    st.markdown("#### Highest-impact improvements")
    for recommendation in analysis.actionable_recommendations:
        st.markdown(f"- {recommendation}")


def _render_upload() -> None:  # pragma: no cover - browser-verified UI
    st.header("Upload your current resume")
    st.markdown(
        '<p class="beat-lead">Add a PDF or DOCX and the complete frontend job '
        "description. You will verify every extracted field before analysis.</p>",
        unsafe_allow_html=True,
    )
    st.info(
        "Gemini privacy note: free-tier and billing-enabled projects have different data "
        "handling terms. Use a billing-enabled project for production-sensitive resumes."
    )
    with st.form("upload_resume"):
        uploaded = st.file_uploader(
            "Resume file",
            type=["pdf", "docx"],
            key=f"resume_upload_{st.session_state.upload_nonce}",
            help="Maximum 10 MB. Scanned PDFs require the vision fallback.",
        )
        job_description = st.text_area(
            "Target job description",
            height=280,
            placeholder="Paste the complete role description, including location and eligibility.",
        )
        consent = st.checkbox(
            "I consent to sending my resume content and job description to Gemini for this session."
        )
        vision = st.checkbox(
            "Allow inline Gemini vision processing if this PDF has no selectable text."
        )
        submitted = st.form_submit_button("Extract resume", type="primary")

    st.markdown(f'<p class="beat-footnote">{DISCLAIMER}</p>', unsafe_allow_html=True)
    if not submitted:
        return
    if uploaded is None:
        st.error("Choose a PDF or DOCX resume before continuing.")
        return
    if len(job_description.strip()) < 50:
        st.error("Paste a complete job description of at least 50 characters.")
        return
    if not consent:
        st.error("Consent is required before any resume content is sent to Gemini.")
        return

    try:
        with st.spinner("Extracting your resume into editable sections…"):
            response = _api_request(
                "POST",
                "/api/v1/resumes/ingest",
                files={
                    "file": (
                        uploaded.name,
                        uploaded.getvalue(),
                        uploaded.type or "application/octet-stream",
                    )
                },
                data={
                    "ai_processing_consent": "true",
                    "allow_vision_fallback": str(vision).lower(),
                },
            )
            result = ResumeIngestionResponse.model_validate(response.json())
    except (FrontendApiError, ValidationError) as exc:
        st.error(str(exc))
        return

    st.session_state.resume = result.resume
    st.session_state.original_resume = result.resume.model_copy(deep=True)
    st.session_state.job_description = job_description.strip()
    st.session_state.analysis = None
    st.session_state.analysis_stale = False
    st.session_state.rewrite_options = None
    st.session_state.upload_nonce += 1
    st.session_state.step = 2
    if result.warnings:
        st.session_state.ingestion_warnings = result.warnings
    st.rerun()


def _render_review() -> None:  # pragma: no cover - browser-verified UI
    resume: ResumeDocument = st.session_state.resume
    st.header("Review before analysis")
    if warnings := st.session_state.get("ingestion_warnings"):
        for warning in warnings:
            st.warning(warning)

    updated, action = _render_resume_editor(resume)
    if updated is not None:
        changed = updated.model_dump() != resume.model_dump()
        st.session_state.resume = updated
        if changed:
            st.session_state.analysis_stale = st.session_state.analysis is not None
            st.session_state.rewrite_options = None
            st.session_state.docx_bytes = None
        if action == "save":
            st.success("Edits saved in this private session.")
        else:
            try:
                with st.spinner("Comparing explicit resume evidence with the role…"):
                    st.session_state.analysis = _run_analysis(updated)
                st.session_state.analysis_stale = False
            except (FrontendApiError, ValidationError) as exc:
                st.error(str(exc))

    analysis = st.session_state.analysis
    if analysis is not None:
        if st.session_state.analysis_stale:
            st.markdown(
                '<p class="beat-stale">This analysis predates your latest edits. Re-run it '
                "before relying on the score.</p>",
                unsafe_allow_html=True,
            )
        _render_analysis(analysis)
        if st.button("Choose bullets to tailor", type="primary"):
            st.session_state.step = 3
            st.rerun()


def _render_tailor() -> None:  # pragma: no cover - browser-verified UI
    resume: ResumeDocument = st.session_state.resume
    st.header("Choose the bullets worth tailoring")
    st.markdown(
        '<p class="beat-lead">Select only bullets whose underlying experience genuinely '
        "supports this role. Gemini will propose alternatives; it will not apply them.</p>",
        unsafe_allow_html=True,
    )
    with st.form("bullet_selection"):
        selected: list[str] = []
        for role in resume.work_experience:
            st.markdown(f"#### {role.title} — {role.employer}")
            for bullet in role.bullets:
                if st.checkbox(bullet.text, key=f"select_{bullet.id}"):
                    selected.append(bullet.id)
        request_rewrites = st.form_submit_button("Generate alternatives", type="primary")

    if request_rewrites:
        if not selected:
            st.error("Select at least one work-experience bullet.")
        else:
            try:
                with st.spinner("Drafting evidence-constrained alternatives…"):
                    response = _api_request(
                        "POST",
                        "/api/v1/rewrites",
                        json_payload={
                            "resume": resume.model_dump(mode="json"),
                            "job_description": st.session_state.job_description,
                            "bullet_ids": selected,
                            "ai_processing_consent": True,
                        },
                    )
                    st.session_state.rewrite_options = BulletRewriteResponse.model_validate(
                        response.json()
                    )
            except (FrontendApiError, ValidationError) as exc:
                st.error(str(exc))

    rewrites: BulletRewriteResponse | None = st.session_state.rewrite_options
    choices: dict[str, str] = {}
    if rewrites is not None:
        st.markdown("---")
        st.subheader("Review alternatives")
        st.warning(DISCLAIMER)
        for item in rewrites.items:
            st.markdown("**Source bullet**")
            st.markdown(
                f'<div class="beat-source">{html.escape(item.original_text)}</div>',
                unsafe_allow_html=True,
            )
            option_index = st.radio(
                "Choose one alternative",
                options=list(range(len(item.alternatives))),
                format_func=lambda index, alternatives=item.alternatives: alternatives[index].text,
                key=f"rewrite_choice_{item.bullet_id}",
            )
            choices[item.bullet_id] = item.alternatives[option_index].text
        if st.button("Apply selected alternatives", type="primary"):
            st.session_state.resume = apply_rewrite_choices(resume, choices)
            st.session_state.analysis_stale = True
            st.session_state.docx_bytes = None
            st.session_state.step = 4
            st.rerun()

    navigation = st.columns(2)
    if navigation[0].button("Back to review"):
        st.session_state.step = 2
        st.rerun()
    if navigation[1].button("Continue without more rewrites"):
        st.session_state.step = 4
        st.rerun()


def _resume_preview(resume: ResumeDocument) -> None:  # pragma: no cover - browser-verified UI
    st.markdown(f"### {resume.contact.full_name}")
    if resume.professional_summary:
        st.write(resume.professional_summary)
    for role in resume.work_experience:
        st.markdown(f"**{role.title} — {role.employer}**")
        for bullet in role.bullets:
            st.markdown(f"- {bullet.text}")


def _render_export() -> None:  # pragma: no cover - browser-verified UI
    resume: ResumeDocument = st.session_state.resume
    original: ResumeDocument = st.session_state.original_resume
    changed_count = count_changed_bullets(original, resume)
    st.header("Verify and export")
    st.markdown(
        f'<p class="beat-lead">{changed_count} work-experience bullet'
        f"{'s' if changed_count != 1 else ''} changed. "
        "Review the final wording before download.</p>",
        unsafe_allow_html=True,
    )
    st.warning(DISCLAIMER)
    if st.session_state.analysis_stale:
        st.markdown(
            '<p class="beat-stale">Your latest edits have not been re-analyzed.</p>',
            unsafe_allow_html=True,
        )
        if st.button("Re-run analysis"):
            try:
                with st.spinner("Recalculating the advisory alignment…"):
                    st.session_state.analysis = _run_analysis(resume)
                st.session_state.analysis_stale = False
                st.rerun()
            except (FrontendApiError, ValidationError) as exc:
                st.error(str(exc))

    with st.expander("Final resume preview", expanded=True):
        _resume_preview(resume)

    if st.button("Generate ATS-safe Word file", type="primary"):
        try:
            with st.spinner("Building the single-column Word document…"):
                response = _api_request(
                    "POST",
                    "/api/v1/documents/docx",
                    json_payload=resume.model_dump(mode="json"),
                )
                st.session_state.docx_bytes = response.content
        except FrontendApiError as exc:
            st.error(str(exc))

    if st.session_state.docx_bytes:
        st.download_button(
            "Download tailored_resume.docx",
            data=st.session_state.docx_bytes,
            file_name="tailored_resume.docx",
            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            type="primary",
        )
    if st.button("Back to tailoring"):
        st.session_state.step = 3
        st.rerun()


def main() -> None:  # pragma: no cover - browser-verified UI
    st.set_page_config(
        page_title="Beat ATS",
        page_icon="✓",
        layout="wide",
        initial_sidebar_state="collapsed",
    )
    st.markdown(STYLES, unsafe_allow_html=True)
    _initialize_state()

    title_column, clear_column = st.columns([5, 1])
    title_column.title("Beat ATS")
    title_column.markdown(
        '<p class="beat-lead">Tailor to the role. Keep every fact yours.</p>',
        unsafe_allow_html=True,
    )
    if clear_column.button("Clear session", help="Remove resume and job data from this session"):
        _clear_session()
        st.rerun()

    step = int(st.session_state.step)
    _render_progress(step)
    if step == 1:
        _render_upload()
    elif step == 2:
        _render_review()
    elif step == 3:
        _render_tailor()
    else:
        _render_export()


if __name__ == "__main__":
    main()
