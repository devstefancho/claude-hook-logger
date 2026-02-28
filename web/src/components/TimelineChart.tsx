import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { LogEvent } from "../types";
import { EVENT_TYPES } from "../utils/constants";
import { getSessionColor } from "../utils/sessionColor";

interface TimelineChartProps {
  events: LogEvent[];
  onFilterBySession: (sid: string) => void;
}

const ROW_HEIGHT = 28;
const LABEL_WIDTH = 100;
const MIN_CHART_WIDTH = 400;
const DOT_RADIUS = 5;

interface Tooltip {
  x: number;
  y: number;
  event: LogEvent;
}

function getBadgeColor(eventType: string): string {
  const colorMap: Record<string, string> = {
    PreToolUse: "#00d4ff",
    PostToolUse: "#00ff88",
    PostToolUseFailure: "#ff4444",
    UserPromptSubmit: "#ffbb33",
    Notification: "#ff8844",
    Stop: "#aaaaaa",
    SessionStart: "#ffffff",
    SessionEnd: "#888888",
    SubagentStart: "#bb66ff",
    SubagentStop: "#8844cc",
  };
  return colorMap[eventType] || "#8b949e";
}

function niceTimeInterval(rangeMs: number, targetTicks: number): number {
  const rough = rangeMs / targetTicks;
  const candidates = [
    100, 200, 500,
    1000, 2000, 5000, 10000, 15000, 30000,
    60000, 120000, 300000, 600000, 900000, 1800000,
    3600000,
  ];
  for (const c of candidates) {
    if (c >= rough) return c;
  }
  return 3600000;
}

function formatTickLabel(ms: number): string {
  if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(0)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function TimelineChart({ events, onFilterBySession }: TimelineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const { sessionRows, minTs, maxTs } = useMemo(() => {
    const sessionMap = new Map<string, LogEvent[]>();
    let minT = Infinity;
    let maxT = -Infinity;

    for (const ev of events) {
      const sid = ev.session_id || "unknown";
      const t = new Date(ev.ts).getTime();
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
      if (!sessionMap.has(sid)) sessionMap.set(sid, []);
      sessionMap.get(sid)!.push(ev);
    }

    const rows = Array.from(sessionMap.entries())
      .map(([sid, evts]) => ({
        sessionId: sid,
        events: evts.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime()),
      }))
      .sort((a, b) => {
        const aFirst = new Date(a.events[0].ts).getTime();
        const bFirst = new Date(b.events[0].ts).getTime();
        return aFirst - bFirst;
      });

    return { sessionRows: rows, minTs: minT, maxTs: maxT };
  }, [events]);

  const rangeMs = Math.max(maxTs - minTs, 1000);
  const chartContentWidth = Math.max(MIN_CHART_WIDTH, 800) * zoom;
  const svgHeight = sessionRows.length * ROW_HEIGHT + 40;

  const xScale = useCallback(
    (ts: number) => ((ts - minTs) / rangeMs) * chartContentWidth,
    [minTs, rangeMs, chartContentWidth],
  );

  const ticks = useMemo(() => {
    const interval = niceTimeInterval(rangeMs, Math.max(4, Math.floor(chartContentWidth / 120)));
    const result: number[] = [];
    const start = Math.ceil(minTs / interval) * interval;
    for (let t = start; t <= maxTs; t += interval) {
      result.push(t);
    }
    return result;
  }, [minTs, maxTs, rangeMs, chartContentWidth]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((prev) => Math.max(0.5, Math.min(10, prev * (e.deltaY < 0 ? 1.15 : 0.87))));
    }
  }, []);

  const handleDotEnter = useCallback((e: React.MouseEvent, ev: LogEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left + 10,
      y: e.clientY - rect.top - 10,
      event: ev,
    });
  }, []);

  const handleDotLeave = useCallback(() => setTooltip(null), []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  if (!events.length) {
    return <div className="empty-state">No events to chart</div>;
  }

  return (
    <div className="timeline-chart-container" ref={containerRef} onWheel={handleWheel}>
      <div className="chart-controls">
        <button className="filter-btn" onClick={() => setZoom((z) => Math.min(10, z * 1.5))}>+</button>
        <button className="filter-btn" onClick={() => setZoom((z) => Math.max(0.5, z / 1.5))}>-</button>
        <button className="filter-btn" onClick={() => setZoom(1)}>Fit</button>
        <span style={{ fontSize: 10, color: "#484f58", marginLeft: 4 }}>
          Ctrl+Wheel to zoom
        </span>
      </div>
      <div style={{ display: "flex", overflow: "auto", flex: 1 }}>
        {/* Session labels */}
        <div style={{ width: LABEL_WIDTH, flexShrink: 0, paddingTop: 30 }}>
          {sessionRows.map((row) => (
            <div
              key={row.sessionId}
              className="chart-session-label"
              style={{ height: ROW_HEIGHT, color: getSessionColor(row.sessionId) }}
              onClick={() => onFilterBySession(row.sessionId)}
              title={row.sessionId}
            >
              {row.sessionId.slice(0, 8)}
            </div>
          ))}
        </div>
        {/* Chart area */}
        <div style={{ overflow: "auto", flex: 1 }}>
          <svg width={chartContentWidth + 20} height={svgHeight} style={{ display: "block" }}>
            {/* Time axis ticks */}
            {ticks.map((t) => {
              const x = xScale(t);
              return (
                <g key={t}>
                  <line x1={x} x2={x} y1={24} y2={svgHeight} stroke="#21262d" strokeWidth={1} />
                  <text x={x} y={16} fill="#484f58" fontSize={10} textAnchor="middle">
                    {formatTickLabel(t - minTs)}
                  </text>
                </g>
              );
            })}
            {/* Session rows */}
            {sessionRows.map((row, rowIdx) => {
              const y = rowIdx * ROW_HEIGHT + 30 + ROW_HEIGHT / 2;
              const color = getSessionColor(row.sessionId);
              const firstX = xScale(new Date(row.events[0].ts).getTime());
              const lastX = xScale(new Date(row.events[row.events.length - 1].ts).getTime());

              return (
                <g key={row.sessionId}>
                  {/* Row background stripe */}
                  {rowIdx % 2 === 0 && (
                    <rect
                      x={0}
                      y={rowIdx * ROW_HEIGHT + 30}
                      width={chartContentWidth + 20}
                      height={ROW_HEIGHT}
                      fill="#161b2208"
                    />
                  )}
                  {/* Session span line */}
                  {row.events.length > 1 && (
                    <line
                      x1={firstX}
                      x2={lastX}
                      y1={y}
                      y2={y}
                      stroke={color}
                      strokeWidth={2}
                      opacity={0.3}
                    />
                  )}
                  {/* Event dots */}
                  {row.events.map((ev, evIdx) => {
                    const x = xScale(new Date(ev.ts).getTime());
                    const dotColor = getBadgeColor(ev.event);
                    return (
                      <circle
                        key={evIdx}
                        cx={x}
                        cy={y}
                        r={DOT_RADIUS}
                        fill={dotColor}
                        stroke="#0d1117"
                        strokeWidth={1}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) => handleDotEnter(e, ev)}
                        onMouseLeave={handleDotLeave}
                        onClick={() => onFilterBySession(row.sessionId)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      {/* Tooltip */}
      {tooltip && (
        <div className="chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {(EVENT_TYPES[tooltip.event.event]?.badge || tooltip.event.event)}
          </div>
          <div>{new Date(tooltip.event.ts).toLocaleTimeString()}</div>
          {tooltip.event.data?.tool_name && (
            <div style={{ color: "#c9d1d9" }}>Tool: {tooltip.event.data.tool_name}</div>
          )}
          <div style={{ color: "#484f58", fontSize: 10 }}>
            Session: {(tooltip.event.session_id || "").slice(0, 8)}
          </div>
        </div>
      )}
    </div>
  );
}
