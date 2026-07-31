# Beat ATS

Beat ATS is a private, single-user resume tailoring application. It extracts PDF and
DOCX resumes, asks Gemini for schema-constrained analysis and bullet alternatives, and
generates a simple single-column Word resume designed for conventional ATS parsers.

The software does not promise a hiring outcome or reproduce any ATS vendor's score.
Its match score is an advisory comparison based on explicit resume evidence.

## What is included

- In-memory PDF and DOCX extraction with signature, size, page-count, encryption, and
  expanded-DOCX safeguards.
- Inline Gemini vision fallback for image-only PDFs. The Gemini Files API is never used.
- Editable structured resume review before analysis or export.
- Structured gap analysis and 2–3 alternatives for selected work bullets.
- Prompt guardrails plus deterministic rejection of newly introduced numbers, dates,
  percentages, and currency values.
- ATS-safe DOCX output with one column, real Word bullets, recognized section headings,
  and no tables, images, text boxes, headers, footers, hidden text, or white text.
- Streamlit workflow with explicit consent, privacy/tier disclosure, stale-analysis
  warnings, manual re-analysis, and session clearing.

## Local setup

Python 3.11 or newer is required.

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
```

Set `GEMINI_API_KEY` in `.env`. Keep it server-side; never paste it into the Streamlit
interface or commit `.env`.

Start the API:

```bash
.venv/bin/uvicorn analyzer:app --host 127.0.0.1 --port 8000
```

In a second terminal, start the private UI:

```bash
.venv/bin/streamlit run app.py --server.address 127.0.0.1 --server.port 8501
```

Open `http://127.0.0.1:8501`.

## Docker Compose

Create `.env`, then run:

```bash
docker compose up --build
```

Only Streamlit is bound to the host, at `127.0.0.1:8501`. FastAPI remains on the
private Compose network. The services use read-only filesystems with temporary memory
available at `/tmp`.

## Privacy model

- Uploaded bytes are processed with `BytesIO` and released after the request. The
  application does not write resumes, JDs, structured profiles, or generated DOCX files
  to disk.
- Streamlit keeps the current structured resume and JD only in session memory. “Clear
  session” removes those values immediately.
- Normal PDF/DOCX ingestion sends normalized text to Gemini. A scanned PDF is sent as
  inline request bytes only after explicit permission.
- Prompt bodies, resume text, JD text, and model responses are never logged.
- Free-tier and billing-enabled Gemini projects have different data-handling terms. A
  billing-enabled project is recommended for production-sensitive documents.

This first release assumes a trusted private network and has no user accounts. Do not
expose it publicly without authentication, rate limiting, TLS termination, and an
updated threat model.

## API

- `GET /healthz`
- `POST /api/v1/resumes/ingest`
- `POST /api/v1/analyses`
- `POST /api/v1/rewrites`
- `POST /api/v1/documents/docx`

Interactive API documentation is available at `/docs` while FastAPI is running.

## Validation

Install development dependencies and run:

```bash
.venv/bin/python -m pip install -r requirements-dev.txt
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/mypy parser.py schemas.py settings.py analyzer.py generator.py app.py
.venv/bin/python -m pytest --cov=. --cov-report=term-missing --cov-fail-under=85
```

Tests mock Gemini and never send the included resume or fixtures to an external service.

