import { useCallback, useEffect, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Recognition = any;

export function useSpeech(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<Recognition | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: Recognition;
      webkitSpeechRecognition?: Recognition;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    setSupported(!!SR);
    if (!SR) return;

    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "hi-IN";

    rec.onresult = (event: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onResultRef.current(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;

    return () => {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const toggle = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      rec.start();
      setListening(true);
    }
  }, [listening]);

  return { listening, supported, toggle };
}
