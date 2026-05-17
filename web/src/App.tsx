import { useState } from "react";
import { sendMessage, formatBotReply } from "./api/client";
import { ChatMessage as ChatBubble } from "./components/ChatMessage";
import { Header } from "./components/Header";
import type { ChatMessage } from "./types";
import "./App.css";

const EXAMPLES = [
  { label: "Scheme — farmer UP", text: "Main kisan hoon UP se, 2 acre, BPL card hai" },
  { label: "Legal — consumer", text: "Amazon se order kiya refund nahi mil raha" },
  { label: "Vague query", text: "bhai kuch kaam nahi mil raha" },
];

export default function App() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>([]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    setHistory((h) => [...h, { role: "user", text }]);

    try {
      const data = await sendMessage(text);
      setHistory((h) => [
        ...h,
        { role: "bot", text: formatBotReply(data), data },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <Header />

      <section className="chat">
        {history.length === 0 && (
          <div className="hint">
            <p>Try an example:</p>
            {EXAMPLES.map((ex) => (
              <button key={ex.label} type="button" className="chip" onClick={() => setInput(ex.text)}>
                {ex.label}
              </button>
            ))}
          </div>
        )}

        {history.map((msg, i) => (
          <ChatBubble key={i} message={msg} />
        ))}

        {loading && <p className="status">Sahaj soch raha hai…</p>}
        {error && <p className="error">{error}</p>}
      </section>

      <div className="composer">
        <div className="composer-inner">
          <textarea
            rows={2}
            placeholder="Hindi ya English mein apni situation likhiye…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button type="button" className="send-btn" onClick={handleSend} disabled={loading}>
            {loading ? "…" : "Bhejein"}
          </button>
        </div>
      </div>

      <p className="footer-note">
        LoRA:{" "}
        <a href="https://huggingface.co/smrtnetizen/sahaj-lora" target="_blank" rel="noreferrer">
          smrtnetizen/sahaj-lora
        </a>
      </p>
    </div>
  );
}
