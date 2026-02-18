import type { SessionInfo } from "../types";
import { formatRelativeTime } from "../utils/format";

interface SessionListProps {
  sessions: SessionInfo[];
  selectedSession: string | null;
  onSelectSession: (sid: string) => void;
  onClearFilter: () => void;
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
}: SessionListProps) {
  const sorted = sortSessions(sessions);

  return (
    <div className="panel" style={{ maxHeight: 200, flexShrink: 0 }}>
      <div className="panel-title">
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
      </div>
      <div className="panel-body">
        {!sorted.length ? (
          <div className="empty-state">No sessions found</div>
        ) : (
          sorted.map((s) => {
            const shortId = s.id.slice(0, 8);
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
              >
                <div className="sid">
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
