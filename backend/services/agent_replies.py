"""Rich, agent-style replies composed from JSON facts (not generic model chatter)."""
from typing import Any


def _profile_summary(profile: dict[str, Any], lang: str) -> str:
    bits: list[str] = []
    if profile.get("state"):
        bits.append(str(profile["state"]))
    if profile.get("land_acres"):
        bits.append(f"{profile['land_acres']} acre zameen" if lang != "en" else f"{profile['land_acres']} acres")
    if profile.get("occupation"):
        bits.append(str(profile["occupation"]))
    if profile.get("age"):
        bits.append(f"umr {profile['age']}" if lang != "hi" else f"उम्र {profile['age']}")
    return ", ".join(bits) if bits else ""


def build_farmer_agent_reply(
    profile: dict[str, Any],
    schemes: list[dict[str, Any]],
    lang: str,
) -> str:
    summary = _profile_summary(profile, lang)
    names = [s.get("name_hindi") or s.get("name", "") for s in schemes[:4]]
    scheme_hint = ", ".join(names) if names else "PM Kisan, PMFBY, KCC"

    if lang == "en":
        intro = (
            f"I noted your details ({summary}). Here's what I can help with next."
            if summary
            else "Tell me a bit about your farm — I can match schemes and next steps."
        )
        return (
            f"{intro}\n\n"
            "You might want:\n"
            f"• Government schemes you may qualify for (e.g. {scheme_hint})\n"
            "• Crop or season advice for your land\n"
            "• Land records / Khasra / ownership paperwork\n"
            "• Selling produce or mandi links\n"
            "• Legal help (tenant, wages, property)\n\n"
            "Reply with your full question — or tap a button below."
        )

    if lang == "hi":
        intro = (
            f"आपने बताया ({summary}) — अब मैं सही मदद बता सकता हूँ।"
            if summary
            else "अपनी खेती थोड़ी बताइए — योजना और अगला कदम ढूँढूँगा।"
        )
        return (
            f"{intro}\n\n"
            "आप ये पूछ सकते हैं:\n"
            f"• सरकारी योजनाएँ (जैसे {scheme_hint})\n"
            "• फसल / मौसम की सलाह\n"
            "• खसरा / ज़मीन के कागज़\n"
            "• फसल बेचने / मंडी की जानकारी\n"
            "• कानूनी मदद (ज़मीन, मजदूरी, किराया)\n\n"
            "पूरा सवाल लिखिए या नीचे बटन दबाइए।"
        )

    intro = (
        f"Aapne apni pehchaan batai hai ({summary}), ab main samajh sakta hoon ki aapko kya jaankari chahiye."
        if summary
        else "Apni kheti thodi batayiye — main yojana aur agla kadam dhundhunga."
    )
    return (
        f"{intro}\n\n"
        "**Aap mujhe bataiye, aapko kis cheez mein madad chahiye?**\n\n"
        "Kya aap jaanna chahte hain:\n\n"
        f"1. **Kisan se judi koi Yojana?** (Jaise {scheme_hint})\n"
        "2. **Khet / fasal se related jaankari?**\n"
        "3. **Zameen / khasra / record ka kaam?**\n"
        "4. **Mandi ya bechne ki jaankari?**\n"
        "5. **Legal ya kanooni madad?**\n\n"
        "**Apna sawaal poora likhiye, ya neeche button dabaiye — main jawab dunga.**"
    )


def build_scheme_found_reply(
    profile: dict[str, Any],
    schemes: list[dict[str, Any]],
    total_inr: int,
    lang: str,
) -> str:
    names = [s.get("name_hindi") or s.get("name") for s in schemes[:5]]
    joined = ", ".join(names)

    if lang == "en":
        benefit = f" Rough total benefit about ₹{total_inr:,}/year." if total_inr else ""
        return (
            f"Based on your profile, these schemes may fit: {joined}.{benefit} "
            "Tap a scheme card below or ask me to explain steps for any one."
        )
    if lang == "hi":
        benefit = f" लगभग कुल लाभ ₹{total_inr:,}/वर्ष हो सकता है।" if total_inr else ""
        return (
            f"आपकी जानकारी पर ये योजनाएँ दिखती हैं: {joined}.{benefit} "
            "नीचे कार्ड देखें या किसी एक की पूरी प्रक्रिया पूछें।"
        )
    benefit = f" Lagbhag kul labh ₹{total_inr:,}/saal ho sakta hai." if total_inr else ""
    return (
        f"Aapki profile par yeh yojanaen fit lagti hain: {joined}.{benefit} "
        "Neeche cards dekhein — kisi ek ke steps chahiye hon to naam likh kar poochiye."
    )
