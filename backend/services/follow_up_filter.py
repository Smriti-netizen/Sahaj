"""Reject generic scheme-chatter the model often puts in follow_up_hindi."""
from typing import Any

from services.language_service import model_follow_up

GENERIC_SCHEME_CHATTER = (
    "sarkari yojana check",
    "yojanaen fit",
    "yojana check karta",
    "thodi der mein bataunga",
    "samajh aa gaya. main aapke liye",
    "kaun si yojanaen fit",
)

APPLICATION_TOPICS = frozenset({"passport", "pan", "driving_license", "rti", "fir"})


def is_generic_scheme_chatter(text: str) -> bool:
    t = (text or "").lower()
    return any(p in t for p in GENERIC_SCHEME_CHATTER)


def usable_model_follow_up(
    extraction: dict[str, Any],
    user_text: str,
    topic: str | None = None,
) -> str | None:
    fu = model_follow_up(extraction)
    if not fu:
        return None
    if is_generic_scheme_chatter(fu):
        return None
    if topic in APPLICATION_TOPICS:
        return None
    blob = (user_text or "").lower()
    if any(k in blob for k in ("passport", "visa", "pan card", "driving licence", "driving license")):
        if "yojana" in fu.lower() or "scheme" in fu.lower():
            return None
    return fu.strip()
