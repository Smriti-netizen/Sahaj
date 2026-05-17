/** Rule-based extraction when HF/Gemma is unavailable. Uses full conversation text. */
export function demoExtraction(fullText: string): Record<string, unknown> {
  const m = fullText.toLowerCase();

  const sexualAssault =
    /\b(rape|raped|balatkar|balatkari|molest|chhedchhad|sexual\s*assault|molestation)\b/.test(m) ||
    m.includes("mera rape") ||
    m.includes("rape hua");

  if (sexualAssault) {
    return {
      intent: "legal_aid",
      category: "women",
      details: { issue: "sexual_assault" },
      empathy_hindi:
        "Main samajh sakti hoon — yeh bahut bhari baat hai. Aap akeli nahi hain. Neeche turant madad aur kanuni kadam diye gaye hain. Agar abhi khatra ho to 112 par call karein.",
    };
  }

  if (
    m.includes("amazon") ||
    m.includes("refund") ||
    m.includes("landlord") ||
    m.includes("salary") ||
    m.includes("malik") ||
    m.includes("legal issue") ||
    m.includes("legal hai") ||
    m.includes("kanuni") ||
    m.includes("court") ||
    m.includes("police") ||
    m.includes("fir")
  ) {
    const clarifiedLegal =
      m.includes("legal issue") || m.includes("legal hai") || m.includes("kanuni");
    if (clarifiedLegal && !m.includes("amazon") && !m.includes("refund") && !m.includes("landlord")) {
      return {
        intent: "legal_aid",
        category: "general",
        details: { issue: "general_legal" },
        follow_up_hindi:
          "Theek hai — legal madad ke liye hoon. Thoda detail batayein: salary, rent, consumer, ya koi aur problem?",
      };
    }
    return {
      intent: "legal_aid",
      category: m.includes("amazon") || m.includes("refund") ? "consumer" : m.includes("landlord") ? "property" : "labor",
      details: {
        issue: m.includes("amazon")
          ? "defective_product"
          : m.includes("landlord")
            ? "eviction_without_notice"
            : "unpaid_wages",
      },
    };
  }

  if (
    m.includes("kisan") ||
    m.includes("farmer") ||
    m.includes("taxi") ||
    m.includes("loan") ||
    m.includes("kaam") ||
    m.includes("dilway") ||
    m.includes("job") ||
    m.includes("rozgar") ||
    m.includes("naukri") ||
    m.includes("scheme")
  ) {
    return {
      intent: "scheme_discovery",
      profile: {
        occupation:
          m.includes("taxi") ? "taxi_driver" : m.includes("kisan") || m.includes("farmer") ? "farmer" : "unemployed",
        state: m.includes("jaipur") || m.includes("rajasthan") ? "Rajasthan" : m.includes("up") ? "Uttar Pradesh" : undefined,
        looking_for: m.includes("loan") ? "business_loan" : "employment",
      },
    };
  }

  return {
    intent: "general_query",
    follow_up_hindi:
      "Namaste — main Sahaj hoon. Aapko sarkari scheme chahiye ya kisi legal problem mein madad? Hindi ya English mein apni situation likhiye.",
  };
}
