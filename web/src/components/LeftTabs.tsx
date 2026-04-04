import { useState } from "react";
import type { LogEvent, Summary, AgentInfo } from "../types";
import { ToolUsage } from "./ToolUsage";
import { SkillUsage } from "./SkillUsage";
import { Issues } from "./Issues";
import { AgentPanel } from "./AgentPanel";

type Tab = "agents" | "tools" | "skills" | "issues";

interface LeftTabsProps {
  summary: Summary;
  events: LogEvent[];
  onScrollToEvent: (idx: number) => void;
  maximized?: boolean;
  onToggleMaximize?: () => void;
  agents?: AgentInfo[];
  onGenerateSummary?: (sid: string) => void;
  onOpenTmux?: (sid: string) => void;
  onSelectSession?: (sid: string) => void;
}

export function LeftTabs({
  summary, events, onScrollToEvent, maximized, onToggleMaximize,
  agents, onGenerateSummary, onOpenTmux, onSelectSession,
}: LeftTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("agents");
  const orphanIds = new Set(summary.orphanIds || []);

  return (
    <div className="panel" style={{ flex: 1, minHeight: 0 }}>
      <div className="tab-bar" style={{ display: "flex", alignItems: "center" }}>
        {(["agents", "tools", "skills", "issues"] as Tab[]).map((tab) => (
          <button
            key={tab}
            className={`tab-btn${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
        {onToggleMaximize && (
          <button
            className="panel-maximize-btn"
            onClick={onToggleMaximize}
            title={maximized ? "Restore" : "Maximize"}
            style={{ marginLeft: "auto", marginRight: 8 }}
          >
            {maximized ? "\u25A3" : "\u25A1"}
          </button>
        )}
      </div>
      <div className="tab-content">
        {activeTab === "agents" && (
          <AgentPanel
            agents={agents || []}
            onSelectSession={onSelectSession || (() => {})}
            onGenerateSummary={onGenerateSummary || (() => {})}
            onOpenTmux={onOpenTmux || (() => {})}
          />
        )}
        {activeTab === "tools" && <ToolUsage tools={summary.toolUsage} />}
        {activeTab === "skills" && <SkillUsage skills={summary.skillUsage} />}
        {activeTab === "issues" && (
          <Issues
            events={events}
            orphanIds={orphanIds}
            onScrollToEvent={onScrollToEvent}
          />
        )}
      </div>
    </div>
  );
}
