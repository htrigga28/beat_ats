"""Regression checks for production deployment routing."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_vercel_routes_the_spa_and_api_to_separate_services() -> None:
    """FastAPI must not claim the root route before Vite can render the SPA."""

    config = json.loads((ROOT / "vercel.json").read_text())
    services = config["services"]
    rewrites = config["rewrites"]

    assert services["frontend"] == {"root": "frontend/", "framework": "vite"}
    assert services["backend"]["entrypoint"] == "analyzer:app"
    assert not (ROOT / "index.py").exists()
    assert rewrites[0] == {
        "source": "/api/:path*",
        "destination": {"service": "backend"},
    }
    assert rewrites[-1] == {
        "source": "/(.*)",
        "destination": {"service": "frontend"},
    }


def test_vercel_keeps_operational_routes_on_the_backend() -> None:
    config = json.loads((ROOT / "vercel.json").read_text())
    backend_sources = {
        rewrite["source"]
        for rewrite in config["rewrites"]
        if rewrite["destination"] == {"service": "backend"}
    }

    assert {"/healthz", "/docs/:path*", "/redoc/:path*", "/openapi.json"} <= backend_sources
