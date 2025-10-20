"""Startup helper that materializes client config from environment and runs Uvicorn."""

from __future__ import annotations

import json
import os
from pathlib import Path


def _required_env(name: str) -> str:
    try:
        return os.environ[name]
    except KeyError as exc:  # pragma: no cover - defensive for production startup
        raise RuntimeError(f"Missing required environment variable: {name}") from exc


def build_client_definition() -> dict:
    client_id = _required_env("ACTIVE_CLIENT_ID")
    client_display = os.environ.get("ACTIVE_CLIENT_DISPLAY_NAME", client_id)
    collection = os.environ.get("ACTIVE_CLIENT_COLLECTION_ID")

    theme: dict[str, str] = {}
    theme_overrides = {
        "ACTIVE_CLIENT_PRIMARY_COLOR": "primaryColor",
        "ACTIVE_CLIENT_LOGO_URL": "logoUrl",
        "ACTIVE_CLIENT_BACKGROUND_IMAGE_URL": "backgroundImageUrl",
    }
    for env_name, field in theme_overrides.items():
        value = os.environ.get(env_name)
        if value:
            theme[field] = value

    client: dict[str, object] = {
        "id": client_id,
        "displayName": client_display,
        "theme": theme,
    }
    if collection:
        client["collectionId"] = collection

    welcome = os.environ.get("ACTIVE_CLIENT_WELCOME_MESSAGE")
    if welcome:
        client["welcomeMessage"] = welcome

    return client


def ensure_client_config_file() -> Path:
    path = Path(os.environ.get("CLIENT_CONFIG_PATH", "/app/configs/clients.json"))
    if path.is_file():
        return path

    path.parent.mkdir(parents=True, exist_ok=True)
    client_definition = build_client_definition()
    with path.open("w", encoding="utf-8") as handle:
        json.dump([client_definition], handle, indent=2)
        handle.write("\n")

    return path


def main() -> None:
    config_path = ensure_client_config_file()

    # Avoid circular import at module level while enabling reuse in main.py.
    os.environ.setdefault("CLIENT_CONFIG_PATH", str(config_path))

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
