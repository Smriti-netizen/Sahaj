export function demoExtraction(message: string): Record<string, unknown> {
  const m = message.toLowerCase();
  if (
    m.includes("amazon") ||
    m.includes("refund") ||
    m.includes("landlord") ||
    m.includes("salary") ||
    m.includes("malik")
  ) {
    return {
      intent: "legal_aid",
      category: m.includes("amazon") || m.includes("refund") ? "consumer" : m.includes("landlord") ? "property" : "labor",
      details: {
        issue: m.includes("amazon") ? "defective_product" : m.includes("landlord") ? "eviction_without_notice" : "unpaid_wages",
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
    m.includes("naukri")
  ) {
    return {
      intent: "scheme_discovery",
      profile: {
        occupation: m.includes("taxi") ? "taxi_driver" : m.includes("kisan") || m.includes("farmer") ? "farmer" : "unemployed",
        state: m.includes("jaipur") || m.includes("rajasthan") ? "Rajasthan" : m.includes("up") ? "Uttar Pradesh" : undefined,
        looking_for: m.includes("loan") ? "business_loan" : "employment",
      },
    };
  }
  return {
    intent: "general_query",
    missing_info: ["what_problem", "category"],
    follow_up_hindi: "Kya problem hai? Sarkari scheme dhundh rahe ho ya koi legal issue? Thoda detail batayein.",
  };
}
