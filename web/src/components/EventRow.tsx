import type { LogEvent } from "../types";
import { EVENT_TYPES } from "../utils/constants";
import { formatRelativeTime, formatAbsTime, truncate } from "../utils/format";

interface EventRowProps {
  event: LogEvent;
  index: number;
  isOrphan: boolean;
  isHighlighted: boolean;
  onFilterBySession: (sid: string) => void;
}

function buildDetail(ev: LogEvent): string {
  const d = ev.data || {};
  switch (ev.event) {
    case "PreToolUse":
      return `<span class="tool">${escHtml(d.tool_name || "")}</span> ${escHtml(truncate(d.tool_input_summary || "", 120))}`;
    case "PostToolUse":
      return `<span class="tool">${escHtml(d.tool_name || "")}</span> ${d.success ? "&#10004;" : "&#10008;"}`;
    case "PostToolUseFailure":
      return `<span class="tool">${escHtml(d.tool_name || "")}</span> &#10008; ${escHtml(truncate(d.error || "", 100))}`;
    case "UserPromptSubmit":
      return escHtml(truncate(d.prompt || d.message || JSON.stringify(d), 150));
    case "Stop":
      return d.stop_hook_active
        ? "&#9889; Session interrupted (stop hook)"
        : escHtml(truncate(JSON.stringify(d), 120));
    case "Notification":
      return escHtml(truncate(d.message || JSON.stringify(d), 150));
    default:
      return escHtml(truncate(JSON.stringify(d), 150));
  }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function EventRow({
  event: ev,
  index,
  isOrphan,
  isHighlighted,
  onFilterBySession,
}: EventRowProps) {
  const info = EVENT_TYPES[ev.event] || { badge: ev.event, cls: "badge-stop" };
  const isInterrupt = ev.event === "Stop" && ev.data?.stop_hook_active;
  const rowCls = [
    "event-row",
    isOrphan ? "orphan" : "",
    isHighlighted ? "highlight" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const shortSid = (ev.session_id || "").slice(0, 6);

  return (
    <div className={rowCls} id={`ev-${index}`}>
      <span className="time" title={formatAbsTime(ev.ts)}>
        {formatRelativeTime(ev.ts)}
      </span>
      <span className={`badge ${info.cls}`}>{info.badge}</span>
      {isOrphan && <span className="extra-badge badge-orphan">ORPHAN</span>}
      {isInterrupt && (
        <span className="extra-badge badge-interrupt">&#9889; INTERRUPT</span>
      )}
      <span
        className="detail"
        dangerouslySetInnerHTML={{ __html: buildDetail(ev) }}
      />
      <span
        className="session-tag clickable"
        onClick={() => onFilterBySession(ev.session_id || "")}
        title="Filter by this session"
      >
        {shortSid}
      </span>
    </div>
  );
}
