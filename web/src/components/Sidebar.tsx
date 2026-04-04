import type { Summary, AgentInfo } from "../types";
import type { SidebarView, LayoutMode } from "../App";

interface SidebarProps {
  activeView: SidebarView;
  onChangeView: (view: SidebarView) => void;
  summary: Summary;
  agents: AgentInfo[];
  layoutMode: LayoutMode;
}

const NAV_ITEMS: { key: SidebarView; icon: string; label: string }[] = [
  { key: "agents", icon: "\u25CF", label: "AGENTS" },
  { key: "tools", icon: "\u2726", label: "TOOLS" },
  { key: "skills", icon: "\u26A1", label: "SKILLS" },
  { key: "events", icon: "\u2630", label: "EVENTS" },
];

export function Sidebar({ activeView, onChangeView, summary, agents, layoutMode }: SidebarProps) {
  if (layoutMode === "focus") return null;

  const isCompact = layoutMode === "compact";
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const idleAgents = agents.filter((a) => a.status === "idle").length;

  const getCounts = (key: SidebarView): string => {
    switch (key) {
      case "agents": return String(agents.length);
      case "tools": return String(summary.toolUsage.length);
      case "skills": return String(summary.skillUsage.length);
      case "events": return String(summary.totalEvents);
    }
  };

  return (
    <nav className={`sidebar${isCompact ? " compact" : ""}`}>
      <div className="sidebar-nav">
        {NAV_ITEMS.map(({ key, icon, label }) => (
          <button
            key={key}
            className={`sidebar-item${activeView === key ? " active" : ""}`}
            onClick={() => onChangeView(key)}
            title={isCompact ? label : undefined}
          >
            <span className="sidebar-icon">{icon}</span>
            {!isCompact && (
              <>
                <span className="sidebar-label">{label}</span>
                <span className="sidebar-count">{getCounts(key)}</span>
              </>
            )}
          </button>
        ))}
      </div>
      <div className="sidebar-stats">
        {isCompact ? (
          <>
            <div className="stat-mini" title={`${summary.totalEvents} events`}>
              <span className="stat-val">{summary.totalEvents}</span>
            </div>
            {summary.interruptCount > 0 && (
              <div className="stat-mini warn" title={`${summary.interruptCount} interrupts`}>
                <span className="stat-val">{summary.interruptCount}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="stat-line">
              <span className="stat-label">SESSIONS</span>
              <span className="stat-value">
                {summary.liveSessionCount > 0 && (
                  <span className="live">{summary.liveSessionCount} live</span>
                )}
                {summary.staleSessionCount > 0 && (
                  <span className="stale"> {summary.staleSessionCount} stale</span>
                )}
                {summary.liveSessionCount === 0 && summary.staleSessionCount === 0 && (
                  <span>{summary.sessionCount} total</span>
                )}
              </span>
            </div>
            <div className="stat-line">
              <span className="stat-label">AGENTS</span>
              <span className="stat-value">
                <span className="active">{activeAgents}</span>
                {" / "}
                <span className="idle">{idleAgents}</span>
              </span>
            </div>
            {(summary.interruptCount > 0 || summary.orphanCount > 0) && (
              <div className="stat-line">
                <span className="stat-label">ISSUES</span>
                <span className="stat-value warn">
                  {summary.interruptCount > 0 && `${summary.interruptCount} int`}
                  {summary.interruptCount > 0 && summary.orphanCount > 0 && " / "}
                  {summary.orphanCount > 0 && `${summary.orphanCount} orph`}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </nav>
  );
}
