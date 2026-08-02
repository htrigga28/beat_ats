"""Regression checks for production deployment routing."""

from __future__ import annotations

import json
from fnmatch import fnmatchcase
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPA_ARTIFACTS = ("public", "public/index.html", "public/assets/app.js")


def _hides_spa_output(pattern: str) -> bool:
    normalized = pattern.lstrip("/")
    return normalized.rstrip("/") == "public" or any(
        fnmatchcase(artifact, normalized) for artifact in SPA_ARTIFACTS
    )


def test_vercel_upload_includes_built_spa_output() -> None:
    """The FastAPI deployment must not discard Vite's ``public/`` output."""

    ignored_patterns = [
        line.strip()
        for line in (ROOT / ".vercelignore").read_text().splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]
    config = json.loads((ROOT / "vercel.json").read_text())

    assert not any(_hides_spa_output(pattern) for pattern in ignored_patterns)
    assert config["buildCommand"].endswith("npm run build")
    assert config["outputDirectory"] == "public"
    assert any(rewrite["destination"] == "/index.html" for rewrite in config["rewrites"])


def test_spa_ignore_detector_catches_equivalent_patterns() -> None:
    for pattern in ("public", "public/", "/public", "public/*", "public/**"):
        assert _hides_spa_output(pattern)
