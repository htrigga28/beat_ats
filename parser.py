"""Secure, in-memory resume text extraction for PDF and DOCX uploads."""

from __future__ import annotations

import re
import unicodedata
import zipfile
from collections.abc import Iterator
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import pdfplumber
from docx import Document
from docx.document import Document as DocumentObject
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph
from pdfminer.pdfdocument import PDFPasswordIncorrect

DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 20
MAX_DOCX_EXPANDED_BYTES = 50 * 1024 * 1024
MIN_LOCAL_PDF_CHARACTERS = 100


class ResumeParsingError(ValueError):
    """Base class for safe, user-facing resume ingestion failures."""


class UnsupportedFileTypeError(ResumeParsingError):
    """Raised when the extension and file signature are not supported."""


class DocumentTooLargeError(ResumeParsingError):
    """Raised when an upload exceeds a configured safety limit."""


class CorruptDocumentError(ResumeParsingError):
    """Raised when a document cannot be parsed safely."""


class EncryptedDocumentError(ResumeParsingError):
    """Raised when a PDF requires a password."""


@dataclass(frozen=True, slots=True)
class ExtractionResult:
    """Normalized text plus metadata needed by the ingestion route."""

    text: str
    file_type: str
    page_count: int | None = None
    needs_vision_fallback: bool = False
    warnings: tuple[str, ...] = ()


_CHAR_TRANSLATION = str.maketrans(
    {
        "\u00a0": " ",
        "\u2007": " ",
        "\u202f": " ",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2212": "-",
    }
)
_BULLET_PREFIX = re.compile(
    "^(?:[\u2022\u25cf\u25cb\u25e6\u25aa\u25ab\u25a0\u25a1\u25ba\u25b8\u2023\u2043\u2219\u00b7]"
    "|[-\u2013\u2014])\\s*"
)
_HORIZONTAL_WHITESPACE = re.compile(r"[\t \f\v]+")


def clean_text(text: str) -> str:
    """Normalize extraction noise without rewriting the candidate's content."""

    normalized = unicodedata.normalize("NFKC", text).translate(_CHAR_TRANSLATION)
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = "".join(
        character
        for character in normalized
        if character in {"\n", "\t"} or not unicodedata.category(character).startswith("C")
    )

    cleaned_lines: list[str] = []
    previous_blank = False
    for raw_line in normalized.split("\n"):
        line = _HORIZONTAL_WHITESPACE.sub(" ", raw_line).strip()
        if line:
            if _BULLET_PREFIX.match(line):
                line = f"• {_BULLET_PREFIX.sub('', line).strip()}"
            cleaned_lines.append(line)
            previous_blank = False
        elif cleaned_lines and not previous_blank:
            cleaned_lines.append("")
            previous_blank = True

    while cleaned_lines and not cleaned_lines[-1]:
        cleaned_lines.pop()
    return "\n".join(cleaned_lines)


def _read_bytes(source: bytes | bytearray | BytesIO) -> bytes:
    if isinstance(source, bytes):
        return source
    if isinstance(source, bytearray):
        return bytes(source)
    return source.getvalue()


def _format_megabytes(max_upload_bytes: int) -> str:
    megabytes = max_upload_bytes / (1024 * 1024)
    return f"{megabytes:g} MB"


def _enforce_upload_size(data: bytes, max_upload_bytes: int) -> None:
    if len(data) > max_upload_bytes:
        raise DocumentTooLargeError(
            f"Resume uploads must be {_format_megabytes(max_upload_bytes)} or smaller."
        )


def extract_pdf_text(
    source: bytes | bytearray | BytesIO,
    *,
    max_upload_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
) -> ExtractionResult:
    """Extract text from a text-based PDF and flag likely scans for Gemini vision."""

    data = _read_bytes(source)
    _enforce_upload_size(data, max_upload_bytes)
    if not data.startswith(b"%PDF-"):
        raise UnsupportedFileTypeError("The uploaded file is not a valid PDF.")

    try:
        with pdfplumber.open(BytesIO(data)) as pdf:
            page_count = len(pdf.pages)
            if page_count > MAX_PDF_PAGES:
                raise DocumentTooLargeError(
                    f"PDF resumes may contain at most {MAX_PDF_PAGES} pages."
                )
            # A tighter horizontal tolerance prevents tightly kerned resume text from
            # collapsing adjacent words while retaining ordinary word grouping.
            page_text = [
                page.extract_text(x_tolerance=2, y_tolerance=3) or "" for page in pdf.pages
            ]
    except DocumentTooLargeError:
        raise
    except PDFPasswordIncorrect as exc:
        raise EncryptedDocumentError(
            "Password-protected PDFs are not supported. Export an unlocked copy."
        ) from exc
    except Exception as exc:
        raise CorruptDocumentError("The PDF could not be read safely.") from exc

    text = clean_text("\n\n".join(page_text))
    printable_count = sum(not character.isspace() for character in text)
    needs_vision = printable_count < MIN_LOCAL_PDF_CHARACTERS
    warnings = (
        (
            (
                "Very little selectable text was found. Gemini vision processing is required "
                "for this PDF."
            ),
        )
        if needs_vision
        else ()
    )
    return ExtractionResult(
        text=text,
        file_type="pdf",
        page_count=page_count,
        needs_vision_fallback=needs_vision,
        warnings=warnings,
    )


def _validate_docx_archive(data: bytes) -> None:
    if not data.startswith(b"PK"):
        raise UnsupportedFileTypeError("The uploaded file is not a valid DOCX document.")
    try:
        with zipfile.ZipFile(BytesIO(data)) as archive:
            names = set(archive.namelist())
            required = {"[Content_Types].xml", "word/document.xml"}
            if not required.issubset(names):
                raise CorruptDocumentError("The DOCX package is missing required document data.")
            expanded_size = sum(item.file_size for item in archive.infolist())
            if expanded_size > MAX_DOCX_EXPANDED_BYTES:
                raise DocumentTooLargeError(
                    "The expanded DOCX content exceeds the 50 MB safety limit."
                )
    except DocumentTooLargeError:
        raise
    except (zipfile.BadZipFile, OSError) as exc:
        raise CorruptDocumentError("The DOCX package is corrupt or incomplete.") from exc


def _iter_document_blocks(document: DocumentObject) -> Iterator[Paragraph | Table]:
    for child in document.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, document)
        elif isinstance(child, CT_Tbl):
            yield Table(child, document)


def _paragraph_text(paragraph: Paragraph) -> str:
    text = paragraph.text.strip()
    if not text:
        return ""
    style_name = paragraph.style.name.lower() if paragraph.style else ""
    properties = paragraph._p.pPr
    has_numbering = properties is not None and properties.numPr is not None
    if ("list bullet" in style_name or has_numbering) and not _BULLET_PREFIX.match(text):
        return f"• {text}"
    return text


def extract_docx_text(
    source: bytes | bytearray | BytesIO,
    *,
    max_upload_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
) -> ExtractionResult:
    """Extract paragraphs and table cells from a DOCX in document order."""

    data = _read_bytes(source)
    _enforce_upload_size(data, max_upload_bytes)
    _validate_docx_archive(data)
    try:
        document = Document(BytesIO(data))
        lines: list[str] = []
        for block in _iter_document_blocks(document):
            if isinstance(block, Paragraph):
                text = _paragraph_text(block)
                if text:
                    lines.append(text)
                continue
            for row in block.rows:
                cells = [clean_text(cell.text) for cell in row.cells]
                populated = [cell.replace("\n", " ") for cell in cells if cell]
                if populated:
                    lines.append(" | ".join(populated))
    except ResumeParsingError:
        raise
    except Exception as exc:
        raise CorruptDocumentError("The DOCX document could not be read safely.") from exc

    text = clean_text("\n".join(lines))
    warnings = () if text else ("No readable text was found in the DOCX document.",)
    return ExtractionResult(text=text, file_type="docx", warnings=warnings)


def extract_resume(
    data: bytes,
    filename: str,
    *,
    max_upload_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
) -> ExtractionResult:
    """Dispatch to the correct parser after checking extension and file signature."""

    _enforce_upload_size(data, max_upload_bytes)
    extension = Path(filename).suffix.lower()
    if extension == ".pdf":
        return extract_pdf_text(data, max_upload_bytes=max_upload_bytes)
    if extension == ".docx":
        return extract_docx_text(data, max_upload_bytes=max_upload_bytes)
    raise UnsupportedFileTypeError("Only PDF and DOCX resume files are supported.")
