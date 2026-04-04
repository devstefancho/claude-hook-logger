import { useEffect, useState, useCallback, useRef } from "react";
import { useLogData } from "./hooks/useLogData";
import { useAutoRefresh } from "./hooks/useAutoRefresh";
import { useAgents } from "./hooks/useAgents";
import { Header } from "./components/Header";
import { StatBar } from "./components/StatBar";
import { SessionList } from "./components/SessionList";
import { LeftTabs } from "./components/LeftTabs";
import { EventTimeline } from "./components/EventTimeline";
import { ChatPanel } from "./components/ChatPanel";

export function App() {
  const {
    files,
    currentFile,
    events,
    summary,
    loadFiles,
    loadData,
    checkForUpdates,
    selectFile,
  } = useLogData();

  const { agents, loadAgents, generateSummary, openInTmux } = useAgents();

  const refreshAll = useCallback(async () => {
    await checkForUpdates();
    await loadAgents();
  }, [checkForUpdates, loadAgents]);

  const { enabled: autoRefresh, toggle: toggleAutoRefresh } =
    useAutoRefresh(refreshAll);

  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Resize state
  const [leftWidthPercent, setLeftWidthPercent] = useState(40);
  const [sessionListHeight, setSessionListHeight] = useState(200);
  const [maximizedPanel, setMaximizedPanel] = useState<"sessions" | "leftTabs" | "timeline" | null>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const verticalDragging = useRef(false);
  const horizontalDragging = useRef(false);

  useEffect(() => {
    loadFiles().then(() => {
      loadData();
      loadAgents();
    });
  }, [loadFiles, loadData, loadAgents]);

  const handleSelectSession = useCallback((sid: string) => {
    setSelectedSession((prev) => (prev === sid ? null : sid));
  }, []);

  const handleFilterBySession = useCallback(
    (sid: string) => {
      if (!sid) return;
      setSelectedSession((prev) => (prev === sid ? null : sid));
      const el = document.getElementById(`sess-${sid.slice(0, 8)}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    },
    [],
  );

  const clearSessionFilter = useCallback(() => {
    setSelectedSession(null);
  }, []);

  const scrollToEvent = useCallback((idx: number) => {
    setHighlightIdx(idx);
    requestAnimationFrame(() => {
      const el = document.getElementById(`ev-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    setTimeout(() => setHighlightIdx(null), 2000);
  }, []);

  const toggleMaximize = useCallback(
    (panel: "sessions" | "leftTabs" | "timeline") => {
      setMaximizedPanel((prev) => (prev === panel ? null : panel));
    },
    [],
  );

  const onVerticalResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    verticalDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!verticalDragging.current || !mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const padding = 20;
      const handleWidth = 16;
      const availableWidth = rect.width - padding * 2 - handleWidth;
      const offsetX = ev.clientX - rect.left - padding;
      const pct = Math.min(70, Math.max(20, (offsetX / availableWidth) * 100));
      setLeftWidthPercent(pct);
    };

    const onMouseUp = () => {
      verticalDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  const onHorizontalResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    horizontalDragging.current = true;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!horizontalDragging.current || !leftRef.current) return;
      const rect = leftRef.current.getBoundingClientRect();
      const offsetY = ev.clientY - rect.top;
      const newHeight = Math.min(rect.height - 100, Math.max(80, offsetY));
      setSessionListHeight(newHeight);
    };

    const onMouseUp = () => {
      horizontalDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <>
      <Header
        files={files}
        currentFile={currentFile}
        onFileChange={(f) => {
          setSelectedSession(null);
          selectFile(f);
        }}
        onRefresh={() => loadData()}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={toggleAutoRefresh}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
      />
      <StatBar summary={summary} />
      <div className="main" ref={mainRef}>
        {maximizedPanel === "sessions" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <SessionList
              sessions={summary.sessions}
              selectedSession={selectedSession}
              onSelectSession={handleSelectSession}
              onClearFilter={clearSessionFilter}
              maximized
              onToggleMaximize={() => toggleMaximize("sessions")}
            />
          </div>
        ) : maximizedPanel === "leftTabs" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <LeftTabs
              summary={summary}
              events={events}
              onScrollToEvent={scrollToEvent}
              maximized
              onToggleMaximize={() => toggleMaximize("leftTabs")}
              agents={agents}
              onGenerateSummary={generateSummary}
              onOpenTmux={openInTmux}
              onSelectSession={handleSelectSession}
            />
          </div>
        ) : maximizedPanel === "timeline" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <EventTimeline
              events={events}
              summary={summary}
              selectedSession={selectedSession}
              onFilterBySession={handleFilterBySession}
              onClearSessionFilter={clearSessionFilter}
              highlightIdx={highlightIdx}
              maximized
              onToggleMaximize={() => toggleMaximize("timeline")}
            />
          </div>
        ) : (
          <>
            <div
              className="left"
              ref={leftRef}
              style={{ width: `${leftWidthPercent}%` }}
            >
              <SessionList
                sessions={summary.sessions}
                selectedSession={selectedSession}
                onSelectSession={handleSelectSession}
                onClearFilter={clearSessionFilter}
                height={sessionListHeight}
                onToggleMaximize={() => toggleMaximize("sessions")}
              />
              <div
                className="resize-handle-horizontal"
                onMouseDown={onHorizontalResizeMouseDown}
              />
              <LeftTabs
                summary={summary}
                events={events}
                onScrollToEvent={scrollToEvent}
                onToggleMaximize={() => toggleMaximize("leftTabs")}
                agents={agents}
                onGenerateSummary={generateSummary}
                onOpenTmux={openInTmux}
                onSelectSession={handleSelectSession}
              />
            </div>
            <div
              className="resize-handle-vertical"
              onMouseDown={onVerticalResizeMouseDown}
            />
            <div
              className="right"
              style={{ width: `${100 - leftWidthPercent}%` }}
            >
              <EventTimeline
                events={events}
                summary={summary}
                selectedSession={selectedSession}
                onFilterBySession={handleFilterBySession}
                onClearSessionFilter={clearSessionFilter}
                highlightIdx={highlightIdx}
                onToggleMaximize={() => toggleMaximize("timeline")}
              />
            </div>
          </>
        )}
      </div>
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </>
  );
}
