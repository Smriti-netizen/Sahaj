import { demoExtraction } from "../lib/demo";
import { matchExtraction } from "../lib/matcher";
import type { ChatResponse } from "../types";

function localFallback(message: string): ChatResponse {
  const extraction = demoExtraction(message);
  return {
    extraction,
    results: matchExtraction(extraction),
    source: "demo",
  };
}

export async function sendMessage(message: string): Promise<ChatResponse> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return localFallback(message);
    }

    if (!res.ok) {
      return localFallback(message);
    }

    return data as unknown as ChatResponse;
  } catch {
    return localFallback(message);
  }
}

export function formatBotReply(data: ChatResponse): string {
  const intent = String(data.extraction?.intent ?? "unknown");
  const followUp =
    (data.extraction?.follow_up_hindi as string | undefined) || data.results.message;

  let headline = "";
  if (intent === "scheme_discovery" && data.results.schemes?.length) {
    headline = `Aapke liye ${data.results.schemes.length} scheme(s) mili hain — neeche dekhein.`;
  } else if (intent === "legal_aid" && data.results.legal) {
    headline = "Aapke legal rights aur steps neeche hain.";
  } else if (followUp) {
    headline = followUp;
  } else {
    headline = "Maine aapki situation samajh li. Neeche details hain.";
  }

  return [headline, "", JSON.stringify(data.extraction, null, 2)].join("\n");
}
