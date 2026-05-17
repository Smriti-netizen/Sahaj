export interface Scheme {
  id: string;
  name: string;
  name_hindi: string;
  description_hindi: string;
  benefit_amount: string;
  portal_url: string;
  eligibility: Record<string, unknown>;
}

export interface LegalRight {
  category: string;
  title_hindi: string;
  laws: string[];
  steps_hindi: string[];
  portal_url: string;
  issues: string[];
}

export interface MatchResult {
  type: "schemes" | "legal" | "general" | "document";
  schemes?: Scheme[];
  legal?: LegalRight;
  message?: string;
}

export interface ChatResponse {
  extraction: Record<string, unknown>;
  results: MatchResult;
  source?: "hf" | "demo";
}

export interface ChatMessage {
  role: "user" | "bot";
  text: string;
  data?: ChatResponse;
}
