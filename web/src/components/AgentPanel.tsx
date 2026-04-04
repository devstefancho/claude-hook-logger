import type { AgentInfo } from "../types";
import { formatRelativeTime, truncate } from "../utils/format";

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

const THRESHOLD_OPTIONS = [
  { label: "5m", value: 5 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "6h", value: 360 },
  { label: "24h", value: 1440 },
];

function formatDuration(ms: number): string {
  if (ms < 60000) return "<1m";
  if (ms < 3600000) return Math.floor(ms / 60000) + "m";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface AgentPanelProps {
  agents: AgentInfo[];
  threshold: number;
  onThresholdChange: (value: number) => void;
  onSelectSession: (sid: string) => void;
  onGenerateSummary: (sid: string) => void;
  onOpenTmux: (sid: string) => void;
}

export function AgentPanel({ agents, threshold, onThresholdChange, onSelectSession, onGenerateSummary, onOpenTmux }: AgentPanelProps) {
  const activeCount = agents.filter(a => a.status === "active").length;
  const idleCount = agents.filter(a => a.status === "idle").length;

  return (
    <>
      <div className="agent-toolbar">
        <span className="agent-counts">
          <span style={{ color: "#3fb950" }}>{activeCount} active</span>
          {" / "}
          <span style={{ color: "#d29922" }}>{idleCount} idle</span>
        </span>
        <span className="agent-threshold">
          active &lt;
          <select
            value={threshold}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            className="agent-threshold-select"
          >
            {THRESHOLD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </span>
      </div>
      <div className="panel-body">
        {!agents.length ? (
          <div className="empty-state">No agents found</div>
        ) : (
          agents.map((agent) => {
            const color = STATUS_COLORS[agent.status];
            const lastPrompt = agent.recentPrompts.length > 0
              ? agent.recentPrompts[agent.recentPrompts.length - 1]
              : null;

            return (
              <div
                key={agent.sessionId}
                className={`agent-card agent-${agent.status}`}
                style={{ borderLeftColor: color, borderLeftWidth: 3, borderLeftStyle: "solid" }}
              >
                <div className="agent-header">
                  <span className="agent-dot" style={{ backgroundColor: color }} />
                  <span className="agent-name">
                    {agent.name ? `"${agent.name}"` : agent.sessionId.slice(0, 8)}
                  </span>
                  <span
                    className={`agent-status-badge agent-badge-${agent.status}`}
                    style={{ backgroundColor: color }}
                  >
                    {STATUS_LABELS[agent.status]}
                  </span>
                </div>

                <div className="agent-project">
                  {agent.projectName}
                  {agent.branch && <span className="agent-branch"> ({agent.branch})</span>}
                </div>

                {agent.summary && (
                  <div className="agent-summary">{agent.summary}</div>
                )}

                {lastPrompt && !agent.summary && (
                  <div className="agent-prompt-preview">
                    &gt; {truncate(lastPrompt, 100)}
                  </div>
                )}

                <div className="agent-meta">
                  <span>{formatRelativeTime(agent.lastActivity)} ago</span>
                  {agent.lastToolName && <span> · {agent.lastToolName}</span>}
                  <span> · {formatDuration(agent.sessionDuration)}</span>
                  <span> · {agent.eventCount} events</span>
                </div>

                <div className="agent-actions">
                  <button
                    className="agent-btn"
                    onClick={(e) => { e.stopPropagation(); onOpenTmux(agent.sessionId); }}
                    title="tmux 윈도우로 이동"
                  >
                    tmux
                  </button>
                  <button
                    className="agent-btn"
                    onClick={(e) => { e.stopPropagation(); onGenerateSummary(agent.sessionId); }}
                    title="AI 요약 생성"
                  >
                    summary
                  </button>
                  <button
                    className="agent-btn"
                    onClick={(e) => { e.stopPropagation(); onSelectSession(agent.sessionId); }}
                    title="이벤트 타임라인 필터"
                  >
                    filter
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
