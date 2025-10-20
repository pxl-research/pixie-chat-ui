"""Startup helper that runs Uvicorn with environment-based configuration."""

from __future__ import annotations

import os


def main() -> None:
    """Start Uvicorn server with configuration from environment variables."""
    # Verify required environment variable
    if "ACTIVE_CLIENT_ID" not in os.environ:
        raise RuntimeError("Missing required environment variable: ACTIVE_CLIENT_ID")

    uvicorn_args = [
        "uvicorn",
        os.environ.get("UVICORN_APP", "main:app"),
        "--host",
        os.environ.get("UVICORN_HOST", "0.0.0.0"),
        "--port",
        os.environ.get("UVICORN_PORT", "8000"),
    ]

    reload_flag = os.environ.get("UVICORN_RELOAD")
    if reload_flag and reload_flag.lower() not in {"0", "false"}:
        uvicorn_args.append("--reload")

    os.execvp("uvicorn", uvicorn_args)


if __name__ == "__main__":  # pragma: no cover - script entry point
    main()
