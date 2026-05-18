import json
from functools import lru_cache
from typing import Any

from config import SCHEMES_PATH


@lru_cache(maxsize=1)
def load_schemes() -> list[dict[str, Any]]:
    with open(SCHEMES_PATH, encoding="utf-8") as f:
        return json.load(f)


def _norm(s: str | None) -> str:
    return (s or "").strip().lower().replace(" ", "_")


def _state_match(profile_state: str | None, rule_states: list[str] | None) -> bool:
    if not rule_states:
        return True
    if not profile_state:
        return False
    ps = _norm(profile_state)
    for st in rule_states:
        if _norm(st) in ps or ps in _norm(st):
            return True
    # UP / Uttar Pradesh style
    aliases = {
        "uttar_pradesh": ["up", "uttar pradesh"],
        "madhya_pradesh": ["mp", "madhya pradesh"],
    }
    for canonical, keys in aliases.items():
        if any(k.replace(" ", "_") in ps for k in keys):
            if canonical in [_norm(x) for x in rule_states]:
                return True
    return _norm(profile_state) in [_norm(x) for x in rule_states]


def _has_minor_daughter(profile: dict[str, Any], max_age: int = 10) -> bool:
    family = profile.get("family") or []
    if profile.get("children"):
        return True
    for member in family:
        if not isinstance(member, dict):
            continue
        rel = _norm(str(member.get("relation", "")))
        if "daughter" in rel or "beti" in rel:
            age = member.get("age")
            if age is None or (isinstance(age, (int, float)) and age <= max_age):
                return True
    return False


def _matches(profile: dict[str, Any], scheme: dict[str, Any]) -> bool:
    rules = scheme.get("eligibility") or {}
    occ = _norm(profile.get("occupation"))
    rule_occs = [_norm(o) for o in rules.get("occupations", [])]
    if rule_occs and occ and occ not in rule_occs:
        # partial: farmer matches if occupation contains farmer
        if not any(ro in occ or occ in ro for ro in rule_occs):
            return False
    if rule_occs and not occ:
        return False

    land = profile.get("land_acres")
    if land is not None:
        try:
            acres = float(land)
            if rules.get("max_land_acres") is not None and acres > float(rules["max_land_acres"]):
                return False
            if rules.get("min_land_acres") is not None and acres < float(rules["min_land_acres"]):
                return False
        except (TypeError, ValueError):
            pass

    inc = _norm(profile.get("income_category"))
    rule_incs = [_norm(i) for i in rules.get("income_categories", [])]
    if rule_incs and inc and inc not in rule_incs:
        return False
    if rule_incs and not inc:
        return False

    cat = _norm(profile.get("category"))
    rule_cats = [_norm(c) for c in rules.get("categories", [])]
    if rule_cats and cat and cat not in rule_cats:
        return False

    gender = _norm(profile.get("gender"))
    rule_genders = [_norm(g) for g in rules.get("gender", [])]
    if rule_genders and gender and gender not in rule_genders:
        return False

    age = profile.get("age")
    if age is not None:
        try:
            a = int(age)
            if rules.get("min_age") is not None and a < int(rules["min_age"]):
                return False
            if rules.get("max_age") is not None and a > int(rules["max_age"]):
                return False
        except (TypeError, ValueError):
            pass

    if rules.get("requires_minor_daughter") and not _has_minor_daughter(
        profile, int(rules.get("max_daughter_age", 10))
    ):
        return False

    if rules.get("has_bank_account") is False and profile.get("has_bank_account") is True:
        return False

    looking = _norm(profile.get("looking_for"))
    rule_look = [_norm(x) for x in rules.get("looking_for", [])]
    if rule_look and looking and looking not in rule_look:
        return False

    area = _norm(profile.get("area"))
    rule_areas = [_norm(a) for a in rules.get("area", [])]
    if rule_areas and area and area not in rule_areas:
        return False

    return True


def find_eligible_schemes(profile: dict[str, Any]) -> list[dict[str, Any]]:
    eligible = []
    for scheme in load_schemes():
        if _matches(profile, scheme):
            eligible.append(scheme)
    return eligible


def total_annual_benefit_inr(schemes: list[dict[str, Any]]) -> int:
    total = 0
    for s in schemes:
        if s.get("benefit_period") == "year" and s.get("benefit_amount"):
            total += int(s["benefit_amount"])
    return total


def build_scheme_reply(
    profile: dict[str, Any],
    schemes: list[dict[str, Any]],
    lang: str = "hinglish",
) -> str:
    if not schemes:
        empty = {
            "en": (
                "I checked your details against our scheme list — no direct match yet. "
                "Share occupation, state, and age and I'll check again."
            ),
            "hi": (
                "मैंने आपकी जानकारी देखी — अभी सूची में सीधा मेल नहीं मिला। "
                "काम, राज्य और उम्र बताइए, फिर दोबारा देखता हूँ।"
            ),
            "hinglish": (
                "Maine aapki jaankari dekhi — abhi list mein seedha match nahi mila. "
                "Kaam, rajya, umr bataiye, phir dubara check karta hoon."
            ),
        }
        return empty.get(lang) or empty["hinglish"]

    names = [s["name_hindi"] for s in schemes[:5]]
    if len(names) == 1:
        list_hi = names[0]
    elif len(names) == 2:
        list_hi = f"{names[0]} aur {names[1]}" if lang != "en" else f"{names[0]} and {names[1]}"
    else:
        sep = ", "
        joiner = " aur " if lang != "en" else " and "
        list_hi = sep.join(names[:-1]) + joiner + names[-1]

    total = total_annual_benefit_inr(schemes)
    benefit_line = ""
    if total > 0:
        if lang == "en":
            benefit_line = f" Combined benefits could be around ₹{total:,}/year."
        elif lang == "hi":
            benefit_line = f" मिलने वाली मदद लगभग ₹{total:,}/वर्ष हो सकती है।"
        else:
            benefit_line = f" In par milne wali madad lagbhag ₹{total:,}/saal ho sakti hai."

    bodies = {
        "en": (
            f"Based on what you shared, you may look at: {list_hi}.{benefit_line} "
            "Ask if you want steps for any one scheme."
        ),
        "hi": (
            f"आपकी जानकारी के हिसाब से ये योजनाएँ देख सकते हैं: {list_hi}.{benefit_line} "
            "किसी एक की पूरी प्रक्रिया चाहिए हो तो पूछिए।"
        ),
        "hinglish": (
            f"Aapki haalat ke hisaab se yeh yojanaen dekh sakte hain: {list_hi}.{benefit_line} "
            "Kisi ek ki detail chahiye ho to pooch lijiye."
        ),
    }
    return bodies.get(lang) or bodies["hinglish"]


def build_scheme_reply_hindi(profile: dict[str, Any], schemes: list[dict[str, Any]]) -> str:
    return build_scheme_reply(profile, schemes, "hinglish")
