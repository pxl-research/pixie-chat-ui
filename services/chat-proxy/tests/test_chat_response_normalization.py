import os
import sys
from pathlib import Path

import pytest

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
