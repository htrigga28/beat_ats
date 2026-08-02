"""Vercel entrypoint for the FastAPI service.

The Streamlit UI remains the long-running local/Docker client. Vercel serves the
stateless API and its OpenAPI documentation through the Python runtime.
"""

from analyzer import app

__all__ = ["app"]
