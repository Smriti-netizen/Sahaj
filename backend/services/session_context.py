"""Conversation memory for short follow-ups (e.g. 'abhi btao' after passport)."""
import re
from typing import Any

CONTINUATION_RE = re.compile(
    r"^(abhi\s+batao|abhi\s+btao|abhi\s+bata|jaldi\s+batao|tell\s+me\s+now|"
    r"tell\s+me|batao\s+abhi|now|please\s+tell|what\s+next|aage\s+kya|"
    r"continue|go\s+on|haan\s+batao|ok\s+batao|theek\s+hai\s+batao)\s*[.!?]*$",
    re.IGNORECASE,
)

TOPIC_KEYWORDS: dict[str, tuple[str, ...]] = {
    "passport": ("passport", "pass port", "visa"),
    "pan": ("pan card", "pan apply"),
    "driving_license": ("driving licence", "driving license", "dl apply", "learner"),
    "rti": ("rti", "right to information"),
    "fir": ("fir", "police complaint"),
}


def is_continuation_message(text: str) -> bool:
    t = (text or "").strip()
    if len(t) > 40:
        return False
    return bool(CONTINUATION_RE.match(t))


def infer_topic(text: str, extraction: dict[str, Any] | None = None) -> str | None:
    blob = (text or "").lower()
    if extraction:
        details = extraction.get("details") or {}
        if isinstance(details, dict):
            for v in details.values():
                if v:
                    blob += " " + str(v).lower()
        prof = extraction.get("profile") or {}
        if isinstance(prof, dict):
            for v in prof.values():
                if v:
                    blob += " " + str(v).lower()
    for topic, keys in TOPIC_KEYWORDS.items():
        if any(k in blob for k in keys):
            return topic
    return None


def merge_session_context(
    prev: dict[str, Any] | None,
    *,
    user_text: str,
    intent: str,
    topic: str | None,
) -> dict[str, Any]:
    ctx = dict(prev or {})
    ctx["last_user_text"] = user_text
    ctx["last_intent"] = intent
    if topic:
        ctx["last_topic"] = topic
    return ctx
