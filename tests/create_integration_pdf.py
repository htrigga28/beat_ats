"""Create the non-private PDF used by the real-stack browser test."""

from __future__ import annotations

import argparse
from pathlib import Path

from reportlab.pdfgen import canvas


def create_pdf(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    document = canvas.Canvas(str(output))
    text = document.beginText(72, 760)
    for line in (
        "Test Candidate",
        "Frontend Engineer",
        "Built reliable frontend interfaces for product teams.",
        "This non-private document exists only for integration testing.",
    ):
        text.textLine(line)
    document.drawText(text)
    document.save()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    create_pdf(args.output)


if __name__ == "__main__":
    main()
