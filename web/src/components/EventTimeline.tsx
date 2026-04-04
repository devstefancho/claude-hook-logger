import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { LogEvent, Summary } from "../types";
import { EVENT_TYPES } from "../utils/constants";
import { EventRow } from "./EventRow";
import { TimelineChart } from "./TimelineChart";

type SearchField = "all" | "tool" | "event" | "session" | "data";
type TimeRange = "all" | "1h" | "6h" | "24h";

const TIME_RANGE_MS: Record<TimeRange, number> = {
  all: Infinity,
  "1h": 3600000,
  "6h": 21600000,
  "24h": 86400000,
};

interface EventTimelineProps {
  events: LogEvent[];
  summary: Summary;
  selectedSession: string | null;
  selectedSessions: Set<string>;
  onFilterBySession: (sid: string) => void;
  onClearSessionFilter: () => void;
  highlightIdx: number | null;
}

export function EventTimeline({
  events,
  summary,
  selectedSession,
  selectedSessions,
  onFilterBySession,
  onClearSessionFilter,
  highlightIdx,
}: EventTimelineProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(Object.keys(EVENT_TYPES)),
  );
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [viewMode, setViewMode] = useState<"list" | "chart">("list");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
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

  // Unique sessions from agents for multi-filter UI
  const filtered = useMemo(() => {
    const now = Date.now();
    const rangeMs = TIME_RANGE_MS[timeRange];
    const result: { ev: LogEvent; idx: number }[] = [];
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!activeFilters.has(ev.event)) continue;
      // Multi-session filter
      if (selectedSessions.size > 0 && ev.session_id && !selectedSessions.has(ev.session_id)) continue;
      // Legacy single session filter (from AgentsView filter button)
      if (selectedSessions.size === 0 && selectedSession && ev.session_id !== selectedSession) continue;
      // Time range
      if (rangeMs !== Infinity) {
        const evTime = new Date(ev.ts).getTime();
        if (now - evTime > rangeMs) continue;
      }
      // Search
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        let match = false;
        switch (searchField) {
          case "tool":
            match = (ev.data?.tool_name || "").toLowerCase().includes(q);
            break;
          case "event":
            match = ev.event.toLowerCase().includes(q);
            break;
          case "session":
            match = (ev.session_id || "").toLowerCase().includes(q);
            break;
          case "data":
            match = JSON.stringify(ev.data || {}).toLowerCase().includes(q);
            break;
          default:
            match = JSON.stringify(ev).toLowerCase().includes(q);
        }
        if (!match) continue;
      }
      result.push({ ev, idx: i });
    }
    return result;
  }, [events, activeFilters, selectedSession, selectedSessions, debouncedSearch, searchField, timeRange]);

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
    setSearchField("all");
    setTimeRange("all");
    setExpandedIdx(null);
    onClearSessionFilter();
  }, [onClearSessionFilter]);

  const handleToggleExpand = useCallback((idx: number) => {
    setExpandedIdx((prev) => (prev === idx ? null : idx));
  }, []);

  const virtualizer = useVirtualizer({
    count: filteredReversed.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const { idx } = filteredReversed[index];
      return expandedIdx === idx ? 240 : 36;
    },
    overscan: 20,
  });

  // Re-measure when expandedIdx changes
  useEffect(() => {
    virtualizer.measure();
  }, [expandedIdx, virtualizer]);

  return (
    <div className="view-container">
      <div className="view-header">
        <div className="view-title-row">
          <h2 className="view-title">EVENTS</h2>
          <span className="view-subtitle">
            {filtered.length}/{events.length} shown
          </span>
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
        <select
          className="sort-select"
          value={searchField}
          onChange={(e) => setSearchField(e.target.value as SearchField)}
        >
          <option value="all">All fields</option>
          <option value="tool">Tool name</option>
          <option value="event">Event type</option>
          <option value="session">Session ID</option>
          <option value="data">Data only</option>
        </select>
        <input
          className="search-input"
          type="text"
          placeholder={`Search${searchField !== "all" ? ` (${searchField})` : ""}...`}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select
          className="sort-select"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as TimeRange)}
        >
          <option value="all">All time</option>
          <option value="1h">Last 1h</option>
          <option value="6h">Last 6h</option>
          <option value="24h">Last 24h</option>
        </select>
      </div>
      {selectedSessions.size > 0 && (
        <div className="filter-hint">
          Filtered by {selectedSessions.size} session{selectedSessions.size > 1 ? "s" : ""}{" "}
          <span className="clear-filter" onClick={onClearSessionFilter}>
            &#10005; clear
          </span>
        </div>
      )}
      {selectedSession && selectedSessions.size === 0 && (
        <div className="filter-hint">
          Filtered by session: {selectedSession.slice(0, 8)}{" "}
          <span className="clear-filter" onClick={onClearSessionFilter}>
            &#10005; clear
          </span>
        </div>
      )}
      {viewMode === "list" ? (
        <div className="view-body" ref={parentRef} style={{ flex: 1 }}>
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
                const isExpanded = expandedIdx === idx;
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
                      isExpanded={isExpanded}
                      onToggleExpand={handleToggleExpand}
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
