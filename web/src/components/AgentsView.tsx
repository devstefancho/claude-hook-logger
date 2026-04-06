import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useUrlState } from "../hooks/useUrlState";
import type { VariantType } from "../App";
import type { AgentInfo, SessionInfo, TeamInfo } from "../types";
import type { TeamGroup } from "../hooks/useAgents";
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
  waiting: 1,
  idle: 2,
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
type ViewMode = "cards" | "compact" | "teams" | "split";

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: string }[] = [
  { value: "cards", label: "Grid", icon: "▦" },
  { value: "compact", label: "List", icon: "≡" },
  { value: "teams", label: "Team", icon: "⊞" },
  { value: "split", label: "Split", icon: "◫" },
];


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

function getMemberRole(agent: AgentInfo, team: TeamInfo): string | null {
  for (const member of team.members) {
    if (member.sessionId && member.sessionId === agent.sessionId) {
      return member.name;
    }
  }
  return null;
}

interface AgentCardProps {
  agent: AgentInfo;
  session: SessionInfo | undefined;
  role: string | null;
  isSelected: boolean;
  copiedId: string | null;
  variant: VariantType;
  onCopy: (text: string, id: string) => void;
  onSelectSession: (sid: string) => void;
  onToggleSessionFilter: (sid: string) => void;
  onGenerateSummary: (sid: string) => void;
  onOpenTmux: (sid: string) => void;
}

function AgentCard({
  agent,
  session,
  role,
  isSelected,
  copiedId,
  variant,
  onCopy,
  onToggleSessionFilter,
  onGenerateSummary,
  onOpenTmux,
}: AgentCardProps) {
  const color = STATUS_COLORS[agent.status];
  const sessionColor = getSessionColor(agent.sessionId);
  const lastPrompt = agent.recentPrompts.length > 0
    ? agent.recentPrompts[agent.recentPrompts.length - 1]
    : null;
  const [toastVisible, setToastVisible] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);

  // Variant B: auto-dismiss toast for justCompleted
  useEffect(() => {
    if (variant === "b" && agent.justCompleted) {
      setToastVisible(true);
      const timer = setTimeout(() => setToastVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [variant, agent.justCompleted]);

  const variantClasses = [
    variant === "a" && agent.justCompleted ? " just-completed" : "",
    variant === "a" && agent.permissionMessage ? " permission-waiting" : "",
    variant === "c" && (agent.justCompleted || agent.permissionMessage || agent.latestUserPrompt) ? " has-indicators" : "",
  ].join("");

  return (
    <div
      className={`agent-card-v2${isSelected ? " selected" : ""} status-${agent.status}${variantClasses}`}
      style={{ "--status-color": color, "--session-color": sessionColor } as React.CSSProperties}
    >
      {/* Variant B: Permission banner (fixed top) */}
      {variant === "b" && agent.permissionMessage && (
        <div className="agent-banner-permission">
          <span>&#9888; PERMISSION NEEDED: {truncate(agent.permissionMessage, 80)}</span>
          <button className="banner-btn" onClick={() => onOpenTmux(agent.sessionId)}>Go to tmux</button>
        </div>
      )}

      {/* Variant B: Completion toast overlay */}
      {variant === "b" && toastVisible && (
        <div className="agent-toast-overlay">&#10003; COMPLETED</div>
      )}

      {/* Variant C: Dot indicators */}
      {variant === "c" && (
        <div className="agent-dot-indicators">
          {agent.justCompleted && <span className="indicator-dot indicator-stop" title="Just completed" />}
          {agent.permissionMessage && <span className="indicator-dot indicator-permission" title="Permission needed" />}
          {agent.latestUserPrompt && <span className="indicator-dot indicator-prompt" title="User prompt" />}
        </div>
      )}

      <div className="agent-card-header">
        <span className="agent-dot-v2" style={{ backgroundColor: color }} />
        <span className="agent-name-v2">
          {agent.name ? `"${agent.name}"` : agent.sessionId.slice(0, 8)}
        </span>
        {role && (
          <span className="agent-role-badge">{role}</span>
        )}
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
          onClick={() => onCopy(agent.sessionId, agent.sessionId)}
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
          onClick={() => onCopy(`cd ${agent.cwd} && claude -r ${agent.sessionId}`, `resume-${agent.sessionId}`)}
          title="Copy resume command"
        >
          {copiedId === `resume-${agent.sessionId}` ? "✓ copied" : "▸ claude -r"}
        </button>
        <button
          className={`cmd-btn${copiedId === `fork-${agent.sessionId}` ? " copied" : ""}`}
          onClick={() => onCopy(`cd ${agent.cwd} && claude -r ${agent.sessionId} --fork-session`, `fork-${agent.sessionId}`)}
          title="Copy fork command"
        >
          {copiedId === `fork-${agent.sessionId}` ? "✓ copied" : "▸ fork-session"}
        </button>
      </div>

      {/* Variant A: Inline banners */}
      {variant === "a" && agent.justCompleted && (
        <div className="agent-completion-banner">&#10003; COMPLETED</div>
      )}
      {variant === "a" && agent.permissionMessage && (
        <div className="agent-permission-banner">&#9888; PERMISSION NEEDED: {truncate(agent.permissionMessage, 80)}</div>
      )}
      {variant === "a" && agent.latestUserPrompt && (
        <div className="agent-user-prompt">USER&gt; {truncate(agent.latestUserPrompt, 100)}</div>
      )}

      {/* Variant B: Collapsible prompt */}
      {variant === "b" && agent.latestUserPrompt && (
        <div className="agent-prompt-toggle" onClick={() => setPromptExpanded((v) => !v)}>
          <span>{promptExpanded ? "▾" : "▸"} USER PROMPT</span>
          {promptExpanded && <div className="agent-prompt-toggle-body">{agent.latestUserPrompt}</div>}
        </div>
      )}

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
}

interface AgentsViewProps {
  agents: AgentInfo[];
  teamGroups: TeamGroup[];
  ungroupedAgents: AgentInfo[];
  sessions: SessionInfo[];
  loading: boolean;
  selectedSessions: Set<string>;
  onSelectSession: (sid: string) => void;
  onToggleSessionFilter: (sid: string) => void;
  onFilterBySession: (sid: string) => void;
  onClearSessionFilter: () => void;
  onGenerateSummary: (sid: string) => void;
  onOpenTmux: (sid: string) => void;
  viewResetKey: number;
  threshold: number;
  onThresholdChange: (value: number) => void;
  variant: VariantType;
}

// === Compact: Mini Card (Accordion collapsed state) ===
function AgentMiniCard({
  agent,
  isExpanded,
  onClick,
}: {
  agent: AgentInfo;
  isExpanded: boolean;
  onClick: () => void;
}) {
  const color = STATUS_COLORS[agent.status];

  return (
    <div
      className="agent-mini-card"
      style={{ "--status-color": color } as React.CSSProperties}
      onClick={onClick}
    >
      <span className="agent-dot-v2" style={{ backgroundColor: color, width: 8, height: 8, flexShrink: 0 }} />
      <span className="agent-name-v2" style={{ fontSize: 11, flexShrink: 0 }}>
        {agent.name ? `"${agent.name}"` : agent.sessionId.slice(0, 8)}
      </span>
      <span className="agent-mini-project">{agent.projectName}</span>
      <span className="agent-badge-v2" style={{ backgroundColor: color, fontSize: 9, padding: "1px 6px" }}>
        {STATUS_LABELS[agent.status]}
      </span>
      <span className="agent-mini-expand">{isExpanded ? "▾" : "▸"}</span>
    </div>
  );
}

// === Case 4: Team Overview Card (richer than Case 2) ===
function TeamOverviewCard({
  group,
  filteredCount,
  onClick,
}: {
  group: TeamGroup;
  filteredCount: number;
  onClick: () => void;
}) {
  const activeCount = group.agents.filter((a) => a.status === "active").length;
  const idleCount = group.agents.filter((a) => a.status === "idle").length;
  const totalEvents = group.agents.reduce((sum, a) => sum + a.eventCount, 0);
  const latestActivity = group.agents.reduce((latest, a) => {
    const t = new Date(a.lastActivity).getTime();
    return t > latest ? t : latest;
  }, 0);

  return (
    <div className="team-dashboard-card" onClick={onClick}>
      <div className="team-dashboard-card-header">
        <span className="team-dashboard-card-name">{group.team.name}</span>
        <span className="team-dashboard-card-count">
          {filteredCount}/{group.agents.length} members
        </span>
      </div>
      <div className="team-dashboard-card-dots">
        {group.agents.map((a) => (
          <span
            key={a.sessionId}
            className="team-dashboard-dot"
            style={{ backgroundColor: STATUS_COLORS[a.status] }}
            title={`${a.name || a.sessionId.slice(0, 8)} — ${STATUS_LABELS[a.status]}`}
          />
        ))}
      </div>
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
        {group.agents.map((a) => a.name || a.sessionId.slice(0, 6)).join(", ")}
      </div>
      <div className="team-dashboard-card-meta">
        <span style={{ color: "#3fb950" }}>{activeCount} active</span>
        {" / "}
        <span style={{ color: "#d29922" }}>{idleCount} idle</span>
        <span> · {totalEvents} events</span>
        {latestActivity > 0 && (
          <span className="team-dashboard-card-time">
            {" · "}last {formatRelativeTime(new Date(latestActivity).toISOString())} ago
          </span>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-pulse skeleton-line" style={{ width: "60%", height: 14 }} />
      <div className="skeleton-pulse skeleton-line" style={{ width: "80%", height: 10, marginTop: 8 }} />
      <div className="skeleton-pulse skeleton-line" style={{ width: "40%", height: 10, marginTop: 8 }} />
      <div className="skeleton-pulse skeleton-line" style={{ width: "70%", height: 10, marginTop: 8 }} />
    </div>
  );
}

function SkeletonView() {
  return (
    <div className="agents-grid">
      {Array.from({ length: 4 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function AgentsView({
  agents,
  teamGroups,
  ungroupedAgents,
  sessions,
  loading,
  selectedSessions,
  onSelectSession,
  onToggleSessionFilter,
  onFilterBySession,
  onClearSessionFilter,
  onGenerateSummary,
  onOpenTmux,
  viewResetKey,
  threshold,
  onThresholdChange,
  variant,
}: AgentsViewProps) {
  const [searchQuery, setSearchQuery] = useUrlState<string>("agentSearch", "");
  const [statusFilter, setStatusFilter] = useUrlState<StatusFilter>("status", "all");
  const [sortBy, setSortBy] = useUrlState<SortBy>("agentSort", "status");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [selectedTeam, setSelectedTeam] = useUrlState<string | null>("team", null, {
    serialize: (v) => v ?? "",
    deserialize: (v) => v || null,
  });
  const [viewMode, setViewMode] = useUrlState<ViewMode>("agentView", "teams");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [splitSelectedItem, setSplitSelectedItem] = useState<{ type: "team" | "agent"; id: string } | null>(null);
  const [, setTick] = useState(0);

  // Reset selectedTeam when sidebar re-clicks the same view
  const prevResetKey = useRef(viewResetKey);
  useEffect(() => {
    if (prevResetKey.current === viewResetKey) return;
    prevResetKey.current = viewResetKey;
    setSelectedTeam(null);
    setSplitSelectedItem(null);
  }, [viewResetKey]);

  // Escape key to go back to overview
  useEffect(() => {
    if (selectedTeam === null && splitSelectedItem === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedTeam(null);
        setSplitSelectedItem(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedTeam, splitSelectedItem]);

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

  const toggleTeamCollapse = useCallback((teamName: string) => {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamName)) next.delete(teamName);
      else next.add(teamName);
      return next;
    });
  }, []);

  const toggleExpandCard = useCallback((sessionId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  }, []);

  const sessionMap = useMemo(() => {
    const map = new Map<string, SessionInfo>();
    for (const s of sessions) map.set(s.id, s);
    return map;
  }, [sessions]);

  const filterAndSort = useCallback((list: AgentInfo[]) => {
    let result = list;
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((a) =>
        (a.name?.toLowerCase().includes(q)) ||
        a.sessionId.toLowerCase().includes(q) ||
        a.projectName.toLowerCase().includes(q) ||
        a.cwd.toLowerCase().includes(q)
      );
    }
    result = [...result].sort((a, b) => {
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
    return result;
  }, [statusFilter, searchQuery, sortBy]);

  const activeCount = agents.filter((a) => a.status === "active").length;
  const idleCount = agents.filter((a) => a.status === "idle").length;

  const hasTeams = teamGroups.length > 0;

  const cardProps = {
    copiedId,
    variant,
    onCopy: handleCopy,
    onSelectSession,
    onToggleSessionFilter,
    onGenerateSummary,
    onOpenTmux,
  };

  // Reset selectedTeam when switching view modes (skip initial mount)
  const prevViewMode = useRef(viewMode);
  useEffect(() => {
    if (prevViewMode.current === viewMode) return;
    prevViewMode.current = viewMode;
    setSelectedTeam(null);
    setSplitSelectedItem(null);
    setExpandedCards(new Set());
  }, [viewMode]);

  // === Render helpers for each case ===

  const renderFilterActions = () => {
    if (selectedSessions.size === 0) return null;
    return (
      <div className="agents-filter-actions">
        <span className="filter-count">{selectedSessions.size} selected</span>
        <button
          className="action-btn active"
          onClick={() => onFilterBySession(Array.from(selectedSessions)[0])}
        >
          View Events
        </button>
        <button className="action-btn" onClick={onClearSessionFilter}>
          Clear
        </button>
      </div>
    );
  };

  const renderAgentCard = (agent: AgentInfo, team?: TeamInfo) => (
    <AgentCard
      key={agent.sessionId}
      agent={agent}
      session={sessionMap.get(agent.sessionId)}
      role={team ? getMemberRole(agent, team) : null}
      isSelected={selectedSessions.has(agent.sessionId)}
      {...cardProps}
    />
  );

  // === Original: team-group collapsible + agents-grid ===
  const renderOriginal = () => {
    if (!agents.length) return loading ? <SkeletonView /> : <div className="empty-state">No agents found</div>;
    return (
      <>
        {renderFilterActions()}
        {hasTeams ? (
          <>
            {teamGroups.map((group) => {
              const filteredAgents = filterAndSort(group.agents);
              if (filteredAgents.length === 0) return null;
              const isCollapsed = collapsedTeams.has(group.team.name);
              return (
                <div className="team-group" key={group.team.name}>
                  <div
                    className="team-group-header"
                    onClick={() => toggleTeamCollapse(group.team.name)}
                  >
                    <span className="team-collapse-icon">{isCollapsed ? "▸" : "▾"}</span>
                    <span className="team-group-name">{group.team.name}</span>
                    <span className="team-group-count">{filteredAgents.length} sessions</span>
                  </div>
                  {!isCollapsed && (
                    <div className="agents-grid">
                      {filteredAgents.map((agent) => renderAgentCard(agent, group.team))}
                    </div>
                  )}
                </div>
              );
            })}
            {(() => {
              const filteredUngrouped = filterAndSort(ungroupedAgents);
              if (filteredUngrouped.length === 0) return null;
              const isCollapsed = collapsedTeams.has("__ungrouped__");
              return (
                <div className="team-group">
                  <div
                    className="team-group-header"
                    onClick={() => toggleTeamCollapse("__ungrouped__")}
                  >
                    <span className="team-collapse-icon">{isCollapsed ? "▸" : "▾"}</span>
                    <span className="team-group-name">Ungrouped</span>
                    <span className="team-group-count">{filteredUngrouped.length} sessions</span>
                  </div>
                  {!isCollapsed && (
                    <div className="agents-grid">
                      {filteredUngrouped.map((agent) => renderAgentCard(agent))}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <div className="agents-grid">
            {filterAndSort(agents).map((agent) => renderAgentCard(agent))}
          </div>
        )}
      </>
    );
  };

  // === Compact: Accordion ===
  const renderAccordion = () => {
    if (!agents.length) return loading ? <SkeletonView /> : <div className="empty-state">No agents found</div>;

    const renderAccordionItems = (list: AgentInfo[], team?: TeamInfo) =>
      list.map((agent) => {
        const isExpanded = expandedCards.has(agent.sessionId);
        return (
          <div key={agent.sessionId} className={`agent-accordion${isExpanded ? " expanded" : ""}`}>
            <AgentMiniCard
              agent={agent}
              isExpanded={isExpanded}
              onClick={() => toggleExpandCard(agent.sessionId)}
            />
            {isExpanded && (
              <div onClick={() => toggleExpandCard(agent.sessionId)}>
                {renderAgentCard(agent, team)}
              </div>
            )}
          </div>
        );
      });

    return (
      <>
        {renderFilterActions()}
        {hasTeams ? (
          <>
            {teamGroups.map((group) => {
              const filteredAgents = filterAndSort(group.agents);
              if (filteredAgents.length === 0) return null;
              const isCollapsed = collapsedTeams.has(group.team.name);
              return (
                <div className="team-group" key={group.team.name}>
                  <div
                    className="team-group-header"
                    onClick={() => toggleTeamCollapse(group.team.name)}
                  >
                    <span className="team-collapse-icon">{isCollapsed ? "▸" : "▾"}</span>
                    <span className="team-group-name">{group.team.name}</span>
                    <span className="team-group-count">{filteredAgents.length} sessions</span>
                  </div>
                  {!isCollapsed && renderAccordionItems(filteredAgents, group.team)}
                </div>
              );
            })}
            {(() => {
              const filteredUngrouped = filterAndSort(ungroupedAgents);
              if (filteredUngrouped.length === 0) return null;
              const isCollapsed = collapsedTeams.has("__ungrouped__");
              return (
                <div className="team-group">
                  <div
                    className="team-group-header"
                    onClick={() => toggleTeamCollapse("__ungrouped__")}
                  >
                    <span className="team-collapse-icon">{isCollapsed ? "▸" : "▾"}</span>
                    <span className="team-group-name">Ungrouped</span>
                    <span className="team-group-count">{filteredUngrouped.length} sessions</span>
                  </div>
                  {!isCollapsed && renderAccordionItems(filteredUngrouped)}
                </div>
              );
            })()}
          </>
        ) : (
          renderAccordionItems(filterAndSort(agents))
        )}
      </>
    );
  };

  // === Case 4: Dashboard Overview ===
  const renderDashboardOverview = () => {
    if (!agents.length) return loading ? <SkeletonView /> : <div className="empty-state">No agents found</div>;
    return (
      <>
        {renderFilterActions()}
        {hasTeams && selectedTeam !== null ? (
          (() => {
            const group = teamGroups.find((g) => g.team.name === selectedTeam);
            if (!group) return null;
            const filteredAgents = filterAndSort(group.agents);
            return (
              <div className="team-detail-view">
                <div className="team-detail-header">
                  <button
                    className="team-detail-back"
                    onClick={() => setSelectedTeam(null)}
                  >
                    ← Back
                  </button>
                  <span className="team-detail-name">{group.team.name}</span>
                  <span className="team-detail-count">{filteredAgents.length} members</span>
                </div>
                <div className="agents-grid">
                  {filteredAgents.map((agent) => renderAgentCard(agent, group.team))}
                </div>
              </div>
            );
          })()
        ) : hasTeams ? (
          <>
            <div className="team-dashboard-grid">
              {teamGroups.map((group) => {
                const filteredAgents = filterAndSort(group.agents);
                if (filteredAgents.length === 0) return null;
                return (
                  <TeamOverviewCard
                    key={group.team.name}
                    group={group}
                    filteredCount={filteredAgents.length}
                    onClick={() => setSelectedTeam(group.team.name)}
                  />
                );
              })}
            </div>
            {(() => {
              const filteredUngrouped = filterAndSort(ungroupedAgents);
              if (filteredUngrouped.length === 0) return null;
              return (
                <div className="team-group">
                  <div className="team-group-header" onClick={() => toggleTeamCollapse("__ungrouped__")}>
                    <span className="team-collapse-icon">{collapsedTeams.has("__ungrouped__") ? "▸" : "▾"}</span>
                    <span className="team-group-name">Ungrouped</span>
                    <span className="team-group-count">{filteredUngrouped.length} sessions</span>
                  </div>
                  {!collapsedTeams.has("__ungrouped__") && (
                    <div className="agents-grid">
                      {filteredUngrouped.map((agent) => renderAgentCard(agent))}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        ) : (
          <div className="agents-grid">
            {filterAndSort(agents).map((agent) => renderAgentCard(agent))}
          </div>
        )}
      </>
    );
  };

  // === Case 5: Split Panel ===
  const renderSplitPanel = () => {
    if (!agents.length) return loading ? <SkeletonView /> : <div className="empty-state">No agents found</div>;

    const renderLeftPanel = () => (
      <div className="agents-list-panel">
        {hasTeams && teamGroups.map((group) => {
          const filteredAgents = filterAndSort(group.agents);
          if (filteredAgents.length === 0) return null;
          const isCollapsed = collapsedTeams.has(group.team.name);
          const isTeamSelected = splitSelectedItem?.type === "team" && splitSelectedItem.id === group.team.name;
          return (
            <div className="agents-list-tree" key={group.team.name}>
              <div
                className={`agents-list-team${isTeamSelected ? " active" : ""}`}
                onClick={() => {
                  setSplitSelectedItem({ type: "team", id: group.team.name });
                  toggleTeamCollapse(group.team.name);
                }}
              >
                <span>{isCollapsed ? "▸" : "▾"}</span>
                <span className="agents-list-team-name">{group.team.name}</span>
                <span className="agents-list-team-count">{filteredAgents.length}</span>
              </div>
              {!isCollapsed && filteredAgents.map((agent) => {
                const isAgentSelected = splitSelectedItem?.type === "agent" && splitSelectedItem.id === agent.sessionId;
                return (
                  <div
                    key={agent.sessionId}
                    className={`agents-list-member${isAgentSelected ? " active" : ""}`}
                    onClick={() => setSplitSelectedItem({ type: "agent", id: agent.sessionId })}
                  >
                    <span className="agent-dot-v2" style={{ backgroundColor: STATUS_COLORS[agent.status], width: 6, height: 6 }} />
                    <span className="agents-list-member-name">
                      {agent.name || agent.sessionId.slice(0, 8)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
        {(() => {
          const filteredUngrouped = filterAndSort(ungroupedAgents);
          if (filteredUngrouped.length === 0 && !hasTeams) {
            // No teams at all — show flat list
            return filterAndSort(agents).map((agent) => {
              const isAgentSelected = splitSelectedItem?.type === "agent" && splitSelectedItem.id === agent.sessionId;
              return (
                <div
                  key={agent.sessionId}
                  className={`agents-list-member${isAgentSelected ? " active" : ""}`}
                  style={{ paddingLeft: 12 }}
                  onClick={() => setSplitSelectedItem({ type: "agent", id: agent.sessionId })}
                >
                  <span className="agent-dot-v2" style={{ backgroundColor: STATUS_COLORS[agent.status], width: 6, height: 6 }} />
                  <span className="agents-list-member-name">
                    {agent.name || agent.sessionId.slice(0, 8)}
                  </span>
                </div>
              );
            });
          }
          if (filteredUngrouped.length === 0) return null;
          const isCollapsed = collapsedTeams.has("__ungrouped__");
          return (
            <div className="agents-list-tree">
              <div
                className="agents-list-team"
                onClick={() => toggleTeamCollapse("__ungrouped__")}
              >
                <span>{isCollapsed ? "▸" : "▾"}</span>
                <span className="agents-list-team-name">Ungrouped</span>
                <span className="agents-list-team-count">{filteredUngrouped.length}</span>
              </div>
              {!isCollapsed && filteredUngrouped.map((agent) => {
                const isAgentSelected = splitSelectedItem?.type === "agent" && splitSelectedItem.id === agent.sessionId;
                return (
                  <div
                    key={agent.sessionId}
                    className={`agents-list-member${isAgentSelected ? " active" : ""}`}
                    onClick={() => setSplitSelectedItem({ type: "agent", id: agent.sessionId })}
                  >
                    <span className="agent-dot-v2" style={{ backgroundColor: STATUS_COLORS[agent.status], width: 6, height: 6 }} />
                    <span className="agents-list-member-name">
                      {agent.name || agent.sessionId.slice(0, 8)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    );

    const renderRightPanel = () => {
      if (!splitSelectedItem) {
        return (
          <div className="agents-detail-panel">
            <div className="agents-detail-placeholder">Select a team or agent</div>
          </div>
        );
      }
      if (splitSelectedItem.type === "team") {
        const group = teamGroups.find((g) => g.team.name === splitSelectedItem.id);
        if (!group) return <div className="agents-detail-panel"><div className="agents-detail-placeholder">Team not found</div></div>;
        const filteredAgents = filterAndSort(group.agents);
        return (
          <div className="agents-detail-panel">
            <div className="agents-detail-team-summary">
              <div className="agents-detail-team-name">{group.team.name}</div>
              <div className="agents-detail-team-desc">{group.team.description}</div>
              <div className="agents-detail-team-stats">
                <span style={{ color: "#3fb950" }}>{group.activeCount} active</span>
                {" / "}
                <span style={{ color: "#d29922" }}>{group.idleCount} idle</span>
                {" / "}
                <span>{group.agents.length} total</span>
              </div>
            </div>
            <div className="agents-grid">
              {filteredAgents.map((agent) => renderAgentCard(agent, group.team))}
            </div>
          </div>
        );
      }
      // Agent selected
      const agent = agents.find((a) => a.sessionId === splitSelectedItem.id);
      if (!agent) return <div className="agents-detail-panel"><div className="agents-detail-placeholder">Agent not found</div></div>;
      const team = teamGroups.find((g) => g.agents.some((a) => a.sessionId === agent.sessionId));
      return (
        <div className="agents-detail-panel">
          {renderAgentCard(agent, team?.team)}
        </div>
      );
    };

    return (
      <>
        {renderFilterActions()}
        <div className="agents-split-panel">
          {renderLeftPanel()}
          {renderRightPanel()}
        </div>
      </>
    );
  };

  // === Main render dispatch ===
  const renderViewBody = () => {
    switch (viewMode) {
      case "cards": return renderOriginal();
      case "compact": return renderAccordion();
      case "teams": return renderDashboardOverview();
      case "split": return renderSplitPanel();
    }
  };

  const renderViewSidebar = () => (
    <div className="toggle-sidebar">
      {VIEW_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`toggle-sidebar-btn${viewMode === opt.value ? " active" : ""}`}
          onClick={() => setViewMode(opt.value)}
          title={opt.label}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );

  const renderControls = () => (
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
  );

  return (
    <div className="view-container view-container--sidebar">
      {renderViewSidebar()}
      <div className="view-container-main">
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
          {renderControls()}
        </div>
        <div className="view-body">
          {renderViewBody()}
        </div>
      </div>
    </div>
  );
}
