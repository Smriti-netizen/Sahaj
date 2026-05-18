import { useEffect, useRef, useState } from "react";

function MicIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <path d="M12 19v3" />
    </svg>
  );
}

export default function VoiceButton({
  onTranscript,
  disabled,
  labelMic,
  labelListening,
  labelError,
  speechLang = "hi-IN",
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = speechLang;
    rec.onresult = (event) => {
      const text = event.results[0][0].transcript;
      if (text?.trim()) onTranscript(text.trim());
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [onTranscript, speechLang]);

  function toggle() {
    if (!supported || disabled) return;
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }
    setListening(true);
    rec.start();
  }

  if (!supported) {
    return (
      <p className="text-sm text-stone-500 text-center mb-2">{labelError}</p>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? labelListening : labelMic}
      title={listening ? labelListening : labelMic}
      className={`h-14 w-14 shrink-0 flex items-center justify-center rounded-xl transition-colors ${
        listening
          ? "bg-sahaj-green text-white animate-pulse"
          : "bg-white border-2 border-sahaj-saffron text-sahaj-saffron hover:bg-orange-50"
      } disabled:opacity-50`}
    >
      <MicIcon className="w-6 h-6" />
    </button>
  );
}
