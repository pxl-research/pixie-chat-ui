import asyncio
import os
import sys
from datetime import timedelta
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("ACTIVE_CLIENT_ID", "test-client")

SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

import main  # noqa: E402


def _normalize(data: dict, fallback_state: dict | None = None) -> dict:
    return main._normalize_chat_response(  # type: ignore[attr-defined]
        data=data,
        session_id="session-123",
        fallback_state=fallback_state or {},
    )


def test_normalize_chat_response_handles_string_quick_replies() -> None:
    result = _normalize(
        {
            "type": "answer",
            "text": "Wil je doorgaan?",
            "quick_replies": ["  Ja  ", "Nee", "ja", "   "],
        }
    )

    assert result["type"] == "answer"
    assert result["quick_replies"] == [
        {"label": "Ja", "value": "Ja"},
        {"label": "Nee", "value": "Nee"},
    ]


def test_normalize_chat_response_handles_object_quick_replies_from_state() -> None:
    result = _normalize(
        {
            "type": "answer",
            "text": "Choose one",
            "state": {
                "options": [
                    {"label": "Yes", "value": "yes"},
                    {"label": "No", "value": "no"},
                ]
            },
        }
    )

    assert result["quick_replies"] == [
        {"label": "Yes", "value": "yes"},
        {"label": "No", "value": "no"},
    ]


def test_normalize_chat_response_dedupes_and_limits_quick_replies() -> None:
    result = _normalize(
        {
            "type": "answer",
            "text": "Kies",
            "quickReplies": [
                {"label": "Optie 1", "value": "1"},
                {"label": "Optie 1 duplicate", "value": "1"},
                {"label": "Optie 2", "value": "2"},
                {"label": "Optie 3", "value": "3"},
                {"label": "Optie 4", "value": "4"},
                {"label": "Optie 5", "value": "5"},
                {"label": "Optie 6", "value": "6"},
                {"label": "Optie 7", "value": "7"},
                42,
                {"label": "   ", "value": "ignored"},
            ],
        }
    )

    assert result["quick_replies"] == [
        {"label": "Optie 1", "value": "1"},
        {"label": "Optie 2", "value": "2"},
        {"label": "Optie 3", "value": "3"},
        {"label": "Optie 4", "value": "4"},
        {"label": "Optie 5", "value": "5"},
        {"label": "Optie 6", "value": "6"},
    ]


def test_normalize_chat_response_keeps_summary_and_followup_with_quick_replies() -> None:
    result = _normalize(
        {
            "type": "answer",
            "text": "Dank je wel",
            "summary": "Samenvatting",
            "follow_up_question": "Ga je verder?",
            "suggested_answers": ["Ja", "Nee"],
        }
    )

    assert result["summary"] == "Samenvatting"
    assert result["follow_up_question"] == "Ga je verder?"
    assert result["quick_replies"] == [
        {"label": "Ja", "value": "Ja"},
        {"label": "Nee", "value": "Nee"},
    ]


def test_normalize_chat_response_omits_quick_replies_for_summary_type() -> None:
    result = _normalize(
        {
            "type": "summary",
            "text": "Bedankt",
            "summary": "Final summary",
            "quick_replies": ["Ja", "Nee"],
        }
    )

    assert result["type"] == "summary"
    assert "quick_replies" not in result


@pytest.mark.parametrize(
    ("key", "expected"),
    [
        ("choices", [{"label": "Ja", "value": "Ja"}]),
        ("options", [{"label": "Ja", "value": "Ja"}]),
        ("suggested_answers", [{"label": "Ja", "value": "Ja"}]),
    ],
)
def test_normalize_chat_response_supports_alternative_keys(
    key: str, expected: list[dict[str, str]]
) -> None:
    result = _normalize({"type": "answer", "text": "Vraag", key: ["Ja"]})

    assert result["quick_replies"] == expected


def test_call_qa_backend_accepts_questioner_contract_v2_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class StubHttpClient:
        def __init__(self, response: httpx.Response) -> None:
            self._response = response

        async def post(self, *_args: object, **_kwargs: object) -> httpx.Response:
            return self._response

    async def run_test() -> None:
        original_target = main.PIXIE_BACKEND_TARGET
        original_contract = main.PIXIE_CHAT_CONTRACT_VERSION
        original_strict = main.STRICT_QUESTIONER_CHAT_CONTRACT

        try:
            main.PIXIE_BACKEND_TARGET = "questioner"
            main.PIXIE_CHAT_CONTRACT_VERSION = main.DEFAULT_CHAT_CONTRACT_VERSION
            main.STRICT_QUESTIONER_CHAT_CONTRACT = True

            backend_response = httpx.Response(
                status_code=200,
                request=httpx.Request("POST", "http://questioner-api:8000/chat"),
                headers={"X-Pixie-Chat-Contract": "chat-v2.0.0"},
                json={"type": "answer", "text": "ok", "state": {}},
            )

            async def fake_get_http_client() -> StubHttpClient:
                return StubHttpClient(backend_response)

            monkeypatch.setattr(main, "get_http_client", fake_get_http_client)

            data, contract_version = await main.call_qa_backend(
                current_answer="Hallo",
                session_id="session-1",
                state={},
                history=None,
            )
        finally:
            main.PIXIE_BACKEND_TARGET = original_target
            main.PIXIE_CHAT_CONTRACT_VERSION = original_contract
            main.STRICT_QUESTIONER_CHAT_CONTRACT = original_strict

        assert data["text"] == "ok"
        assert contract_version == "chat-v2.0.0"

    asyncio.run(run_test())


def test_build_client_payload_exposes_debug_toggle_flags() -> None:
    original_toggle = main.ACTIVE_CLIENT_DEBUG_TOGGLE_ENABLED
    original_default = main.ACTIVE_CLIENT_DEBUG_DEFAULT_ENABLED
    try:
        main.ACTIVE_CLIENT_DEBUG_TOGGLE_ENABLED = True
        main.ACTIVE_CLIENT_DEBUG_DEFAULT_ENABLED = False
        payload = main.build_client_payload()
    finally:
        main.ACTIVE_CLIENT_DEBUG_TOGGLE_ENABLED = original_toggle
        main.ACTIVE_CLIENT_DEBUG_DEFAULT_ENABLED = original_default

    assert payload["debug"] == {"toggleEnabled": True, "defaultEnabled": False}


def _patch_chat_dependencies(
    monkeypatch: pytest.MonkeyPatch,
    *,
    captured_payloads: list[dict[str, object]] | None = None,
) -> None:
    async def _fake_ready() -> None:
        return None

    async def _fake_call_pixie(payload: dict[str, object]) -> dict[str, object]:
        if captured_payloads is not None:
            captured_payloads.append(payload)
        return {
            "type": "answer",
            "text": "ok",
            "conversation_id": payload.get("session_id", "session-1"),
            "state": payload.get("state", {}),
        }

    monkeypatch.setattr(main, "ensure_backend_ready", _fake_ready)
    monkeypatch.setattr(main, "call_pixie", _fake_call_pixie)


def _reset_abuse_state() -> None:
    main._minute_window_by_client.clear()
    main._hour_window_by_client.clear()
    main._blocked_until_by_client.clear()
    main._session_last_seen_by_id.clear()


def test_chat_rejects_oversized_input(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_chat_dependencies(monkeypatch)
    _reset_abuse_state()
    client = TestClient(main.app)

    response = client.post(
        "/chat",
        json={
            "session_id": "session-oversized",
            "current_answer": "x" * (main.MAX_CHAT_INPUT_CHARS + 1),
            "state": {},
        },
    )

    assert response.status_code in {413, 422}


def test_chat_rejects_oversized_state(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_chat_dependencies(monkeypatch)
    _reset_abuse_state()
    client = TestClient(main.app)

    response = client.post(
        "/chat",
        json={
            "session_id": "session-state",
            "current_answer": "hallo",
            "state": {"blob": "x" * (main.MAX_CHAT_STATE_BYTES + 256)},
        },
    )

    assert response.status_code == 413


def test_chat_rate_limits_repeated_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_chat_dependencies(monkeypatch)
    _reset_abuse_state()

    original_minute_limit = main.RATE_LIMIT_PER_MINUTE
    original_hour_limit = main.RATE_LIMIT_PER_HOUR
    original_block_seconds = main.RATE_LIMIT_BLOCK_SECONDS
    try:
        main.RATE_LIMIT_PER_MINUTE = 2
        main.RATE_LIMIT_PER_HOUR = 10
        main.RATE_LIMIT_BLOCK_SECONDS = 60
        client = TestClient(main.app)

        payload = {
            "session_id": "session-rate",
            "current_answer": "hallo",
            "state": {},
        }
        first = client.post("/chat", json=payload)
        second = client.post("/chat", json=payload)
        third = client.post("/chat", json=payload)
    finally:
        main.RATE_LIMIT_PER_MINUTE = original_minute_limit
        main.RATE_LIMIT_PER_HOUR = original_hour_limit
        main.RATE_LIMIT_BLOCK_SECONDS = original_block_seconds

    assert first.status_code == 200
    assert second.status_code == 200
    assert third.status_code == 429


def test_chat_rejects_expired_session(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_chat_dependencies(monkeypatch)
    _reset_abuse_state()

    original_idle_timeout = main.SESSION_IDLE_TIMEOUT_SECONDS
    try:
        main.SESSION_IDLE_TIMEOUT_SECONDS = 1
        session_id = "session-idle"
        main._session_last_seen_by_id[session_id] = main._now() - timedelta(seconds=10)
        client = TestClient(main.app)
        response = client.post(
            "/chat",
            json={
                "session_id": session_id,
                "current_answer": "hallo",
                "state": {},
            },
        )
    finally:
        main.SESSION_IDLE_TIMEOUT_SECONDS = original_idle_timeout

    assert response.status_code == 440


def test_chat_prefers_gateway_location_header(monkeypatch: pytest.MonkeyPatch) -> None:
    captured_payloads: list[dict[str, object]] = []
    _patch_chat_dependencies(monkeypatch, captured_payloads=captured_payloads)
    _reset_abuse_state()

    original_allowed = main.ACTIVE_CLIENT_ALLOWED_LOCATIONS
    original_lookup = main.ACTIVE_CLIENT_ALLOWED_LOCATION_LOOKUP
    try:
        main.ACTIVE_CLIENT_ALLOWED_LOCATIONS = ["Jeansrek"]
        main.ACTIVE_CLIENT_ALLOWED_LOCATION_LOOKUP = {"jeansrek": "Jeansrek"}
        client = TestClient(main.app)
        response = client.post(
            "/chat",
            headers={"X-Pixie-Location": "jeansrek"},
            json={
                "session_id": "session-location",
                "current_answer": "hallo",
                "state": {"location": "pashokje"},
            },
        )
    finally:
        main.ACTIVE_CLIENT_ALLOWED_LOCATIONS = original_allowed
        main.ACTIVE_CLIENT_ALLOWED_LOCATION_LOOKUP = original_lookup

    assert response.status_code == 200
    assert captured_payloads
    forwarded_state = captured_payloads[-1]["state"]
    assert isinstance(forwarded_state, dict)
    assert forwarded_state["location"] == "Jeansrek"
