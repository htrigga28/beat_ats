# Beat ATS

Beat ATS is a private, single-user resume tailoring application. It extracts PDF and
DOCX resumes, asks Gemini for schema-constrained analysis and bullet alternatives, and
generates a simple single-column Word resume designed for conventional ATS parsers.

The match score is an advisory comparison based on explicit resume evidence; it is not
a hiring promise or a score from a specific ATS vendor.

## Local setup

Python 3.11 or newer and Node 22 or newer are required.

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
cp .env.example .env
cd frontend && npm ci && npm run build && cd ..
```

Set `GEMINI_API_KEY` in `.env`. Keep it server-side; the browser never receives it.

Start FastAPI and the Vite development server in separate terminals:

```bash
.venv/bin/uvicorn analyzer:app --host 127.0.0.1 --port 8000
cd frontend && npm run dev
```

Open <http://127.0.0.1:5173>. Vite proxies `/api`, `/healthz`, `/docs`, and
`/openapi.json` to FastAPI. The default local/Docker limit is 10 MiB.

## Docker Compose

```bash
docker compose up --build
```

The single application service serves both the React SPA and FastAPI from
<http://127.0.0.1:8000>. It uses a Node 22 build stage, a Python slim runtime, a
read-only filesystem, and `/tmp` tmpfs. Override `MAX_UPLOAD_BYTES` only when the
deployment deliberately changes its upload contract.

## Vercel

Vercel deploys `frontend/` as a Vite service and `analyzer:app` as a FastAPI service,
and serves the compiled SPA and API from one origin. It sets `MAX_UPLOAD_BYTES=4194304`
(4 MiB), below Vercel's function payload ceiling. The runtime UI displays this lower
limit before an upload is sent.

Configure these Vercel environment variables:

```text
GEMINI_API_KEY
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_SECONDS=60
GEMINI_MAX_ATTEMPTS=3
MAX_UPLOAD_BYTES=4194304
```

### Gemini model and quota choice

The default is `gemini-3.1-flash-lite`, a stable multimodal model that supports PDF
input, structured JSON output, and thinking. It is intended for high-frequency,
high-volume document and extraction workflows, which matches this application better
than the previous `gemini-3.6-flash` default.

Google applies free-tier limits per project and model across requests per minute,
input tokens per minute, and requests per day. The limits are not universal or
guaranteed; check the active project limits in [Google AI Studio](https://aistudio.google.com/)
before sharing a deployment. See Google's [model guide](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
and [rate-limit guide](https://ai.google.dev/gemini-api/docs/rate-limits) for the
current capabilities and quota rules.

## Privacy model

- Uploaded bytes are processed in memory and released after the request.
- The browser keeps the current structured resume, job description, and generated Blob
  only in session memory. Nothing is written to cookies, local storage, session
  storage, IndexedDB, or a service worker.
- No application result cache or Gemini context cache is enabled. This avoids retaining
  resume data and matches the current free-tier context-cache availability for the
  selected Flash-Lite model.
- Scanned PDFs are sent as inline bytes only after explicit vision permission.
- Prompt bodies, resume text, job descriptions, and model responses are never logged.

## API

- `GET /healthz`
- `GET /api/v1/config`
- `POST /api/v1/resumes/ingest`
- `POST /api/v1/analyses`
- `POST /api/v1/rewrites`
- `POST /api/v1/documents/docx`

The compiled SPA is served at `/`; `/docs` and `/openapi.json` remain available.

## Validation

```bash
.venv/bin/ruff check .
.venv/bin/ruff format --check .
.venv/bin/mypy parser.py schemas.py settings.py analyzer.py generator.py
.venv/bin/python -m pytest --cov=. --cov-report=term-missing --cov-fail-under=85
.venv/bin/python -m scripts.verify_gemini_model --resume /path/to/resume.pdf
cd frontend
PATH="/path/to/node-22/bin:$PATH" npm run lint
PATH="/path/to/node-22/bin:$PATH" npm run typecheck
PATH="/path/to/node-22/bin:$PATH" npm test
PATH="/path/to/node-22/bin:$PATH" npm run build
```

The Gemini smoke test makes one real, structured-output request using the configured
model. Run it before changing `GEMINI_MODEL` or promoting a deployment; it catches
provider/schema incompatibilities that unit tests cannot see.
