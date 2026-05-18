"""User-facing replies — prefer fine-tuned model follow_up; minimal fallbacks only."""
from typing import Any

from services.follow_up_filter import usable_model_follow_up
from services.language_service import detect_language


def _profile_richness(profile: dict[str, Any]) -> int:
    return sum(
        1
        for v in profile.values()
        if v is not None and v != "" and v != [] and v != {}
    )


def is_vague_or_incomplete(extraction: dict[str, Any], user_text: str = "", profile: dict[str, Any] | None = None) -> bool:
    """Block scheme cards only when we truly lack enough profile — not when model lists optional missing_info."""
    prof = profile or extraction.get("profile") or {}
    richness = _profile_richness(prof)
    intent = extraction.get("intent", "") or "general_query"

    if intent in ("general_query", "unknown"):
        return True

    topic = (user_text or "").lower()
    if any(k in topic for k in ("passport", "visa", "pan card", "driving licence", "driving license")):
        return True

    if richness < 1:
        return True

    occ = str(prof.get("occupation", "")).lower()
    if intent == "scheme_discovery":
        if richness >= 2:
            return False
        if ("farmer" in occ or "kisan" in occ) and prof.get("state"):
            return False
        if ("farmer" in occ or "kisan" in occ) and prof.get("land_acres") is not None:
            return False

    if intent == "legal_aid":
        if extraction.get("category") and extraction.get("category") not in ("unknown", ""):
            return False
        details = extraction.get("details") or {}
        if isinstance(details, dict) and any(details.values()):
            return richness < 1
        if richness >= 1 and any(k in topic for k in ("salary", "vetan", "maalik", "wage", "fir", "rti", "police")):
            return False

    missing = extraction.get("missing_info") or []
    if missing and richness < 2:
        return True
    return richness < 2


def reply_from_model(
    extraction: dict[str, Any],
    user_text: str,
    topic: str | None = None,
) -> str | None:
    return usable_model_follow_up(extraction, user_text, topic)


def minimal_fallback(extraction: dict[str, Any], user_text: str) -> str:
    lang = detect_language(user_text)
    missing = extraction.get("missing_info") or []

    if lang == "en":
        if missing:
            return (
                "I understood — to point you to the right scheme or legal help, "
                f"could you share a bit more about: {', '.join(missing[:3])}?"
            )
        return (
            "I'm listening. Tell me a little more — are you looking for a government scheme, "
            "legal help, or help with a document or application?"
        )
    if lang == "hi":
        if missing:
            return (
                "समझ गया — सही योजना या कानूनी मदद के लिए थोड़ी और जानकारी चाहिए: "
                f"{', '.join(missing[:3])}?"
            )
        return (
            "मैं सुन रहा हूँ। थोड़ा और बताइए — सरकारी योजना, कानूनी मदद, "
            "या किसी दस्तावेज़/आवेदन में मदद चाहिए?"
        )
    if missing:
        return (
            "Samajh gaya — sahi yojana ya legal madad ke liye thodi aur detail chahiye: "
            f"{', '.join(missing[:3])}?"
        )
    return (
        "Main sun raha hoon. Thoda aur bataiye — sarkari yojana, kanooni madad, "
        "ya kisi document/application mein help chahiye?"
    )


def build_user_reply(
    extraction: dict[str, Any],
    user_text: str,
    topic: str | None = None,
) -> str:
    from_model = reply_from_model(extraction, user_text, topic)
    if from_model:
        return from_model
    return minimal_fallback(extraction, user_text)
