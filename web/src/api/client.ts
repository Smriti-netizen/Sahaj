import { demoExtraction } from "../lib/demo";
import { matchExtraction } from "../lib/matcher";
import type { ChatMessage, ChatResponse } from "../types";

function buildContext(message: string, history: ChatMessage[]): string {
  const prior = history
    .filter((h) => h.role === "user")
    .slice(-4)
    .map((h) => h.text);
  return [...prior, message].join("\n");
}

function localFallback(message: string, history: ChatMessage[]): ChatResponse {
  const context = buildContext(message, history);
  const extraction = demoExtraction(context);
  return {
    extraction,
    results: matchExtraction(extraction),
    source: "demo",
  };
}

export async function sendMessage(message: string, history: ChatMessage[] = []): Promise<ChatResponse> {
  const context = buildContext(message, history);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context }),
    });

    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return localFallback(message, history);
    }

    if (!res.ok) {
      return localFallback(message, history);
    }

    return data as unknown as ChatResponse;
  } catch {
    return localFallback(message, history);
  }
}

/** Natural-language reply only — no raw JSON in chat UI. */
export function formatBotReply(data: ChatResponse): string {
  const ext = data.extraction ?? {};
  const intent = String(ext.intent ?? "unknown");
  const empathy = ext.empathy_hindi as string | undefined;
  const followUp = (ext.follow_up_hindi as string | undefined) || data.results.message;

  if (empathy) {
    const legal = data.results.legal;
    if (legal) {
      return `${empathy}\n\nNeeche aapke hak aur zaroori kadam hain — ${legal.title_hindi}.`;
    }
    return empathy;
  }

  if (intent === "scheme_discovery" && data.results.schemes?.length) {
    const n = data.results.schemes.length;
    return `Aapki situation ke hisaab se ${n} sarkari scheme${n > 1 ? "s" : ""} mili hain. Neeche details aur official portal links hain — apply karne se pehle eligibility zaroor check karein.`;
  }

  if (intent === "legal_aid" && data.results.legal) {
    return `Samajh gayi — yeh ek legal matter hai. Neeche ${data.results.legal.title_hindi} se judi laws aur step-by-step guide hai. Zarurat ho to free legal aid (NALSA) bhi available hai.`;
  }

  if (intent === "legal_aid" && followUp) {
    return followUp;
  }

  if (followUp) {
    return followUp;
  }

  return "Maine aapki baat sun li. Thoda aur detail batayein — scheme ya legal issue?";
}
