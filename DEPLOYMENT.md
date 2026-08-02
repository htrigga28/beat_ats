# Deployment

## Vercel API deployment

The Vercel deployment serves the FastAPI service through `index.py`. After deployment:

Production URL: https://beat-ats-teal.vercel.app

- `/` is the API landing response
- `/healthz` is the health check
- `/docs` is the interactive API documentation
- `/api/v1/...` contains the resume ingestion, analysis, rewrite, and DOCX endpoints

Vercel does not run the persistent Streamlit server or Docker Compose. Run the existing
Streamlit UI with Docker Compose, or use another long-running Python host for the UI and
set `BACKEND_URL` to this Vercel deployment URL.

Configure these Vercel environment variables for Production and Preview deployments:

```text
GEMINI_API_KEY
GEMINI_MODEL=gemini-3.6-flash
GEMINI_TIMEOUT_SECONDS=60
GEMINI_MAX_ATTEMPTS=3
```

Never commit `.env` or paste the API key into the Streamlit UI.

## Git workflow

- `main`: production branch
- `develop`: integration branch for the next release
- `codex/*`, `feature/*`, or `fix/*`: short-lived update branches

Open pull requests into `develop`, validate there, and promote `develop` to `main`
when the release is ready.
