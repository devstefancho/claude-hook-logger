import { useState, useMemo } from "react";
import type { ToolUsageEntry } from "../types";

type SortBy = "count" | "az" | "za";

interface ToolsViewProps {
  tools: ToolUsageEntry[];
  onToolClick?: (toolName: string) => void;
}

export function ToolsView({ tools, onToolClick }: ToolsViewProps) {
  const [sortBy, setSortBy] = useState<SortBy>("count");
  const [search, setSearch] = useState("");
  const [minCount, setMinCount] = useState(1);

  const processed = useMemo(() => {
    let list = tools;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (minCount > 1) {
      list = list.filter((t) => t.count >= minCount);
    }
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "count": return b.count - a.count;
        case "az": return a.name.localeCompare(b.name);
        case "za": return b.name.localeCompare(a.name);
      }
    });
    return list;
  }, [tools, sortBy, search, minCount]);

  const max = processed.length > 0 ? Math.max(...processed.map((t) => t.count)) : 1;

  return (
    <div className="view-container">
      <div className="view-header">
        <div className="view-title-row">
          <h2 className="view-title">TOOLS</h2>
          <span className="view-subtitle">{tools.length} unique tools</span>
        </div>
        <div className="view-controls">
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="count">Sort: Count</option>
            <option value="az">Sort: A→Z</option>
            <option value="za">Sort: Z→A</option>
          </select>
          <select
            className="sort-select"
            value={minCount}
            onChange={(e) => setMinCount(Number(e.target.value))}
          >
            <option value={1}>Min: 1</option>
            <option value={3}>Min: 3</option>
            <option value={5}>Min: 5</option>
            <option value={10}>Min: 10</option>
          </select>
          <input
            className="view-search"
            type="text"
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="view-body">
        {!processed.length ? (
          <div className="empty-state">No tools match filters</div>
        ) : (
          processed.map((t) => (
            <div
              key={t.name}
              className={`tool-row${onToolClick ? " clickable" : ""}`}
              onClick={() => onToolClick?.(t.name)}
              title={onToolClick ? `Filter events by ${t.name}` : t.name}
            >
              <div
                className="bar-fill green"
                style={{ width: `${((t.count / max) * 100).toFixed(1)}%` }}
              />
              <span className="name">{t.name}</span>
              <span className="count">{t.count}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
