import { useState, useCallback, useRef, useMemo } from "react";
import type { LogEvent, Summary } from "../types";
import { EVENT_TYPES } from "../utils/constants";
import { EventRow } from "./EventRow";

interface EventTimelineProps {
  events: LogEvent[];
  summary: Summary;
  selectedSession: string | null;
  onFilterBySession: (sid: string) => void;
  onClearSessionFilter: () => void;
  highlightIdx: number | null;
}

export function EventTimeline({
  events,
  summary,
  selectedSession,
  onFilterBySession,
  onClearSessionFilter,
  highlightIdx,
}: EventTimelineProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(Object.keys(EVENT_TYPES)),
  );
  const [searchText, setSearchText] = useState("");
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
      })
      .reverse();
  }, [events, activeFilters, selectedSession, searchText]);

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
    onClearSessionFilter();
  }, [onClearSessionFilter]);

  return (
    <div className="panel" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div className="panel-title">Event Timeline</div>
      <div className="timeline-filters">
        <button className="filter-btn reset-btn" onClick={resetFilters}>
          Reset
        </button>
        <button className="filter-btn issues-btn" onClick={filterIssuesOnly}>
          &#9888; Issues Only
        </button>
        {Object.entries(EVENT_TYPES).map(([type, info]) => {
          if (!presentTypes.has(type)) return null;
          return (
            <span key={type}>
              <button
                className={`filter-btn${activeFilters.has(type) ? " active" : ""}`}
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
          );
        })}
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
      <div className="panel-body" ref={timelineRef} style={{ flex: 1 }}>
        {!filtered.length ? (
          <div className="empty-state">No events match current filters</div>
        ) : (
          filtered.map((ev) => {
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
          })
        )}
      </div>
    </div>
  );
}
