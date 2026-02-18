import { useState, useCallback } from "react";
import type { LogEvent, Summary } from "../types";

const emptySummary: Summary = {
  totalEvents: 0,
  sessionCount: 0,
  liveSessionCount: 0,
  staleSessionCount: 0,
  toolCount: 0,
  interruptCount: 0,
  orphanCount: 0,
  sessions: [],
  toolUsage: [],
  skillUsage: [],
  orphanIds: [],
};

export function useLogData() {
  const [files, setFiles] = useState<string[]>([]);
  const [currentFile, setCurrentFile] = useState("hook-events.jsonl");
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [lastEventCount, setLastEventCount] = useState(0);

  const loadFiles = useCallback(async () => {
    const res = await fetch("/api/files");
    const data = await res.json();
    setFiles(data.files || []);
    return data.files || [];
  }, []);

  const loadData = useCallback(async (file?: string) => {
    const f = file || currentFile;
    const [evRes, sumRes] = await Promise.all([
      fetch(`/api/events?file=${encodeURIComponent(f)}`),
      fetch(`/api/summary?file=${encodeURIComponent(f)}`),
    ]);
    const evData = await evRes.json();
    const sumData = await sumRes.json();
    setEvents(evData.events || []);
    setSummary(sumData);
    setLastEventCount((evData.events || []).length);
  }, [currentFile]);

  const checkForUpdates = useCallback(async () => {
    const res = await fetch(`/api/summary?file=${encodeURIComponent(currentFile)}`);
    const data = await res.json();
    if (data.totalEvents !== lastEventCount) {
      await loadData();
    }
  }, [currentFile, lastEventCount, loadData]);

  const selectFile = useCallback((file: string) => {
    setCurrentFile(file);
    loadData(file);
  }, [loadData]);

  return {
    files,
    currentFile,
    events,
    summary,
    loadFiles,
    loadData,
    checkForUpdates,
    selectFile,
  };
}
