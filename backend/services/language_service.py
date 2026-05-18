"""Detect user language and pick replies in the same register."""
import re
from typing import Any

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
LATIN = re.compile(r"[A-Za-z]")
HINGLISH_MARKERS = (
    "hai",
    "hoon",
    "ho",
    "kya",
    "kaise",
    "btao",
    "batao",
    "madad",
    "chahiye",
    "yojana",
    "sarkari",
    "nahi",
    "main",
    "mera",
    "aap",
    "karo",
    "karna",
    "ke liye",
    "abhi",
    "thoda",
)


def detect_language(text: str) -> str:
    """Return 'hi' | 'en' | 'hinglish'."""
    t = (text or "").strip()
    if not t:
        return "hinglish"
    has_dev = bool(DEVANAGARI.search(t))
    has_lat = bool(LATIN.search(t))
    lower = t.lower()
    hinglish_hits = sum(1 for m in HINGLISH_MARKERS if m in lower)

    if has_dev and not has_lat:
        return "hi"
    if has_lat and not has_dev:
        if hinglish_hits >= 1:
            return "hinglish"
        return "en"
    if has_dev and has_lat:
        return "hinglish"
    if hinglish_hits >= 2:
        return "hinglish"
    return "en" if has_lat else "hi"


def locale_for_language(lang: str) -> str:
    """UI locale: English UI for English users; Hindi UI otherwise (incl. Hinglish)."""
    return "en" if lang == "en" else "hi"


def model_follow_up(extraction: dict[str, Any]) -> str | None:
    for key in ("follow_up_hindi", "follow_up", "follow_up_en", "profile_summary"):
        val = extraction.get(key)
        if val and str(val).strip():
            return str(val).strip()
    return None


def adapt_reply_to_language(text: str, lang: str) -> str:
    """Keep model text when language already matches; light touch only."""
    if not text:
        return text
    detected = detect_language(text)
    if lang == "en" and detected in ("hi", "hinglish"):
        return text
    if lang == "hi" and detected == "en":
        return text
    return text
