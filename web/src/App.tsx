import { useEffect, useState, useCallback } from "react";
import { useLogData } from "./hooks/useLogData";
import { useAutoRefresh } from "./hooks/useAutoRefresh";
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

  const { enabled: autoRefresh, toggle: toggleAutoRefresh } =
    useAutoRefresh(checkForUpdates);

  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    loadFiles().then(() => loadData());
  }, [loadFiles, loadData]);

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
      <div className="main">
        <div className="left">
          <SessionList
            sessions={summary.sessions}
            selectedSession={selectedSession}
            onSelectSession={handleSelectSession}
            onClearFilter={clearSessionFilter}
          />
          <LeftTabs
            summary={summary}
            events={events}
            onScrollToEvent={scrollToEvent}
          />
        </div>
        <div className="right">
          <EventTimeline
            events={events}
            summary={summary}
            selectedSession={selectedSession}
            onFilterBySession={handleFilterBySession}
            onClearSessionFilter={clearSessionFilter}
            highlightIdx={highlightIdx}
          />
        </div>
      </div>
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </>
  );
}
