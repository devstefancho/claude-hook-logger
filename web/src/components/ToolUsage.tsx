import type { ToolUsageEntry } from "../types";

interface ToolUsageProps {
  tools: ToolUsageEntry[];
}

export function ToolUsage({ tools }: ToolUsageProps) {
  if (!tools.length) {
    return <div className="empty-state">No tool usage data</div>;
  }

  const max = tools[0].count;

  return (
    <>
      {tools.map((t) => (
        <div key={t.name} className="tool-row">
          <div
            className="bar-fill green"
            style={{ width: `${((t.count / max) * 100).toFixed(1)}%` }}
          />
          <span className="name" title={t.name}>{t.name}</span>
          <span className="count">{t.count}</span>
        </div>
      ))}
    </>
  );
}
