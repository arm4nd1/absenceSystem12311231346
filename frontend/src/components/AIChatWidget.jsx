import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, Sparkles, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { useAIChat } from "../hooks/useAI";

const SUGGESTED = [
  "Which students are at risk of failing?",
  "What's the overall attendance rate?",
  "Who has the lowest marks?",
  "Summarise this week's attendance",
];

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={clsx("flex gap-2.5 mb-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={clsx(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
        isUser
          ? "bg-blue-600 text-white"
          : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
      )}>
        {isUser ? "U" : <Bot size={14} />}
      </div>
      {/* Bubble */}
      <div className={clsx(
        "max-w-[82%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
        isUser
          ? "bg-blue-600 text-white rounded-tr-sm"
          : "bg-slate-800 text-slate-200 rounded-tl-sm"
      )}>
        {msg.text}
      </div>
    </div>
  );
}

export default function AIChatWidget() {
  const [open,    setOpen]    = useState(false);
  const [input,   setInput]   = useState("");
  const [history, setHistory] = useState([
    { role: "model", text: "Hi! I'm your AI assistant for AttendFP. I have live access to student attendance, marks, and subject data. Ask me anything!" },
  ]);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const chatMut   = useAIChat();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, chatMut.isPending]);

  async function send(text) {
    const msg = text || input.trim();
    if (!msg || chatMut.isPending) return;
    setInput("");

    const userMsg = { role: "user", text: msg };
    setHistory(h => [...h, userMsg]);

    try {
      const { response } = await chatMut.mutateAsync({
        message: msg,
        history: history.filter(h => h.role !== "model" || h !== history[0]),
      });
      setHistory(h => [...h, { role: "model", text: response }]);
    } catch {
      setHistory(h => [...h, {
        role: "model",
        text: "Sorry, I couldn't get a response. Make sure the GEMINI_API_KEY is set in backend/.env.",
      }]);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl",
          "flex items-center justify-center transition-all duration-200",
          "bg-gradient-to-br from-indigo-600 to-purple-700 text-white",
          "hover:scale-110 active:scale-95",
          open && "scale-95"
        )}
        title="AI Assistant"
      >
        {open ? <ChevronDown size={22} /> : <Sparkles size={22} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className={clsx(
          "fixed bottom-24 right-6 z-50 w-96 flex flex-col",
          "bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl",
          "overflow-hidden"
        )}
          style={{ maxHeight: "520px", height: "520px" }}
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800
                          bg-gradient-to-r from-indigo-900/60 to-purple-900/60 shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                            flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">AttendFP AI</p>
              <p className="text-xs text-slate-400">Powered by Gemini · Live data</p>
            </div>
            <button onClick={() => setOpen(false)}
                    className="ml-auto text-slate-500 hover:text-slate-300 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {history.map((msg, i) => <Message key={i} msg={msg} />)}

            {chatMut.isPending && (
              <div className="flex gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600
                                flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="px-3 py-2 rounded-2xl rounded-tl-sm bg-slate-800 text-slate-400 text-sm">
                  <Loader2 size={14} className="animate-spin inline mr-1" /> Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions (only at start) */}
          {history.length === 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {SUGGESTED.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-xs px-2.5 py-1 rounded-full border border-slate-700
                             text-slate-400 hover:border-indigo-500 hover:text-indigo-300
                             transition-all bg-slate-800/50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-800 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about attendance, marks, students…"
                disabled={chatMut.isPending}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2
                           text-sm text-slate-200 placeholder-slate-600 outline-none resize-none
                           focus:border-indigo-500 transition-colors disabled:opacity-50
                           max-h-24"
                style={{ lineHeight: "1.4" }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || chatMut.isPending}
                className="w-9 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white
                           flex items-center justify-center transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
            <p className="text-xs text-slate-700 mt-1.5 text-center">
              Responses based on live system data
            </p>
          </div>
        </div>
      )}
    </>
  );
}
