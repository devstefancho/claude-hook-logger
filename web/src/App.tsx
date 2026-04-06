import { useEffect, useState, useCallback } from "react";
import { useLogData } from "./hooks/useLogData";
import { useAutoRefresh } from "./hooks/useAutoRefresh";
import { useAgents } from "./hooks/useAgents";
import { useUrlState, useUrlSetState } from "./hooks/useUrlState";
import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { ChatPanel } from "./components/ChatPanel";
import { ActivityFeedPanel } from "./components/ActivityFeedPanel";
import { useActivityFeed } from "./hooks/useActivityFeed";

export type SidebarView = "agents" | "tools" | "skills" | "events";
export type LayoutMode = "full" | "compact" | "focus";
export type VariantType = "a" | "b" | "c";

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

  const { agents, teamGroups, ungroupedAgents, loading, loadAgents, generateSummary, openInTmux, threshold, setThreshold } = useAgents();

  const refreshAll = useCallback(async () => {
    await checkForUpdates();
    await loadAgents();
  }, [checkForUpdates, loadAgents]);

  const { enabled: autoRefresh, toggle: toggleAutoRefresh } =
    useAutoRefresh(refreshAll);

  const [activeView, setActiveView] = useUrlState<SidebarView>("view", "agents");
  const [layoutMode, setLayoutMode] = useUrlState<LayoutMode>("layout", "full");
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [selectedSessions, setSelectedSessions] = useUrlSetState("sessions", new Set());
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [viewResetKey, setViewResetKey] = useState(0);
  const [variant, setVariant] = useUrlState<VariantType>("variant", "a");
  const [feedOpen, setFeedOpen] = useState(false);
  const { items: feedItems, unreadCount: feedUnreadCount, clearUnread: clearFeedUnread } = useActivityFeed(variant === "c");

  const handleChangeView = useCallback((view: SidebarView) => {
    if (view === activeView) {
      setViewResetKey((k) => k + 1);
    }
    setActiveView(view);
  }, [activeView, setActiveView]);

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
        onChangeView={handleChangeView}
        variant={variant}
        onVariantChange={setVariant}
        feedOpen={feedOpen}
        onToggleFeed={() => {
          setFeedOpen((v) => !v);
          clearFeedUnread();
        }}
        feedUnreadCount={feedUnreadCount}
      />
      <div className="app-body">
        <Sidebar
          activeView={activeView}
          onChangeView={handleChangeView}
          summary={summary}
          agents={agents}
          layoutMode={layoutMode}
        />
        <DetailPanel
          activeView={activeView}
          agents={agents}
          teamGroups={teamGroups}
          ungroupedAgents={ungroupedAgents}
          loading={loading}
          viewResetKey={viewResetKey}
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
          variant={variant}
        />
      </div>
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
      />
      {variant === "c" && (
        <ActivityFeedPanel
          open={feedOpen}
          items={feedItems}
          onClose={() => setFeedOpen(false)}
          onScrollToAgent={(sid) => {
            // Scroll to agent card by session ID
            const el = document.querySelector(`[data-session-id="${sid}"]`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}
    </>
  );
}
