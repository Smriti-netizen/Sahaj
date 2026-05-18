import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import ChatBubble from "../components/ChatBubble";
import { postLegalQuery } from "../api/client";

export default function LegalHelp() {
  const { t } = useOutletContext();
  const [messages, setMessages] = useState([{ role: "assistant", text: t.legalWelcome }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState([]);
  const [actions, setActions] = useState([]);

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].role === "assistant") {
        return [{ role: "assistant", text: t.legalWelcome }];
      }
      return prev;
    });
  }, [t.legalWelcome]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const data = await postLegalQuery(text);
      setMessages((m) => [...m, { role: "assistant", text: data.reply_hindi }]);
      setSteps(data.legal?.steps_to_take_hindi || []);
      setActions(data.actions || []);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `${t.serverError} (${err.message})` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-[60vh]">
      <div className="flex-1 overflow-y-auto pb-4">
        {messages.map((msg, i) => (
          <ChatBubble key={i} role={msg.role}>
            {msg.text}
          </ChatBubble>
        ))}
        {loading && <p className="text-stone-500 text-lg animate-pulse">{t.thinking}</p>}
      </div>

      {steps.length > 0 && (
        <section className="mb-4 p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
          <h2 className="font-semibold text-lg mb-2 text-sahaj-green">{t.stepsTitle}</h2>
          <ul className="space-y-2 text-base list-none pl-0">
            {steps.map((step, i) => (
              <li key={i} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ul>
        </section>
      )}

      {actions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.type}
              type="button"
              className="min-h-[48px] px-4 py-2 rounded-xl bg-sahaj-green text-white font-semibold"
            >
              {a.label_hi}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 items-end"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder={t.legalPlaceholder}
          className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-lg resize-none focus:outline-none focus:ring-2 focus:ring-sahaj-saffron"
        />
        <button
          type="submit"
          disabled={loading}
          aria-label="Send"
          className="min-h-[56px] min-w-[56px] flex items-center justify-center rounded-xl bg-sahaj-saffron text-white text-2xl font-bold disabled:opacity-50"
        >
          →
        </button>
      </form>
    </div>
  );
}
