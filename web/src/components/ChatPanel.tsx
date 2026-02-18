import { useEffect, useRef, useCallback, useState } from "react";
import { useChat } from "../hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

const PRESETS = [
  "Summarize the last 30 minutes of activity",
  "What are the most used tools and skills?",
  "Describe the most recent session",
  "Are there any issues?",
];

const MIN_WIDTH = 320;
const MAX_WIDTH = 900;
const DEFAULT_WIDTH = 420;

export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const { messages, streaming, sendMessage, clearMessages } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragging = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div
      className={`chat-panel${open ? " open" : ""}`}
      style={{ width }}
    >
      <div className="chat-resize-handle" onMouseDown={onMouseDown} />
      <div className="chat-header">
        <h2>Chat</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="chat-close"
            onClick={clearMessages}
            title="Clear chat"
          >
            Clear
          </button>
          <button className="chat-close" onClick={onClose} title="Close chat">
            &#10005;
          </button>
        </div>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="empty-state">
            Ask questions about your dashboard data
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            className="preset-btn"
            onClick={() => sendMessage(preset)}
            disabled={streaming}
          >
            {preset}
          </button>
        ))}
      </div>
      <ChatInput onSend={sendMessage} disabled={streaming} />
    </div>
  );
}
