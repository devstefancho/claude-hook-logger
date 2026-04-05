import type { LogEvent, Summary, AgentInfo, SessionInfo } from "../types";
import type { TeamGroup } from "../hooks/useAgents";
import type { SidebarView } from "../App";
import { AgentsView } from "./AgentsView";
import { ToolsView } from "./ToolsView";
import { SkillsView } from "./SkillsView";
import { EventTimeline } from "./EventTimeline";

interface DetailPanelProps {
  activeView: SidebarView;
  agents: AgentInfo[];
  teamGroups: TeamGroup[];
  ungroupedAgents: AgentInfo[];
  sessions: SessionInfo[];
  summary: Summary;
  events: LogEvent[];
  selectedSession: string | null;
  selectedSessions: Set<string>;
  onSelectSession: (sid: string) => void;
  onFilterBySession: (sid: string) => void;
  onToggleSessionFilter: (sid: string) => void;
  onClearSessionFilter: () => void;
  highlightIdx: number | null;
  onScrollToEvent: (idx: number) => void;
  onGenerateSummary: (sid: string) => void;
  onOpenTmux: (sid: string) => void;
  onToolClick: (name: string) => void;
  onSkillClick: (name: string) => void;
  threshold: number;
  onThresholdChange: (value: number) => void;
}

export function DetailPanel({
  activeView,
  agents,
  teamGroups,
  ungroupedAgents,
  sessions,
  summary,
  events,
  selectedSession,
  selectedSessions,
  onSelectSession,
  onFilterBySession,
  onToggleSessionFilter,
  onClearSessionFilter,
  highlightIdx,
  onGenerateSummary,
  onOpenTmux,
  onToolClick,
  onSkillClick,
  threshold,
  onThresholdChange,
}: DetailPanelProps) {
  return (
    <main className="detail-panel">
      {activeView === "agents" && (
        <AgentsView
          agents={agents}
          teamGroups={teamGroups}
          ungroupedAgents={ungroupedAgents}
          sessions={sessions}
          selectedSessions={selectedSessions}
          onSelectSession={onSelectSession}
          onToggleSessionFilter={onToggleSessionFilter}
          onFilterBySession={onFilterBySession}
          onClearSessionFilter={onClearSessionFilter}
          onGenerateSummary={onGenerateSummary}
          onOpenTmux={onOpenTmux}
          threshold={threshold}
          onThresholdChange={onThresholdChange}
        />
      )}
      {activeView === "tools" && (
        <ToolsView tools={summary.toolUsage} onToolClick={onToolClick} />
      )}
      {activeView === "skills" && (
        <SkillsView skills={summary.skillUsage} onSkillClick={onSkillClick} />
      )}
      {activeView === "events" && (
        <EventTimeline
          events={events}
          summary={summary}
          selectedSession={selectedSession}
          selectedSessions={selectedSessions}
          onFilterBySession={onFilterBySession}
          onClearSessionFilter={onClearSessionFilter}
          highlightIdx={highlightIdx}
        />
      )}
    </main>
  );
}
