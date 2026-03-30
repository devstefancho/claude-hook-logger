import { useState, useCallback, useRef, useMemo } from "react";
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
  const [viewMode, setViewMode] = useState<"list" | "chart">("list");
  const [visibleCount, setVisibleCount] = useState(200);
  const timelineRef = useRef<HTMLDivElement>(null);

  const orphanIds = useMemo(() => new Set(summary.orphanIds || []), [summary.orphanIds]);
  const presentTypes = useMemo(
    () => new Set(events.map((e) => e.event)),
    [events],
  );

  const filtered = useMemo(() => {
    return events
      .filter((ev) => {
        if (!activeFilters.has(ev.event)) return false;
        if (selectedSession && ev.session_id !== selectedSession) return false;
        if (searchText) {
          const haystack = JSON.stringify(ev).toLowerCase();
          if (!haystack.includes(searchText.toLowerCase())) return false;
        }
        return true;
      });
  }, [events, activeFilters, selectedSession, searchText]);

  const filteredReversed = useMemo(() => [...filtered].reverse(), [filtered]);
  const visibleEvents = useMemo(() => filteredReversed.slice(0, visibleCount), [filteredReversed, visibleCount]);

  const toggleFilter = useCallback((type: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
    setVisibleCount(200);
  }, []);

  const filterOnly = useCallback((type: string) => {
    setActiveFilters(new Set([type]));
    setVisibleCount(200);
  }, []);

  const filterIssuesOnly = useCallback(() => {
    setActiveFilters(new Set(["Stop", "PreToolUse"]));
    setVisibleCount(200);
  }, []);

  const resetFilters = useCallback(() => {
    setActiveFilters(new Set(Object.keys(EVENT_TYPES)));
    setSearchText("");
    setVisibleCount(200);
    onClearSessionFilter();
  }, [onClearSessionFilter]);

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
        <div className="panel-body" ref={timelineRef} style={{ flex: 1 }}>
          {!filteredReversed.length ? (
            <div className="empty-state">No events match current filters</div>
          ) : (
            <>
              {visibleEvents.map((ev) => {
                const idx = events.indexOf(ev);
                const isOrphan =
                  ev.event === "PreToolUse" &&
                  !!ev.data?.tool_use_id &&
                  orphanIds.has(ev.data.tool_use_id);
                return (
                  <EventRow
                    key={idx}
                    event={ev}
                    index={idx}
                    isOrphan={isOrphan}
                    isHighlighted={highlightIdx === idx}
                    onFilterBySession={onFilterBySession}
                  />
                );
              })}
              {visibleCount < filteredReversed.length && (
                <button
                  className="load-more-btn"
                  onClick={() => setVisibleCount((prev) => prev + 200)}
                >
                  Load more ({filteredReversed.length - visibleCount} remaining)
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <TimelineChart events={filtered} onFilterBySession={onFilterBySession} />
      )}
    </div>
  );
}
