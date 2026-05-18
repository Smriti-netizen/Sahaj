export default function ChatBubble({ role, children }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 text-lg leading-relaxed shadow-sm no-underline ${
          isUser
            ? "bg-sahaj-saffron text-white rounded-br-md"
            : "bg-white text-sahaj-ink border border-stone-200 rounded-bl-md"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
