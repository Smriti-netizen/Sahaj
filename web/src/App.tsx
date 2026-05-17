import { useRef, useState } from "react";
import { sendMessage, formatBotReply } from "./api/client";
import { ChatMessage as ChatBubble } from "./components/ChatMessage";
import { Composer } from "./components/Composer";
import { Header } from "./components/Header";
import { useSpeech } from "./hooks/useSpeech";
import type { ChatMessage } from "./types";
import "./App.css";

const EXAMPLES = [
  { label: "Scheme — farmer UP", text: "Main kisan hoon UP se, 2 acre, BPL card hai" },
  { label: "Legal — consumer", text: "Amazon se order kiya refund nahi mil raha" },
  { label: "Employment", text: "mujhe kaam dilway do" },
];

export default function App() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { listening, supported, toggle: toggleVoice } = useSpeech((text) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
  });

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    setHistory((h) => [...h, { role: "user", text }]);

    try {
      const data = await sendMessage(text, history);
      setHistory((h) => [
        ...h,
        { role: "bot", text: formatBotReply(data), data },
      ]);
      requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }));
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

        {loading && <p className="status">Sahaj is thinking…</p>}
        {error && <p className="error">{error}</p>}
        <div ref={chatEndRef} />
      </section>

      <Composer
        value={input}
        loading={loading}
        listening={listening}
        voiceSupported={supported}
        onChange={setInput}
        onSend={handleSend}
        onVoice={toggleVoice}
      />
    </div>
  );
}
