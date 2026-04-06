import { useState } from "react";
import type { FeedItem } from "../hooks/useActivityFeed";
import { formatRelativeTime, truncate } from "../utils/format";

type FeedFilter = "all" | "stop" | "permission" | "prompt";

const FILTER_OPTIONS: { value: FeedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "stop", label: "Stop" },
  { value: "permission", label: "Perm" },
  { value: "prompt", label: "Prompt" },
];

const TYPE_COLORS: Record<string, string> = {
  stop: "#3fb950",
  permission: "#f0883e",
  prompt: "#58a6ff",
};

interface ActivityFeedPanelProps {
  open: boolean;
  items: FeedItem[];
  onClose: () => void;
  onScrollToAgent: (sessionId: string) => void;
}

export function ActivityFeedPanel({ open, items, onClose, onScrollToAgent }: ActivityFeedPanelProps) {
  const [filter, setFilter] = useState<FeedFilter>("all");

  if (!open) return null;

  const filtered = filter === "all" ? items : items.filter((i) => i.type === filter);

  return (
    <div className="activity-feed-panel">
      <div className="activity-feed-header">
        <span className="activity-feed-title">Activity Feed</span>
        <button className="activity-feed-close" onClick={onClose}>&times;</button>
      </div>
      <div className="activity-feed-filters">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className={`filter-pill${filter === opt.value ? " active" : ""}`}
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="activity-feed-body">
        {filtered.length === 0 ? (
          <div className="empty-state">No activity</div>
        ) : (
          filtered.map((item, i) => (
            <div
              key={`${item.ts}-${i}`}
              className="activity-feed-item"
              onClick={() => onScrollToAgent(item.sessionId)}
            >
              <span className="feed-item-dot" style={{ backgroundColor: TYPE_COLORS[item.type] }} />
              <span className="feed-item-time">{formatRelativeTime(item.ts)}</span>
              <span className="feed-item-session">{item.sessionId.slice(0, 8)}</span>
              <span className="feed-item-type">{item.type}</span>
              <span className="feed-item-msg">{truncate(item.message, 60)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
