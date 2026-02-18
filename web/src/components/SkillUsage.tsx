import type { ToolUsageEntry } from "../types";

interface SkillUsageProps {
  skills: ToolUsageEntry[];
}

export function SkillUsage({ skills }: SkillUsageProps) {
  if (!skills.length) {
    return <div className="empty-state">No skill usage data</div>;
  }

  const max = skills[0].count;

  return (
    <>
      {skills.map((t) => (
        <div key={t.name} className="tool-row">
          <div
            className="bar-fill purple"
            style={{ width: `${((t.count / max) * 100).toFixed(1)}%` }}
          />
          <span className="name" title={t.name}>{t.name}</span>
          <span className="count">{t.count}</span>
        </div>
      ))}
    </>
  );
}
