"""Copy one fresh frontend build into the FastAPI integration-test target."""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend" / "dist"
TARGET = ROOT / "public"
MARKER = "__beat-ats-integration-build.txt"


def prepare_static_target() -> str:
    root = ROOT.resolve()
    source = SOURCE.resolve()
    if source.parent != (root / "frontend").resolve() or not source.is_dir():
        raise RuntimeError("A fresh frontend/dist build is required for the integration test.")
    if TARGET.parent.resolve() != root or TARGET.name != "public" or TARGET.is_symlink():
        raise RuntimeError("The integration target must be the repository public directory.")
    if TARGET.exists():
        if TARGET.resolve().parent != root:
            raise RuntimeError("The integration target resolves outside the repository root.")
        shutil.rmtree(TARGET)
    shutil.copytree(source, TARGET)
    marker = hashlib.sha256((source / "index.html").read_bytes()).hexdigest()
    (TARGET / MARKER).write_text(marker, encoding="utf-8")
    return marker


if __name__ == "__main__":
    print(prepare_static_target())
