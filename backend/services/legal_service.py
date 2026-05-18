import json
from functools import lru_cache
from typing import Any

from config import LEGAL_PATH

# Map model extraction fields → legal_rights.json category id
ISSUE_TO_CATEGORY: dict[str, str] = {
    "unpaid_wages": "labor",
    "unpaid_salary": "labor",
    "wage_theft": "labor",
    "wrongful_termination": "labor",
    "workplace_harassment": "labor",
    "domestic_violence": "women",
    "dowry": "women",
    "harassment": "women",
    "encroachment": "property",
    "tenant_dispute": "property",
    "landlord": "property",
    "eviction": "property",
    "rti": "rti",
    "fir": "police",
    "theft": "police",
    "death_threat": "police",
    "pension": "pension",
    "life_certificate": "pension",
    "scholarship": "education",
    "rte": "education",
    "medical_negligence": "health",
    "insurance_denial": "health",
    "online_fraud": "cyber",
    "upi_scam": "cyber",
    "identity_theft": "cyber",
    "defective_product": "consumer",
    "refund": "consumer",
}

CATEGORY_ALIASES: dict[str, str] = {
    "labour": "labor",
    "labor_rights": "labor",
    "consumer_rights": "consumer",
    "women": "women",
    "property": "property",
    "land": "property",
    "police": "police",
    "cyber_crime": "cyber",
    "cyber": "cyber",
    "health": "health",
    "education": "education",
    "pension": "pension",
    "rti": "rti",
}


@lru_cache(maxsize=1)
def load_legal_db() -> list[dict[str, Any]]:
    with open(LEGAL_PATH, encoding="utf-8") as f:
        return json.load(f)


def _by_id(category_id: str) -> dict[str, Any] | None:
    for row in load_legal_db():
        if row["id"] == category_id:
            return row
    return None


def resolve_category(
    category: str | None = None,
    details: dict[str, Any] | None = None,
    situation_text: str | None = None,
) -> str:
    if category:
        normalized = CATEGORY_ALIASES.get(category.strip().lower(), category.strip().lower())
        if _by_id(normalized):
            return normalized

    details = details or {}
    for key in ("issue_type", "issue", "category", "type"):
        raw = details.get(key)
        if not raw:
            continue
        raw_s = str(raw).lower().replace(" ", "_")
        if raw_s in ISSUE_TO_CATEGORY:
            return ISSUE_TO_CATEGORY[raw_s]
        if _by_id(raw_s):
            return raw_s

    text = (situation_text or "").lower()
    for entry in load_legal_db():
        for kw in entry.get("keywords", []):
            if kw.lower() in text:
                return entry["id"]

    return "labor"


def _join_natural(parts: list[str]) -> str:
    parts = [p.strip() for p in parts if p and p.strip()]
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    return " ".join(parts[:-1]) + " " + parts[-1]


def build_reply(
    entry: dict[str, Any],
    details: dict[str, Any] | None,
    missing_follow_up: str | None = None,
    lang: str = "hinglish",
) -> str:
    """Rights from JSON; phrasing matches user language."""
    laws = entry.get("relevant_laws") or []
    law_phrase = laws[0]["explanation_hindi"] if laws else ""
    rights = entry.get("your_rights_hindi", "")
    steps = entry.get("steps_to_take_hindi") or []
    step_hint = steps[0] if steps else ""
    helplines = entry.get("helpline_numbers") or []
    cat = entry.get("category_hindi", "")

    if lang == "en":
        opening = f"This looks like a {cat} issue."
        body = _join_natural([rights, f"First step: {step_hint}" if step_hint else ""])
        actions = (
            "I can help draft a complaint, legal notice, or RTI from your details — say the word."
        )
        helpline_phrase = f" Helpline: {helplines[0]}." if helplines else ""
    elif lang == "hi":
        opening = f"यह {cat} से जुड़ा मामला लगता है।"
        if law_phrase:
            opening = _join_natural([opening, law_phrase])
        body = _join_natural([rights, f"पहला कदम: {step_hint}" if step_hint else ""])
        actions = "चाहें तो शिकायत पत्र, नोटिस या RTI बनाने में मदद कर सकता हूँ।"
        helpline_phrase = f" ज़रूरत हो तो {helplines[0]} पर संपर्क करें।" if helplines else ""
    else:
        opening = f"Yeh {cat} se juda masla lagta hai."
        if law_phrase:
            opening = _join_natural([opening, law_phrase])
        body = _join_natural([rights, f"Sabse pehle: {step_hint}" if step_hint else ""])
        actions = (
            "Chahein to shikayat patra, legal notice ya RTI bana sakta hoon — detail bata dena."
        )
        helpline_phrase = f" Zarurat ho to {helplines[0]} par sampark kar sakte hain." if helplines else ""

    reply = _join_natural([opening, body, actions, helpline_phrase.strip()])
    if missing_follow_up:
        reply = _join_natural([reply, missing_follow_up])
    return reply.strip()


def build_reply_hindi(
    entry: dict[str, Any],
    details: dict[str, Any] | None,
    missing_follow_up: str | None = None,
) -> str:
    return build_reply(entry, details, missing_follow_up, "hinglish")


def analyze_legal_situation(
    *,
    situation: str | None = None,
    category: str | None = None,
    details: dict[str, Any] | None = None,
    extraction: dict[str, Any] | None = None,
    lang: str = "hinglish",
) -> dict[str, Any]:
    """
    Map situation → legal_rights row. Content always from JSON, never invented laws.
    """
    extraction = extraction or {}
    if extraction.get("intent") == "legal_aid":
        category = category or extraction.get("category")
        details = {**(details or {}), **(extraction.get("details") or {})}

    category_id = resolve_category(
        category=category,
        details=details,
        situation_text=situation,
    )
    entry = _by_id(category_id)
    if not entry:
        category_id = "labor"
        entry = _by_id("labor") or {}

    from services.language_service import model_follow_up

    follow_up = model_follow_up(extraction) if extraction else None
    missing = extraction.get("missing_info") if extraction else None
    if missing and not follow_up:
        prompts = {
            "en": "When did this start, and which city or state is it in?",
            "hi": "यह समस्या कब से है और किस शहर/राज्य में है?",
            "hinglish": "Kab se yeh problem hai aur kahan ka mamla hai?",
        }
        follow_up = prompts.get(lang) or prompts["hinglish"]

    emergency = bool(extraction.get("emergency")) if extraction else False
    body = build_reply(entry, details, follow_up if missing else None, lang)
    from services.follow_up_filter import usable_model_follow_up

    model_fu = usable_model_follow_up(extraction, situation or "", None) if extraction else None
    if model_fu and not missing:
        body = model_fu
    elif follow_up and not missing:
        body = follow_up

    return {
        "category": entry.get("category"),
        "category_hindi": entry.get("category_hindi"),
        "category_id": entry.get("id"),
        "relevant_laws": entry.get("relevant_laws"),
        "your_rights_hindi": entry.get("your_rights_hindi"),
        "steps_to_take_hindi": entry.get("steps_to_take_hindi"),
        "document_templates": entry.get("document_templates"),
        "portal_url": entry.get("portal_url"),
        "helpline_numbers": entry.get("helpline_numbers"),
        "common_scenarios": entry.get("common_scenarios"),
        "details_used": details or {},
        "emergency": emergency,
        "reply": body,
        "reply_hindi": body,
        "actions": _build_actions(entry.get("document_templates") or [], lang),
    }


def _action_label(template: str, lang: str = "hinglish") -> str:
    labels = {
        "labor_complaint": {
            "en": "Draft labour complaint",
            "hi": "श्रम शिकायत पत्र बनाएँ",
            "hinglish": "Shram shikayat patra banao",
        },
        "legal_notice": {
            "en": "Draft legal notice",
            "hi": "कानूनी नोटिस बनाएँ",
            "hinglish": "Legal notice banao",
        },
        "consumer_complaint": {
            "en": "Draft consumer complaint",
            "hi": "उपभोक्ता शिकायत बनाएँ",
            "hinglish": "Consumer shikayat banao",
        },
        "fir_draft": {
            "en": "Draft FIR",
            "hi": "FIR ड्राफ्ट बनाएँ",
            "hinglish": "FIR draft banao",
        },
        "rti_application": {
            "en": "Draft RTI application",
            "hi": "RTI आवेदन बनाएँ",
            "hinglish": "RTI aavedan banao",
        },
        "cyber_complaint": {
            "en": "Draft cyber complaint",
            "hi": "साइबर शिकायत बनाएँ",
            "hinglish": "Cyber shikayat banao",
        },
        "grievance_application": {
            "en": "Draft grievance letter",
            "hi": "शिकायत पत्र बनाएँ",
            "hinglish": "Shikayat patra banao",
        },
        "police_complaint": {
            "en": "Draft police complaint",
            "hi": "पुलिस शिकायत पत्र बनाएँ",
            "hinglish": "Police complaint patra banao",
        },
        "protection_order": {
            "en": "Draft protection order request",
            "hi": "सुरक्षा आदेश आवेदन",
            "hinglish": "Suraksha aadesh ke liye draft",
        },
    }
    block = labels.get(template, {})
    return block.get(lang) or block.get("hinglish") or template.replace("_", " ").title()


def _action_prompt(template: str, lang: str) -> str:
    prompts = {
        "legal_notice": "Mere case ke liye legal notice ka draft banao, detail ke saath",
        "police_complaint": "Mere case ke liye police complaint patra ka draft banao",
        "labor_complaint": "Mere liye shram vibhag ki shikayat patra ka draft banao",
        "fir_draft": "Mere case ke liye FIR draft likho",
        "rti_application": "Mere liye RTI aavedan ka draft banao",
        "consumer_complaint": "Consumer forum ki shikayat patra banao",
        "cyber_complaint": "Cybercrime portal ke liye shikayat draft banao",
        "grievance_application": "PG portal ke liye shikayat patra banao",
    }
    if lang == "en":
        en_map = {
            "legal_notice": "Draft a legal notice for my case with placeholders I can fill",
            "police_complaint": "Draft a police complaint letter for my case",
        }
        return en_map.get(template, prompts.get(template, f"Prepare {template} for my case"))
    return prompts.get(template, f"Mere liye {template.replace('_', ' ')} tayyar karo")


def _build_actions(templates: list[str], lang: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    actions: list[dict[str, Any]] = []
    for tpl in templates:
        if tpl in seen:
            continue
        seen.add(tpl)
        label = _action_label(tpl, lang)
        actions.append(
            {
                "type": tpl,
                "label_hi": label,
                "prompt": _action_prompt(tpl, lang),
            }
        )
    return actions
