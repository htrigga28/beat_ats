"""Run a real provider/schema smoke test before deploying a Gemini model change."""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from analyzer import GeminiService
from parser import extract_resume
from settings import get_settings


def _resume_text(path: Path | None) -> str:
    if path is None:
        return "Jane Doe\nFrontend Engineer\nBuilt React interfaces for product teams."

    data = path.read_bytes()
    extraction = extract_resume(data, path.name, max_upload_bytes=get_settings().max_upload_bytes)
    if extraction.needs_vision_fallback:
        raise RuntimeError(
            "The smoke-test resume requires vision; provide a text-based PDF or DOCX."
        )
    return extraction.text


async def _run(path: Path | None) -> None:
    settings = get_settings()
    if settings.gemini_api_key is None:
        raise RuntimeError("GEMINI_API_KEY is required for the Gemini model smoke test.")

    service = GeminiService(settings)
    try:
        result = await service.structure_resume_text(_resume_text(path))
    finally:
        await service.close()

    if not result.contact.full_name:
        raise RuntimeError("Gemini returned an empty structured resume.")
    print(f"Gemini model smoke passed: {settings.gemini_model}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--resume",
        type=Path,
        help="Optional local PDF or DOCX to exercise the same extraction path as the UI.",
    )
    args = parser.parse_args()
    asyncio.run(_run(args.resume))


if __name__ == "__main__":
    main()
