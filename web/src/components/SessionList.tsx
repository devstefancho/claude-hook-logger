import { useState, useMemo } from "react";
import type { SessionInfo } from "../types";
import { formatRelativeTime } from "../utils/format";
import { getSessionColor } from "../utils/sessionColor";

interface SessionListProps {
  sessions: SessionInfo[];
  selectedSession: string | null;
  onSelectSession: (sid: string) => void;
  onClearFilter: () => void;
  height?: number;
  maximized?: boolean;
  onToggleMaximize?: () => void;
}

function sortSessions(sessions: SessionInfo[]): SessionInfo[] {
  return [...sessions].sort((a, b) => {
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    if (a.isStale && !b.isStale) return -1;
    if (!a.isStale && b.isStale) return 1;
    if (a.isStale && b.isStale) {
      const aIssues = (a.hasInterrupt ? 1 : 0) + a.orphanCount;
      const bIssues = (b.hasInterrupt ? 1 : 0) + b.orphanCount;
      if (aIssues !== bIssues) return bIssues - aIssues;
    }
    return b.lastTs > a.lastTs ? 1 : -1;
  });
}

export function SessionList({
  sessions,
  selectedSession,
  onSelectSession,
  onClearFilter,
  height,
  maximized,
  onToggleMaximize,
}: SessionListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => {
      return (
        s.id.toLowerCase().includes(q) ||
        s.cwd.toLowerCase().includes(q) ||
        String(s.eventCount).includes(q)
      );
    });
  }, [sessions, searchQuery]);

  const sorted = sortSessions(filteredSessions);

  return (
    <div className="panel" style={maximized ? { flex: 1, minHeight: 0 } : { height: height ?? 200, flexShrink: 0 }}>
      <div className="panel-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>
          Sessions
          {selectedSession && (
            <span style={{ color: "#58a6ff", fontSize: 10, fontWeight: 400, marginLeft: 8 }}>
              (filtered: {selectedSession.slice(0, 8)}){" "}
              <span
                style={{ cursor: "pointer", color: "#f85149" }}
                onClick={onClearFilter}
              >
                &#10005;
              </span>
            </span>
          )}
        </span>
        {onToggleMaximize && (
          <button className="panel-maximize-btn" onClick={onToggleMaximize} title={maximized ? "Restore" : "Maximize"}>
            {maximized ? "\u25A3" : "\u25A1"}
          </button>
        )}
      </div>
      <div className="session-search">
        <input
          className="search-input"
          type="text"
          placeholder="Search sessions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="search-count">{sorted.length}/{sessions.length}</span>
      </div>
      <div className="panel-body">
        {!sorted.length ? (
          <div className="empty-state">No sessions found</div>
        ) : (
          sorted.map((s) => {
            const shortId = s.id.slice(0, 8);
            const color = getSessionColor(s.id);
            const cls = [
              "session-card",
              selectedSession === s.id ? "selected" : "",
              s.hasInterrupt ? "has-interrupt" : "",
              s.orphanCount > 0 ? "has-orphan" : "",
              s.isLive ? "is-live" : "",
              s.isStale ? "is-stale" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div
                key={s.id}
                className={cls}
                id={`sess-${shortId}`}
                onClick={() => onSelectSession(s.id)}
                style={{ borderLeftColor: color, borderLeftWidth: 3, borderLeftStyle: "solid" }}
              >
                <div className="sid">
                  <span className="session-dot" style={{ backgroundColor: color }} />
                  {shortId}
                  {s.isLive && <span className="live-badge" title="Active within last 5 min">LIVE</span>}
                  {s.isStale && <span className="stale-badge" title="No activity for 5+ min">STALE</span>}
                </div>
                <div className="cwd">{s.cwd}</div>
                <div className="stats">
                  <span>{s.eventCount} events</span>
                  {s.hasInterrupt && <span className="warn">&#9889; interrupt</span>}
                  {s.orphanCount > 0 && (
                    <span className="caution">&#9888; {s.orphanCount} orphan</span>
                  )}
                  <span className="ago">{formatRelativeTime(s.lastTs)} ago</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
