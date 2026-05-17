import { MicIcon, SendIcon } from "./Icons";

type Props = {
  value: string;
  loading: boolean;
  listening: boolean;
  voiceSupported: boolean;
  onChange: (v: string) => void;
  onSend: () => void;
  onVoice: () => void;
};

export function Composer({ value, loading, listening, voiceSupported, onChange, onSend, onVoice }: Props) {
  return (
    <div className="composer">
      <div className="composer-bar">
        {voiceSupported && (
          <button
            type="button"
            className={`icon-btn ${listening ? "icon-btn-active" : ""}`}
            onClick={onVoice}
            title="Voice input (Hindi)"
            aria-label="Voice input"
          >
            <MicIcon active={listening} />
          </button>
        )}
        <textarea
          rows={1}
          className="composer-input"
          placeholder="Apni situation likhiye — Hindi ya English…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          type="button"
          className="send-btn"
          onClick={onSend}
          disabled={loading || !value.trim()}
          title="Send"
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}
