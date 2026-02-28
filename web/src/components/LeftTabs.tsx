import { useState } from "react";
import type { LogEvent, Summary } from "../types";
import { ToolUsage } from "./ToolUsage";
import { SkillUsage } from "./SkillUsage";
import { Issues } from "./Issues";

type Tab = "tools" | "skills" | "issues";

interface LeftTabsProps {
  summary: Summary;
  events: LogEvent[];
  onScrollToEvent: (idx: number) => void;
  maximized?: boolean;
  onToggleMaximize?: () => void;
}

export function LeftTabs({ summary, events, onScrollToEvent, maximized, onToggleMaximize }: LeftTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("tools");
  const orphanIds = new Set(summary.orphanIds || []);

  return (
    <div className="panel" style={{ flex: 1, minHeight: 0 }}>
      <div className="tab-bar" style={{ display: "flex", alignItems: "center" }}>
        {(["tools", "skills", "issues"] as Tab[]).map((tab) => (
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
