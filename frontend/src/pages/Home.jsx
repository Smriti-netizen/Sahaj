import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import ChatBubble from "../components/ChatBubble";
import VoiceButton from "../components/VoiceButton";
import { postChat } from "../api/client";

export default function Home() {
  const { t, setLocale, locale } = useOutletContext();
  const speechLang = locale === "en" ? "en-IN" : "hi-IN";
  const [messages, setMessages] = useState([{ role: "assistant", text: t.welcome }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState([]);
  const [emergency, setEmergency] = useState(false);
  const [sessionProfile, setSessionProfile] = useState({});
  const [sessionContext, setSessionContext] = useState({});
  const [schemes, setSchemes] = useState([]);
  const [totalBenefit, setTotalBenefit] = useState(0);
  const [chatStarted, setChatStarted] = useState(false);

  useEffect(() => {
    if (!chatStarted) {
      setMessages([{ role: "assistant", text: t.welcome }]);
    }
  }, [t.welcome, chatStarted]);

  async function sendMessage(text) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    setChatStarted(true);
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setLoading(true);
    setActions([]);
    setEmergency(false);
    setSchemes([]);
    try {
      const data = await postChat(trimmed, sessionProfile, sessionContext);
      if (data.profile) {
        setSessionProfile((p) => ({ ...p, ...data.profile }));
      }
      if (data.session_context) {
        setSessionContext(data.session_context);
      }
      if (data.ui_locale && setLocale) {
        setLocale(data.ui_locale);
      }
      const replyText = data.reply || data.reply_hindi;
      setMessages((m) => [...m, { role: "assistant", text: replyText }]);
      if (data.show_scheme_cards && data.schemes?.length) {
        setSchemes(data.schemes);
        setTotalBenefit(data.total_benefit_inr || 0);
      }
      if (data.actions?.length) setActions(data.actions);
      if (data.emergency) setEmergency(true);
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
        {loading && (
          <p className="text-stone-500 text-lg animate-pulse pl-2">{t.thinking}</p>
        )}
        {emergency && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-lg">
            {t.emergency}
          </div>
        )}
        {schemes.length > 0 && (
          <section className="mb-4 space-y-3">
            <p className="font-semibold text-sahaj-green text-lg">{t.schemesFound}</p>
            {totalBenefit > 0 && (
              <p className="text-stone-700">
                {t.benefitTotal}: ₹{totalBenefit.toLocaleString("en-IN")}/saal
              </p>
            )}
            {schemes.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-white rounded-xl border border-stone-200 shadow-sm"
              >
                <h3 className="font-bold text-sahaj-saffron text-lg">{s.name_hindi}</h3>
                <p className="text-stone-700 mt-1">{s.description_hindi}</p>
                {s.benefit_note_hindi && (
                  <p className="text-stone-600 text-sm mt-1">{s.benefit_note_hindi}</p>
                )}
                {s.steps_hindi?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-stone-800">{t.stepsLabel}</p>
                    <ol className="list-decimal list-inside text-stone-700 text-sm mt-1 space-y-0.5">
                      {s.steps_hindi.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {s.required_documents?.length > 0 && (
                  <p className="text-sm text-stone-600 mt-2">
                    {t.docsLabel}: {s.required_documents.join(", ")}
                  </p>
                )}
                {s.portal_url && (
                  <a
                    href={s.portal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 min-h-[44px] px-4 py-2 rounded-lg bg-sahaj-green text-white font-semibold text-sm hover:opacity-90"
                  >
                    {t.applyPortal} →
                  </a>
                )}
              </div>
            ))}
          </section>
        )}
      </div>

      {actions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {actions.map((a) =>
            a.url ? (
              <a
                key={a.type}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[48px] px-4 py-2 rounded-xl bg-sahaj-green text-white font-semibold text-base shadow hover:opacity-90 inline-flex items-center"
              >
                {a.label_hi}
              </a>
            ) : (
              <button
                key={a.type}
                type="button"
                disabled={loading}
                onClick={() => sendMessage(a.prompt || a.label_hi)}
                className="min-h-[48px] px-4 py-2 rounded-xl bg-sahaj-green text-white font-semibold text-base shadow hover:opacity-90 disabled:opacity-50"
              >
                {a.label_hi}
              </button>
            )
          )}
        </div>
      )}

      <form
        className="sticky bottom-0 pt-2 bg-sahaj-cream space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
      >
        <div className="flex gap-2 items-stretch">
          <VoiceButton
            disabled={loading}
            onTranscript={(spoken) => sendMessage(spoken)}
            labelMic={t.mic}
            labelListening={t.listening}
            labelError={t.voiceError}
            speechLang={speechLang}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
            rows={1}
            className="flex-1 h-14 min-h-14 max-h-14 rounded-xl border border-stone-300 px-4 py-3.5 text-lg leading-snug resize-none overflow-y-auto focus:outline-none focus:ring-2 focus:ring-sahaj-saffron"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="shrink-0 h-14 w-14 flex items-center justify-center rounded-xl bg-sahaj-saffron text-white text-2xl font-bold disabled:opacity-50"
          >
            →
          </button>
        </div>
      </form>
    </div>
  );
}
