import { useMemo } from "react";
import type { ChatMessage as ChatMessageType } from "../types";

interface ChatMessageProps {
  message: ChatMessageType;
}

function renderMarkdown(text: string): string {
  return text
    // Code blocks (```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="code-block">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Headers
    .replace(/^### (.+)$/gm, '<div class="md-h3">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="md-h2">$1</div>')
    .replace(/^# (.+)$/gm, '<div class="md-h1">$1</div>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="md-hr" />')
    // Table rows: | col | col | col |
    .replace(/^\|(.+)\|$/gm, (_match, row: string) => {
      const cells = row.split("|").map((c: string) => c.trim());
      const isHeader = cells.every((c: string) => /^-+$/.test(c));
      if (isHeader) return "";
      const tag = "td";
      const cellsHtml = cells.map((c: string) => `<${tag}>${c}</${tag}>`).join("");
      return `<tr>${cellsHtml}</tr>`;
    })
    // Wrap consecutive <tr> in <table>
    .replace(/((?:<tr>.*<\/tr>\n?)+)/g, '<table class="md-table">$1</table>')
    // List items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Line breaks (preserve newlines)
    .replace(/\n/g, "<br />");
}

export function ChatMessage({ message }: ChatMessageProps) {
  const html = useMemo(
    () => (message.role === "assistant" && message.content ? renderMarkdown(message.content) : ""),
    [message.role, message.content],
  );

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
        html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <span className="chat-loading">...</span>
        )
      ) : (
        message.content
      )}
    </div>
  );
}
