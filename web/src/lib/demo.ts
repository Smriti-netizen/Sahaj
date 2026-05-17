/** Minimal fallback only when Hugging Face fails. */
export function demoExtraction(message: string): Record<string, unknown> {
  const m = message.toLowerCase();
  if (m.includes("amazon") || m.includes("refund") || m.includes("landlord") || m.includes("salary") || m.includes("malik")) {
    return {
      intent: "legal_aid",
      category: m.includes("amazon") || m.includes("refund") ? "consumer" : m.includes("landlord") ? "property" : "labor",
      details: {
        issue: m.includes("amazon") ? "defective_product" : m.includes("landlord") ? "eviction_without_notice" : "unpaid_wages",
      },
    };
  }
  if (m.includes("kisan") || m.includes("farmer") || m.includes("kaam") || m.includes("scheme") || m.includes("startup")) {
    return {
      intent: "scheme_discovery",
      profile: {
        occupation: m.includes("farmer") || m.includes("kisan") ? "farmer" : "unemployed",
        looking_for: m.includes("startup") ? "startup" : "employment",
      },
    };
  }
  return {
    intent: "general_query",
    follow_up_hindi: "Scheme ya legal issue — thoda detail batayein.",
  };
}
