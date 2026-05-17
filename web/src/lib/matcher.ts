import schemes from "../data/schemes.json";
import legalRights from "../data/legal_rights.json";
import type { LegalRight, MatchResult, Scheme } from "../types";

function norm(s: unknown): string {
  if (s == null) return "";
  return String(s).toLowerCase().replace(/\s+/g, "_");
}

function matchList(profileVal: unknown, allowed?: string[]): boolean {
  if (!allowed?.length) return true;
  const v = norm(profileVal);
  if (!v) return false;
  return allowed.some((a) => v.includes(norm(a)) || norm(a).includes(v));
}

function matchSchemes(profile: Record<string, unknown>): Scheme[] {
  const hits: Scheme[] = [];
  for (const scheme of schemes as Scheme[]) {
    const e = scheme.eligibility;
    let ok = true;
    if (e.occupation) ok = ok && matchList(profile.occupation, e.occupation as string[]);
    if (e.income_category) ok = ok && matchList(profile.income_category, e.income_category as string[]);
    if (e.looking_for)
      ok = ok && matchList(profile.looking_for ?? profile.need ?? profile.aspiration, e.looking_for as string[]);
    if (e.area) ok = ok && matchList(profile.area, e.area as string[]);
    if (typeof e.max_land_acres === "number" && typeof profile.land_acres === "number") {
      ok = ok && (profile.land_acres as number) <= (e.max_land_acres as number);
    }
    if (ok && (e.occupation || e.income_category || e.looking_for || e.area || e.max_land_acres)) {
      hits.push(scheme);
    }
  }
  return hits;
}

function matchLegal(category: string, details: Record<string, unknown>): LegalRight | undefined {
  const cat = norm(category);
  const issue = norm(details.issue);
  if (cat) {
    const byCategory = (legalRights as LegalRight[]).find((l) => norm(l.category) === cat);
    if (byCategory) return byCategory;
  }
  if (issue) {
    return (legalRights as LegalRight[]).find((l) =>
      l.issues.some((i) => issue === norm(i) || issue.includes(norm(i)) || norm(i).includes(issue))
    );
  }
  return undefined;
}

export function matchExtraction(data: Record<string, unknown>): MatchResult {
  const intent = norm(data.intent);

  if (intent === "scheme_discovery") {
    return { type: "schemes", schemes: matchSchemes((data.profile as Record<string, unknown>) || {}) };
  }

  if (intent === "legal_aid") {
    const legal = matchLegal(String(data.category || ""), (data.details as Record<string, unknown>) || {});
    return {
      type: "legal",
      legal,
      message: legal ? undefined : "हमने आपकी समस्या नोट कर ली है। कृपया और विवरण दें।",
    };
  }

  if (intent === "document_scan") {
    return { type: "document", message: "दस्तावेज़ स्कैन — जल्द पूर्ण सुविधा।" };
  }

  return {
    type: "general",
    message: (data.follow_up_hindi as string) || "कृपया बताएं: scheme dhundh rahe hain ya legal issue hai?",
  };
}
