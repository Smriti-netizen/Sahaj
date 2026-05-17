import type { ChatMessage as Msg } from "../types";
import { LegalCard } from "./LegalCard";
import { SchemeCards } from "./SchemeCards";

export function ChatMessage({ message }: { message: Msg }) {
  const isUser = message.role === "user";

  return (
    <div className={`bubble ${isUser ? "bubble-user" : "bubble-bot"}`}>
      {!isUser && <div className="bubble-label">Sahaj</div>}
      <p className="bubble-text">{message.text}</p>
      {message.data?.results.schemes && <SchemeCards schemes={message.data.results.schemes} />}
      {message.data?.results.legal && <LegalCard legal={message.data.results.legal} />}
    </div>
  );
}
