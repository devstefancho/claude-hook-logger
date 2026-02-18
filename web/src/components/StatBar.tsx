import type { Summary } from "../types";

interface StatBarProps {
  summary: Summary;
}

export function StatBar({ summary: s }: StatBarProps) {
  const liveCount = s.liveSessionCount || 0;
  const staleCount = s.staleSessionCount || 0;
  const totalSessions = s.sessionCount || 0;
  const interrupts = s.interruptCount || 0;
  const orphans = s.orphanCount || 0;

  return (
    <div className="stat-bar">
      <div className="stat">
        <span className="val">{s.totalEvents || 0}</span> events
      </div>
      <span className="separator">|</span>
      <div className="stat">
        Sessions:{" "}
        {liveCount > 0 && <span className="val live">{liveCount} live</span>}
        {liveCount > 0 && (staleCount > 0 || true) && " / "}
        {staleCount > 0 && (
          <>
            <span className="val stale">{staleCount} stale</span>
            {" / "}
          </>
        )}
        <span className="val">{totalSessions}</span> total
      </div>
      <span className="separator">|</span>
      <div className="stat">
        <span className="val">{s.toolCount || 0}</span> tools
      </div>
      <span className="separator">|</span>
      <div className="stat">
        <span className={`val${interrupts ? " warn" : ""}`}>{interrupts}</span>{" "}
        interrupts{" "}
        <span
          className="info-icon"
          title="Sessions terminated by the stop hook while still active"
        >
          &#9432;
        </span>
      </div>
      <span className="separator">|</span>
      <div className="stat">
        <span className={`val${orphans ? " caution" : ""}`}>{orphans}</span>{" "}
        orphans{" "}
        <span
          className="info-icon"
          title="PreToolUse events that never received a matching PostToolUse response"
        >
          &#9432;
        </span>
      </div>
    </div>
  );
}
