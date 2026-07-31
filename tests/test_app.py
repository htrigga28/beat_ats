from __future__ import annotations

from copy import deepcopy

from streamlit.testing.v1 import AppTest

from app import apply_rewrite_choices, count_changed_bullets
from schemas import ResumeDocument


def _resume() -> ResumeDocument:
    return ResumeDocument.model_validate(
        {
            "contact": {"full_name": "Jane Doe"},
            "work_experience": [
                {
                    "employer": "Example",
                    "title": "Frontend Engineer",
                    "bullets": [
                        {"id": "bullet-1", "text": "Built React interfaces"},
                        {"id": "bullet-2", "text": "Worked with designers"},
                    ],
                }
            ],
        }
    )


def test_apply_rewrite_preserves_original_and_unselected_bullets() -> None:
    original = _resume()
    original_snapshot = deepcopy(original.model_dump())

    tailored = apply_rewrite_choices(original, {"bullet-1": "Built accessible React interfaces"})

    assert original.model_dump() == original_snapshot
    assert tailored.work_experience[0].bullets[0].text == "Built accessible React interfaces"
    assert tailored.work_experience[0].bullets[1].text == "Worked with designers"
    assert tailored.work_experience[0].bullets[0].id == "bullet-1"


def test_count_changed_bullets_uses_stable_ids() -> None:
    original = _resume()
    tailored = apply_rewrite_choices(original, {"bullet-2": "Partnered with designers"})

    assert count_changed_bullets(original, tailored) == 1


def test_streamlit_initial_state_renders_without_backend() -> None:
    application = AppTest.from_file("app.py")
    application.run(timeout=15)

    assert not application.exception
    assert application.title[0].value == "Beat ATS"
    assert any("Upload your current resume" in header.value for header in application.header)
    assert application.file_uploader
    assert application.text_area
    assert application.checkbox
