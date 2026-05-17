import type { ChatResponse } from "../types";

export async function sendMessage(message: string): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as ChatResponse;
}

export function formatBotReply(data: ChatResponse): string {
  const lines = [
    data.source === "demo" ? "(Demo mode — set HF_TOKEN on Vercel for live API)\n" : "",
    `Intent: ${data.extraction.intent ?? "unknown"}`,
    "",
    JSON.stringify(data.extraction, null, 2),
  ];
  if (data.results.message) lines.push("", data.results.message);
  return lines.filter(Boolean).join("\n");
}
