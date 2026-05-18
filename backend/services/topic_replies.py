"""Application topics (passport, etc.) — not government schemes."""
from typing import Any

GUIDANCE: dict[str, dict[str, str]] = {
    "passport": {
        "en": (
            "Got it — you want a **passport**, not a subsidy scheme.\n\n"
            "Apply on the official site **passportindia.gov.in**: register → fill Form → "
            "upload Aadhaar, address proof, photo → pay fee → book PSK appointment. "
            "Tatkal/normal both are on the portal.\n\n"
            "I can walk you through documents or each click — use the buttons below."
        ),
        "hi": (
            "समझ गया — आपको **पासपोर्ट** चाहिए, कोई योजना नहीं।\n\n"
            "आधिकारिक साइट **passportindia.gov.in** पर: रजिस्टर → फॉर्म → "
            "आधार, पता प्रमाण, फोटो अपलोड → शुल्क → PSK अपॉइंटमेंट।\n\n"
            "दस्तावेज़ या हर स्टेप बता सकता हूँ — नीचे बटन दबाइए।"
        ),
        "hinglish": (
            "Samajh gaya — aapko **passport** chahiye, koi sarkari yojana nahi.\n\n"
            "Official site **passportindia.gov.in** par: register → form bharo → "
            "Aadhaar, address proof, photo upload → fee → PSK appointment book karo. "
            "Normal aur tatkal dono yahi se hote hain.\n\n"
            "Documents ya har step bata sakta hoon — neeche button dabaiye."
        ),
    },
}

TOPIC_ACTIONS: dict[str, list[dict[str, str]]] = {
    "passport": [
        {
            "type": "passport_docs",
            "label_hi": "Passport documents list",
            "prompt": "Passport ke liye kaun kaun se documents chahiye, step by step batao",
        },
        {
            "type": "passport_steps",
            "label_hi": "Online apply steps",
            "prompt": "passportindia.gov.in par online apply kaise karein, har step samjhao",
        },
        {
            "type": "passport_tatkal",
            "label_hi": "Tatkal vs normal",
            "prompt": "Passport tatkal aur normal mein kya farak hai, fees aur time batao",
        },
    ],
}

FARMER_ACTIONS: list[dict[str, str]] = [
    {
        "type": "list_schemes",
        "label_hi": "Meri yojanaen dikhao",
        "prompt": "Meri profile ke hisaab se kaun si sarkari yojanaen fit hain, detail mein batao",
    },
    {
        "type": "pm_kisan_steps",
        "label_hi": "PM Kisan steps",
        "prompt": "PM Kisan mein apply kaise karein, step by step batao",
    },
    {
        "type": "legal_help",
        "label_hi": "Kanooni madad",
        "prompt": "Mujhe kanooni madad chahiye, kya options hain",
    },
]


def guidance_for_topic(topic: str, lang: str) -> str | None:
    block = GUIDANCE.get(topic)
    if not block:
        return None
    return block.get(lang) or block.get("hinglish") or block.get("en")


def actions_for_topic(topic: str, lang: str) -> list[dict[str, Any]]:
    raw = TOPIC_ACTIONS.get(topic, [])
    out: list[dict[str, Any]] = []
    for a in raw:
        label = a["label_hi"]
        if lang == "hi" and topic == "passport":
            label = label.replace("Passport", "पासपोर्ट").replace("documents", "दस्तावेज़")
        out.append({**a, "label_hi": label, "prompt": a["prompt"]})
    return out


def _scheme_label(scheme: dict[str, Any], lang: str) -> str:
    name = scheme.get("name_hindi") or scheme.get("name", "Portal")
    if lang == "en":
        return f"Apply — {scheme.get('name', name)}"
    if lang == "hi":
        return f"आवेदन — {name}"
    return f"Apply — {name}"


def scheme_portal_actions(schemes: list[dict[str, Any]], lang: str) -> list[dict[str, Any]]:
    """Open official portals for matched schemes (plan: ACT / open_portal)."""
    actions: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for scheme in schemes[:4]:
        url = (scheme.get("portal_url") or "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        sid = scheme.get("id", "scheme")
        actions.append(
            {
                "type": f"portal_{sid}",
                "label_hi": _scheme_label(scheme, lang),
                "url": url,
                "prompt": (
                    f"{scheme.get('name_hindi', scheme.get('name', sid))} ke liye apply karne ke "
                    "steps detail mein batao"
                ),
            }
        )
    return actions


def farmer_actions(lang: str) -> list[dict[str, Any]]:
    labels_hi = {
        "list_schemes": "मेरी योजनाएँ दिखाएँ",
        "pm_kisan_steps": "पीएम किसान — आवेदन स्टेप",
        "legal_help": "कानूनी मदद",
    }
    labels_en = {
        "list_schemes": "Show my schemes",
        "pm_kisan_steps": "PM Kisan — how to apply",
        "legal_help": "Legal help",
    }
    pick = labels_en if lang == "en" else labels_hi if lang == "hi" else None
    out = []
    for a in FARMER_ACTIONS:
        label = (pick or {}).get(a["type"], a["label_hi"])
        out.append({**a, "label_hi": label})
    return out


def actions_for_schemes(schemes: list[dict[str, Any]], lang: str) -> list[dict[str, Any]]:
    """Portal links first, then farmer follow-up prompts."""
    portal = scheme_portal_actions(schemes, lang)
    prompts = farmer_actions(lang)
    seen_types = {a["type"] for a in portal}
    for p in prompts:
        if p["type"] not in seen_types:
            portal.append(p)
    return portal
