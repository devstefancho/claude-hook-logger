import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LogEvent, Summary } from "../types";
import { EVENT_TYPES } from "../utils/constants";
import { EventRow } from "./EventRow";
import { TimelineChart } from "./TimelineChart";

interface EventTimelineProps {
  events: LogEvent[];
  summary: Summary;
  selectedSession: string | null;
  onFilterBySession: (sid: string) => void;
  onClearSessionFilter: () => void;
  highlightIdx: number | null;
  maximized?: boolean;
  onToggleMaximize?: () => void;
}

export function EventTimeline({
  events,
  summary,
  selectedSession,
  onFilterBySession,
  onClearSessionFilter,
  highlightIdx,
  maximized,
  onToggleMaximize,
}: EventTimelineProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(Object.keys(EVENT_TYPES)),
  );
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "chart">("list");
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const orphanIds = useMemo(() => new Set(summary.orphanIds || []), [summary.orphanIds]);
  const presentTypes = useMemo(
    () => new Set(events.map((e) => e.event)),
    [events],
  );

  const filtered = useMemo(() => {
    const result: { ev: LogEvent; idx: number }[] = [];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!activeFilters.has(ev.event)) continue;
      if (selectedSession && ev.session_id !== selectedSession) continue;
      if (debouncedSearch) {
        const haystack = JSON.stringify(ev).toLowerCase();
        if (!haystack.includes(debouncedSearch.toLowerCase())) continue;
      }
      result.push({ ev, idx: i });
    }
    return result;
  }, [events, activeFilters, selectedSession, debouncedSearch]);

  const filteredReversed = useMemo(() => [...filtered].reverse(), [filtered]);

  const toggleFilter = useCallback((type: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const filterOnly = useCallback((type: string) => {
    setActiveFilters(new Set([type]));
  }, []);

  const filterIssuesOnly = useCallback(() => {
    setActiveFilters(new Set(["Stop", "PreToolUse"]));
  }, []);

  const resetFilters = useCallback(() => {
    setActiveFilters(new Set(Object.keys(EVENT_TYPES)));
    setSearchText("");
    setDebouncedSearch("");
    onClearSessionFilter();
  }, [onClearSessionFilter]);

  const virtualizer = useVirtualizer({
    count: filteredReversed.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 20,
  });

  return (
    <div className="panel" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="panel-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>Event Timeline</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="view-toggle">
            <button
              className={`toggle-btn${viewMode === "list" ? " active" : ""}`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
            <button
              className={`toggle-btn${viewMode === "chart" ? " active" : ""}`}
              onClick={() => setViewMode("chart")}
            >
              Chart
            </button>
          </div>
          {onToggleMaximize && (
            <button className="panel-maximize-btn" onClick={onToggleMaximize} title={maximized ? "Restore" : "Maximize"}>
              {maximized ? "\u25A3" : "\u25A1"}
            </button>
          )}
        </div>
      </div>
      <div className="timeline-filters">
        <button className="filter-btn reset-btn" onClick={resetFilters}>
          Reset
        </button>
        <button className="filter-btn issues-btn" onClick={filterIssuesOnly}>
          &#9888; Issues Only
        </button>
        {Object.entries(EVENT_TYPES).map(([type, info]) => (
          <span key={type}>
            <button
              className={`filter-btn${activeFilters.has(type) ? " active" : ""}${!presentTypes.has(type) ? " disabled" : ""}`}
              onClick={() => toggleFilter(type)}
            >
              {info.badge}
            </button>
            <button
              className="filter-only-btn"
              onClick={() => filterOnly(type)}
            >
              Only
            </button>
          </span>
        ))}
        <input
          className="search-input"
          type="text"
          placeholder="Search..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>
      {selectedSession && (
        <div className="filter-hint">
          Filtered by session: {selectedSession.slice(0, 8)}{" "}
          <span className="clear-filter" onClick={onClearSessionFilter}>
            &#10005; clear
          </span>
        </div>
      )}
      {viewMode === "list" ? (
        <div className="panel-body" ref={parentRef} style={{ flex: 1 }}>
          {!filteredReversed.length ? (
            <div className="empty-state">No events match current filters</div>
          ) : (
            <div
              style={{
                height: virtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const { ev, idx } = filteredReversed[virtualItem.index];
                const isOrphan =
                  ev.event === "PreToolUse" &&
                  !!ev.data?.tool_use_id &&
                  orphanIds.has(ev.data.tool_use_id);
                return (
                  <div
                    key={idx}
                    data-index={virtualItem.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <EventRow
                      event={ev}
                      index={idx}
                      isOrphan={isOrphan}
                      isHighlighted={highlightIdx === idx}
                      onFilterBySession={onFilterBySession}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <TimelineChart events={filtered.map(({ ev }) => ev)} onFilterBySession={onFilterBySession} />
      )}
    </div>
  );
}
