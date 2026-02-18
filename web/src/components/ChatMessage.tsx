import Markdown from "react-markdown";
import type { ChatMessage as ChatMessageType } from "../types";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={`chat-bubble ${message.role}`}>
      {message.toolsUsed && message.toolsUsed.length > 0 && (
        <div className="tool-badges">
          {message.toolsUsed.map((tool, i) => (
            <span key={i} className="tool-badge">{tool}</span>
          ))}
        </div>
      )}
      {message.role === "assistant" ? (
        message.content ? (
          <Markdown>{message.content}</Markdown>
        ) : (
          <span className="chat-loading">...</span>
        )
      ) : (
        message.content
      )}
    </div>
  );
}
