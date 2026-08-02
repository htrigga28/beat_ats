"""Regression checks for production deployment routing."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_vercel_upload_includes_built_spa_output() -> None:
    """The FastAPI deployment must not discard Vite's ``public/`` output."""

    ignored_paths = {
        line.strip().rstrip("/")
        for line in (ROOT / ".vercelignore").read_text().splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    }
    config = json.loads((ROOT / "vercel.json").read_text())

    assert "public" not in ignored_paths
    assert config["buildCommand"].endswith("npm run build")
    assert any(rewrite["destination"] == "/index.html" for rewrite in config["rewrites"])
