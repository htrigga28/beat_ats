# Deployment

## Docker

Docker builds the React app with Node 22, copies only the compiled `public/` assets to
the Python runtime, and serves both surfaces from `127.0.0.1:8000`. The default
`MAX_UPLOAD_BYTES` is 10 MiB. The service retains a read-only filesystem, `/tmp`
tmpfs, a health check, and server-side Gemini environment variables.

```bash
docker compose up --build
curl http://127.0.0.1:8000/healthz
```

## Vercel

Vercel deploys the repository as two explicit services: a Vite service rooted at
`frontend/` and a FastAPI service using `analyzer:app`. Requests under `/api`, plus
the health and API documentation routes, go to FastAPI; every other route goes to
Vite. This prevents FastAPI's root auto-detection from claiming `/` and returning a
JSON 404 instead of the application. Set `MAX_UPLOAD_BYTES=4194304` in Production
and Preview environments: Vercel is intentionally limited to 4 MiB, and the runtime
UI displays that limit before transmission.

The API and SPA share one origin. No `BACKEND_URL`, CORS middleware, temporary object
storage, database, or browser persistence is used.

Required environment variables:

```text
GEMINI_API_KEY
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_SECONDS=60
GEMINI_MAX_ATTEMPTS=3
MAX_UPLOAD_BYTES=4194304
```

Before changing `GEMINI_MODEL` or promoting a release, run the real provider smoke
test with a text-based resume. It validates the same structured extraction contract
used by the first UI step:

```bash
.venv/bin/python -m scripts.verify_gemini_model --resume /path/to/resume.pdf
```

`gemini-3.1-flash-lite` is the default because it is a stable multimodal model with
PDF input, structured outputs, and thinking support, while being designed for
high-frequency, high-volume workloads. Gemini free-tier quotas are applied per
project and model, and Google does not guarantee a single global RPM/TPM/RPD value.
Check the deployment project's active limits in [Google AI Studio](https://aistudio.google.com/)
and consult Google's [rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits)
before opening the deployment to more users.

## Private deployment gate

This product processes candidate data. Do not use a public deployment for a real resume.

- Docker stays bound to `127.0.0.1` by default.
- For Vercel, protect every production and preview URL with an **All Deployments** access
  check. Use Vercel Authentication, Password Protection, or Trusted IPs when the account
  plan supports it.
- Standard Protection does not protect the production domain. It is not a private
  production control.
- Do not deploy candidate data to Vercel if the account cannot protect production. Use
  localhost or another private provider boundary instead.

The deployer owns this manual release gate. Before a real resume is used, the deployer
must use a signed-out private browser and record the date, provider, protection method,
protection scope, deployment URL, and denial result for these requests:

- `GET /`
- `GET /api/v1/config`
- `POST /api/v1/analyses`

The denial must occur at the provider boundary. An application `404` or validation `422`
does not prove deployment protection. Store the signed-out check in pull-request or
release evidence. Do not store access tokens, bypass secrets, resume data, or request
bodies in that evidence. Do not store automation bypass secrets in Git or expose them to
the frontend.

If the deployer does not record all three provider denials, the release is localhost-only.

## Git workflow

- `main`: production branch
- `develop`: integration branch for the next release
- `codex/*`, `feature/*`, or `fix/*`: short-lived update branches

CI runs for pushes to `main` and `develop`, and for pull requests targeting either
branch. Open pull requests from a short-lived branch into `develop`, validate there,
and promote `develop` to `main` when the release is ready. Configure the Vercel
project's production branch as `main`; preview deployments can be used for pull
requests and other branches without changing production.

Production deployments should be made by the Vercel Git integration from `main`.
Use the Vercel CLI for preview or emergency deployments only, and confirm the
working tree is committed before using `--prod`.
