from typing import Any

from services.agent_replies import (
    build_farmer_agent_reply,
    build_scheme_found_reply,
)
from services.follow_up_filter import usable_model_follow_up
from services.gemma_service import extract_from_text
from services.language_service import detect_language, locale_for_language
from services.legal_service import analyze_legal_situation
from services.reply_builder import build_user_reply, is_vague_or_incomplete
from services.scheme_service import find_eligible_schemes, total_annual_benefit_inr
from services.session_context import (
    infer_topic,
    is_continuation_message,
    merge_session_context,
)
from services.topic_replies import (
    actions_for_schemes,
    actions_for_topic,
    farmer_actions,
    guidance_for_topic,
)

APPLICATION_TOPICS = frozenset({"passport", "pan", "driving_license"})


def _scheme_cards_payload(schemes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": s["id"],
            "name": s.get("name"),
            "name_hindi": s["name_hindi"],
            "description_hindi": s["description_hindi"],
            "benefit_amount": s.get("benefit_amount", 0),
            "benefit_note_hindi": s.get("benefit_note_hindi"),
            "portal_url": s.get("portal_url"),
            "steps_hindi": s.get("steps_hindi") or [],
            "required_documents": s.get("required_documents") or [],
        }
        for s in schemes
    ]


def _legal_actions_with_portal(legal: dict[str, Any], lang: str) -> list[dict[str, Any]]:
    actions = list(legal.get("actions") or [])
    portal = (legal.get("portal_url") or "").strip()
    if portal and not any(a.get("url") == portal for a in actions):
        label = {
            "en": "Open official portal",
            "hi": "आधिकारिक पोर्टल खोलें",
            "hinglish": "Official portal kholo",
        }.get(lang, "Official portal kholo")
        actions.insert(
            0,
            {
                "type": "legal_portal",
                "label_hi": label,
                "url": portal,
                "prompt": "Is portal par complaint/file kaise karein, step by step batao",
            },
        )
    for a in actions:
        if "prompt" not in a:
            a["prompt"] = f"{a['label_hi']} — mere case ke liye tayyar karo"
    return actions


PROFILE_KEYS = frozenset({
    "occupation", "state", "city", "age", "gender", "income_category",
    "category", "land_acres", "disability", "family", "education",
    "need", "purpose", "pregnant", "bpl",
})


def _extract_profile(extraction: dict[str, Any]) -> dict[str, Any]:
    """Pull profile fields regardless of whether model nests them under 'profile' or top-level."""
    prof = extraction.get("profile") or {}
    if isinstance(prof, dict):
        out = {k: v for k, v in prof.items() if v is not None and v != ""}
    else:
        out = {}
    for key in PROFILE_KEYS:
        val = extraction.get(key)
        if val is not None and val != "" and val != []:
            out.setdefault(key, val)
    details = extraction.get("profile_details") or extraction.get("details") or {}
    if isinstance(details, dict):
        for key in PROFILE_KEYS:
            val = details.get(key)
            if val is not None and val != "" and val != []:
                out.setdefault(key, val)
    return out


def _merge_profiles(session_profile: dict[str, Any] | None, extraction: dict[str, Any]) -> dict[str, Any]:
    merged = dict(session_profile or {})
    prof = _extract_profile(extraction)
    merged.update(prof)
    return merged


def _parse_error_reply(lang: str) -> str:
    messages = {
        "en": "Sorry — could you say that again in a line or two? I want to help.",
        "hi": "माफ़ कीजिए — एक दो पंक्तियों में फिर से लिखिए, मैं मदद करना चाहता हूँ।",
        "hinglish": "Maaf kijiye — do line mein phir se likhiye, main madad karna chahta hoon.",
    }
    return messages.get(lang) or messages["hinglish"]


def _application_response(
    topic: str,
    lang: str,
    text: str,
    profile: dict[str, Any],
    session_ctx: dict[str, Any],
    intent: str = "general_query",
    extraction: dict[str, Any] | None = None,
) -> dict[str, Any]:
    guidance = guidance_for_topic(topic, lang) or ""
    return {
        "intent": intent,
        "extraction": extraction or {"intent": intent, "topic": topic},
        "reply": guidance,
        "reply_hindi": guidance,
        "detected_language": lang,
        "ui_locale": locale_for_language(lang),
        "profile": profile,
        "session_context": session_ctx,
        "show_scheme_cards": False,
        "schemes": [],
        "actions": actions_for_topic(topic, lang),
    }


def _response_base(
    *,
    intent: str,
    extraction: dict[str, Any],
    reply: str,
    lang: str,
    profile: dict[str, Any],
    session_context: dict[str, Any],
    **extra: Any,
) -> dict[str, Any]:
    out = {
        "intent": intent,
        "extraction": extraction,
        "reply": reply,
        "reply_hindi": reply,
        "detected_language": lang,
        "ui_locale": locale_for_language(lang),
        "profile": profile,
        "session_context": session_context,
        "show_scheme_cards": False,
        "schemes": [],
        "actions": [],
    }
    out.update(extra)
    return out


def handle_chat(
    text: str,
    session_profile: dict[str, Any] | None = None,
    session_context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    lang = detect_language(text)
    ctx_in = dict(session_context or {})
    profile = dict(session_profile or {})

    topic = infer_topic(text, None) or ctx_in.get("last_topic")

    if topic in APPLICATION_TOPICS and not is_continuation_message(text):
        session_ctx = merge_session_context(
            ctx_in, user_text=text, intent="general_query", topic=topic
        )
        return _application_response(topic, lang, text, profile, session_ctx)

    if is_continuation_message(text) and topic in APPLICATION_TOPICS:
        session_ctx = merge_session_context(
            ctx_in, user_text=text, intent="general_query", topic=topic
        )
        return _application_response(topic, lang, text, profile, session_ctx)

    extraction = extract_from_text(text, session_context=ctx_in)
    if extraction.get("parse_error"):
        return _response_base(
            intent="general_query",
            extraction=extraction,
            reply=_parse_error_reply(lang),
            lang=lang,
            profile=profile,
            session_context=ctx_in,
        )

    intent = extraction.get("intent", "general_query")
    profile = _merge_profiles(session_profile, extraction)
    extraction["profile"] = profile
    topic = infer_topic(text, extraction) or topic
    vague = is_vague_or_incomplete(extraction, text, profile)

    session_ctx = merge_session_context(
        ctx_in, user_text=text, intent=intent, topic=topic
    )

    if topic in APPLICATION_TOPICS:
        return _application_response(
            topic, lang, text, profile, session_ctx, intent=intent, extraction=extraction
        )

    if intent == "legal_aid":
        legal = analyze_legal_situation(
            situation=text,
            category=extraction.get("category"),
            details=extraction.get("details"),
            extraction=extraction,
            lang=lang,
        )
        reply = usable_model_follow_up(extraction, text, topic) or legal["reply"]
        if vague and not usable_model_follow_up(extraction, text, topic):
            reply = build_user_reply(extraction, text, topic)
        return _response_base(
            intent=intent,
            extraction=extraction,
            reply=reply,
            lang=lang,
            profile=profile,
            session_context=session_ctx,
            legal=legal,
            actions=_legal_actions_with_portal(legal, lang),
            emergency=legal.get("emergency", False),
        )

    if intent == "scheme_discovery":
        schemes = find_eligible_schemes(profile) if not vague else []

        if vague:
            occ = str(profile.get("occupation", "")).lower()
            if occ == "farmer" or "kisan" in text.lower():
                preview = schemes or find_eligible_schemes(profile)
                reply = build_farmer_agent_reply(profile, preview, lang)
                extra: dict[str, Any] = {"actions": farmer_actions(lang)}
                if preview:
                    extra["show_scheme_cards"] = True
                    extra["schemes"] = _scheme_cards_payload(preview)
                    extra["total_benefit_inr"] = total_annual_benefit_inr(preview)
                    extra["actions"] = actions_for_schemes(preview, lang)
                return _response_base(
                    intent=intent,
                    extraction=extraction,
                    reply=reply,
                    lang=lang,
                    profile=profile,
                    session_context=session_ctx,
                    **extra,
                )
            reply = build_user_reply(extraction, text, topic)
            return _response_base(
                intent=intent,
                extraction=extraction,
                reply=reply,
                lang=lang,
                profile=profile,
                session_context=session_ctx,
            )

        if schemes:
            total = total_annual_benefit_inr(schemes)
            reply = build_scheme_found_reply(profile, schemes, total, lang)
            model_line = usable_model_follow_up(extraction, text, topic)
            if model_line:
                reply = f"{model_line}\n\n{reply}"
            return _response_base(
                intent=intent,
                extraction=extraction,
                reply=reply,
                lang=lang,
                profile=profile,
                session_context=session_ctx,
                show_scheme_cards=True,
                schemes=_scheme_cards_payload(schemes),
                total_benefit_inr=total,
                actions=actions_for_schemes(schemes, lang),
            )

        reply = build_user_reply(extraction, text, topic)
        return _response_base(
            intent=intent,
            extraction=extraction,
            reply=reply,
            lang=lang,
            profile=profile,
            session_context=session_ctx,
        )

    if intent == "document_scan":
        if vague or not profile:
            reply = build_user_reply(extraction, text, topic)
            return _response_base(
                intent=intent,
                extraction=extraction,
                reply=reply,
                lang=lang,
                profile=profile,
                session_context=session_ctx,
            )
        schemes = find_eligible_schemes(profile)
        if schemes:
            total = total_annual_benefit_inr(schemes)
            reply = build_scheme_found_reply(profile, schemes, total, lang)
            return _response_base(
                intent=intent,
                extraction=extraction,
                reply=reply,
                lang=lang,
                profile=profile,
                session_context=session_ctx,
                show_scheme_cards=True,
                schemes=_scheme_cards_payload(schemes),
                total_benefit_inr=total,
                actions=actions_for_schemes(schemes, lang),
            )
        reply = build_user_reply(extraction, text, topic)
        return _response_base(
            intent=intent,
            extraction=extraction,
            reply=reply,
            lang=lang,
            profile=profile,
            session_context=session_ctx,
        )

    reply = build_user_reply(extraction, text, topic)
    return _response_base(
        intent=intent,
        extraction=extraction,
        reply=reply,
        lang=lang,
        profile=profile,
        session_context=session_ctx,
    )
