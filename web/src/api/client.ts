import type { ChatMessage, ChatResponse } from "../types";

function buildContext(message: string, history: ChatMessage[]): string {
  const prior = history
    .filter((h) => h.role === "user")
    .slice(-4)
    .map((h) => h.text);
  return [...prior, message].join("\n");
}

export async function sendMessage(message: string, history: ChatMessage[] = []): Promise<ChatResponse> {
  const context = buildContext(message, history);
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });
  const text = await res.text();
  const data = JSON.parse(text) as ChatResponse;
  if (!res.ok) {
    throw new Error(String((data as unknown as { error?: string }).error || `API ${res.status}`));
  }
  return data;
}

/** Show intent + full extraction JSON (like notebook testing). */
export function formatBotReply(data: ChatResponse): string {
  const lines = [
    `Intent: ${String(data.extraction?.intent ?? "unknown")} · source: ${data.source ?? "?"}`,
    "",
    JSON.stringify(data.extraction, null, 2),
  ];
  if (data.results.message) lines.push("", String(data.results.message));
  return lines.join("\n");
}
