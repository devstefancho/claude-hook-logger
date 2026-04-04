import { useEffect, useState, useCallback } from "react";
import { useLogData } from "./hooks/useLogData";
import { useAutoRefresh } from "./hooks/useAutoRefresh";
import { useAgents } from "./hooks/useAgents";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { ChatPanel } from "./components/ChatPanel";

export type SidebarView = "agents" | "tools" | "skills" | "events";
export type LayoutMode = "full" | "compact" | "focus";

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

  const { agents, loadAgents, generateSummary, openInTmux, threshold, setThreshold } = useAgents();

  const refreshAll = useCallback(async () => {
    await checkForUpdates();
    await loadAgents();
  }, [checkForUpdates, loadAgents]);

  const { enabled: autoRefresh, toggle: toggleAutoRefresh } =
    useAutoRefresh(refreshAll);

  const [activeView, setActiveView] = useState<SidebarView>("agents");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("full");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    loadFiles().then(() => {
      loadData();
      loadAgents();
    });
  }, [loadFiles, loadData, loadAgents]);

  // Keyboard shortcuts for view switching
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      const viewMap: Record<string, SidebarView> = { "1": "agents", "2": "tools", "3": "skills", "4": "events" };
      const view = viewMap[e.key];
      if (view) setActiveView(view);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSelectSession = useCallback((sid: string) => {
    setSelectedSession((prev) => (prev === sid ? null : sid));
  }, []);

  const handleFilterBySession = useCallback((_sid: string) => {
    // Just switch to events view - selectedSessions are already set
    setActiveView("events");
  }, []);

  const handleToggleSessionFilter = useCallback((sid: string) => {
    setSelectedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  }, []);

  const clearSessionFilter = useCallback(() => {
    setSelectedSession(null);
    setSelectedSessions(new Set());
  }, []);

  const handleToolClick = useCallback((toolName: string) => {
    setActiveView("events");
    // The EventTimeline will pick up the search from URL or we set it via state
    // For simplicity, we store a search hint that EventTimeline can use
    setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>(".search-input");
      if (searchInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeInputValueSetter?.call(searchInput, toolName);
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 50);
  }, []);

  const handleSkillClick = useCallback((skillName: string) => {
    setActiveView("events");
    setTimeout(() => {
      const searchInput = document.querySelector<HTMLInputElement>(".search-input");
      if (searchInput) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        nativeInputValueSetter?.call(searchInput, skillName);
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 50);
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
      <TopBar
        files={files}
        currentFile={currentFile}
        onFileChange={(f) => {
          setSelectedSession(null);
          setSelectedSessions(new Set());
          selectFile(f);
        }}
        onRefresh={() => loadData()}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={toggleAutoRefresh}
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
        layoutMode={layoutMode}
        onLayoutChange={setLayoutMode}
        activeView={activeView}
        onChangeView={setActiveView}
      />
      <div className="app-body">
        <Sidebar
          activeView={activeView}
          onChangeView={setActiveView}
          summary={summary}
          agents={agents}
          layoutMode={layoutMode}
        />
        <DetailPanel
          activeView={activeView}
          agents={agents}
          sessions={summary.sessions}
          summary={summary}
          events={events}
          selectedSession={selectedSession}
          selectedSessions={selectedSessions}
          onSelectSession={handleSelectSession}
          onFilterBySession={handleFilterBySession}
          onToggleSessionFilter={handleToggleSessionFilter}
          onClearSessionFilter={clearSessionFilter}
          highlightIdx={highlightIdx}
          onScrollToEvent={scrollToEvent}
          onGenerateSummary={generateSummary}
          onOpenTmux={openInTmux}
          onToolClick={handleToolClick}
          onSkillClick={handleSkillClick}
          threshold={threshold}
          onThresholdChange={setThreshold}
        />
      </div>
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
    </>
  );
}
