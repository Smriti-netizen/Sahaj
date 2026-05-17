import type { ChatMessage as Msg } from "../types";
import { LegalCard } from "./LegalCard";
import { SchemeCards } from "./SchemeCards";

export function ChatMessage({ message }: { message: Msg }) {
  const isUser = message.role === "user";
  const parts = message.text.split("\n\n");
  const headline = parts[0] ?? "";
  const jsonBlock = parts.slice(1).join("\n\n").trim();

  return (
    <div className={`bubble ${isUser ? "bubble-user" : "bubble-bot"}`}>
      <div className="bubble-label">{isUser ? "You" : "Sahaj"}</div>
      <p className="bubble-text">{headline}</p>
      {!isUser && jsonBlock && <pre className="bubble-json">{jsonBlock}</pre>}
      {message.data?.results.schemes && <SchemeCards schemes={message.data.results.schemes} />}
      {message.data?.results.legal && <LegalCard legal={message.data.results.legal} />}
    </div>
  );
}
