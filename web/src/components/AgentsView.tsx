import { useState, useMemo, useCallback, useEffect } from "react";
import type { AgentInfo, SessionInfo } from "../types";
import { formatRelativeTime, truncate } from "../utils/format";
import { getSessionColor } from "../utils/sessionColor";

const STATUS_COLORS: Record<AgentInfo["status"], string> = {
  active: "#3fb950",
  idle: "#d29922",
  waiting: "#f0883e",
  ended: "#8b949e",
};

const STATUS_LABELS: Record<AgentInfo["status"], string> = {
  active: "ACTIVE",
  idle: "IDLE",
  waiting: "WAITING",
  ended: "ENDED",
};

const STATUS_PRIORITY: Record<AgentInfo["status"], number> = {
  active: 0,
  idle: 1,
  waiting: 2,
  ended: 3,
};

const THRESHOLD_OPTIONS = [
  { label: "5m", value: 5 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
];

type StatusFilter = "all" | AgentInfo["status"];
type SortBy = "status" | "activity" | "name";

function formatDuration(ms: number): string {
  if (ms < 60000) return "<1m";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatElapsed(startTs: string): string {
  const elapsed = Date.now() - new Date(startTs).getTime();
  return formatDuration(elapsed);
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

interface AgentsViewProps {
  agents: AgentInfo[];
  sessions: SessionInfo[];
  selectedSessions: Set<string>;
  onSelectSession: (sid: string) => void;
  onToggleSessionFilter: (sid: string) => void;
  onFilterBySession: (sid: string) => void;
  onClearSessionFilter: () => void;
  onGenerateSummary: (sid: string) => void;
  onOpenTmux: (sid: string) => void;
  threshold: number;
  onThresholdChange: (value: number) => void;
}

export function AgentsView({
  agents,
  sessions,
  selectedSessions,
  onSelectSession,
  onToggleSessionFilter,
  onFilterBySession,
  onClearSessionFilter,
  onGenerateSummary,
  onOpenTmux,
  threshold,
  onThresholdChange,
}: AgentsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("status");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Live elapsed time update for active agents
  useEffect(() => {
    const hasActive = agents.some((a) => a.status === "active" || a.status === "idle");
    if (!hasActive) return;
    const timer = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(timer);
  }, [agents]);

  const handleCopy = useCallback((text: string, id: string) => {
    copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const sessionMap = useMemo(() => {
    const map = new Map<string, SessionInfo>();
    for (const s of sessions) map.set(s.id, s);
    return map;
  }, [sessions]);

  const filtered = useMemo(() => {
    let list = agents;
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) =>
        (a.name?.toLowerCase().includes(q)) ||
        a.sessionId.toLowerCase().includes(q) ||
        a.projectName.toLowerCase().includes(q) ||
        a.cwd.toLowerCase().includes(q)
      );
    }
    // Sort
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "status":
          return (STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status])
            || (new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
        case "activity":
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        case "name":
          return (a.name || a.sessionId).localeCompare(b.name || b.sessionId);
      }
    });
    return list;
  }, [agents, statusFilter, searchQuery, sortBy]);

  const activeCount = agents.filter((a) => a.status === "active").length;
  const idleCount = agents.filter((a) => a.status === "idle").length;

  return (
    <div className="view-container">
      <div className="view-header">
        <div className="view-title-row">
          <h2 className="view-title">AGENTS</h2>
          <span className="view-subtitle">
            <span style={{ color: "#3fb950" }}>{activeCount} active</span>
            {" / "}
            <span style={{ color: "#d29922" }}>{idleCount} idle</span>
            {" / "}
            <span>{agents.length} total</span>
          </span>
        </div>
        <div className="view-controls">
          <div className="status-filters">
            {(["all", "active", "idle", "waiting", "ended"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                className={`filter-pill${statusFilter === s ? " active" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <span className="threshold-control">
            active &lt;
            <select
              value={threshold}
              onChange={(e) => onThresholdChange(Number(e.target.value))}
              className="threshold-select"
            >
              {THRESHOLD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </span>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="status">Sort: Status</option>
            <option value="activity">Sort: Activity</option>
            <option value="name">Sort: Name</option>
          </select>
          <input
            className="view-search"
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="view-body">
        {!filtered.length ? (
          <div className="empty-state">No agents found</div>
        ) : (
          <>
            {selectedSessions.size > 0 && (
              <div className="agents-filter-actions">
                <span className="filter-count">{selectedSessions.size} selected</span>
                <button
                  className="action-btn active"
                  onClick={() => {
                    onFilterBySession(Array.from(selectedSessions)[0]);
                  }}
                >
                  View Events
                </button>
                <button className="action-btn" onClick={onClearSessionFilter}>
                  Clear
                </button>
              </div>
            )}
            <div className="agents-grid">
            {filtered.map((agent) => {
              const color = STATUS_COLORS[agent.status];
              const session = sessionMap.get(agent.sessionId);
              const sessionColor = getSessionColor(agent.sessionId);
              const isSelected = selectedSessions.has(agent.sessionId);
              const lastPrompt = agent.recentPrompts.length > 0
                ? agent.recentPrompts[agent.recentPrompts.length - 1]
                : null;

              return (
                <div
                  key={agent.sessionId}
                  className={`agent-card-v2${isSelected ? " selected" : ""} status-${agent.status}`}
                  style={{ "--status-color": color, "--session-color": sessionColor } as React.CSSProperties}
                >
                  <div className="agent-card-header">
                    <span className="agent-dot-v2" style={{ backgroundColor: color }} />
                    <span className="agent-name-v2">
                      {agent.name ? `"${agent.name}"` : agent.sessionId.slice(0, 8)}
                    </span>
                    <span className="agent-badge-v2" style={{ backgroundColor: color }}>
                      {STATUS_LABELS[agent.status]}
                    </span>
                  </div>

                  <div className="agent-project-v2">
                    {agent.projectName}
                    {agent.branch && <span className="agent-branch-v2"> ({agent.branch})</span>}
                  </div>

                  {agent.summary && (
                    <div className="agent-summary-v2">{agent.summary}</div>
                  )}

                  {lastPrompt && !agent.summary && (
                    <div className="agent-prompt-v2">
                      &gt; {truncate(lastPrompt, 120)}
                    </div>
                  )}

                  <div className="agent-session-id">
                    <span className="session-id-text" title={agent.sessionId}>
                      {agent.sessionId.slice(0, 12)}...
                    </span>
                    <button
                      className={`copy-btn${copiedId === agent.sessionId ? " copied" : ""}`}
                      onClick={() => handleCopy(agent.sessionId, agent.sessionId)}
                      title="Copy full session ID"
                    >
                      {copiedId === agent.sessionId ? "✓" : "⧉"}
                    </button>
                  </div>

                  <div className="agent-meta-v2">
                    <span>{formatRelativeTime(agent.lastActivity)} ago</span>
                    {agent.lastToolName && <span> · {agent.lastToolName}</span>}
                    <span> · {agent.status !== "ended" ? formatElapsed(session?.firstTs || agent.lastActivity) : formatDuration(agent.sessionDuration)}</span>
                    <span> · {agent.eventCount} events</span>
                    {session?.hasInterrupt && <span className="meta-warn"> · interrupt</span>}
                    {session && session.orphanCount > 0 && (
                      <span className="meta-caution"> · {session.orphanCount} orphan</span>
                    )}
                  </div>

                  <div className="agent-commands">
                    <button
                      className={`cmd-btn${copiedId === `resume-${agent.sessionId}` ? " copied" : ""}`}
                      onClick={() => handleCopy(`cd ${agent.cwd} && claude -r ${agent.sessionId}`, `resume-${agent.sessionId}`)}
                      title="Copy resume command"
                    >
                      {copiedId === `resume-${agent.sessionId}` ? "✓ copied" : "▸ claude -r"}
                    </button>
                    <button
                      className={`cmd-btn${copiedId === `fork-${agent.sessionId}` ? " copied" : ""}`}
                      onClick={() => handleCopy(`cd ${agent.cwd} && claude -r ${agent.sessionId} --fork-session`, `fork-${agent.sessionId}`)}
                      title="Copy fork command"
                    >
                      {copiedId === `fork-${agent.sessionId}` ? "✓ copied" : "▸ fork-session"}
                    </button>
                  </div>

                  <div className="agent-actions-v2">
                    <button
                      className="action-btn"
                      onClick={() => onOpenTmux(agent.sessionId)}
                      title="tmux"
                    >
                      tmux
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => onGenerateSummary(agent.sessionId)}
                      title="AI summary"
                    >
                      summary
                    </button>
                    <button
                      className={`action-btn${isSelected ? " active" : ""}`}
                      onClick={() => onToggleSessionFilter(agent.sessionId)}
                      title="Select for filtering"
                    >
                      {isSelected ? "✓ selected" : "select"}
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
