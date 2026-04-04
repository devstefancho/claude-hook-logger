import { useState, useCallback, useEffect, useRef } from "react";
import type { AgentInfo } from "../types";

export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(5); // minutes
  const initialLoad = useRef(false);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/agents?threshold=${threshold}`);
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      // ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, [threshold]);

  const generateSummary = useCallback(async (sessionId: string) => {
    try {
      await fetch(`/api/agents/${sessionId}/summary`, { method: "POST" });
      await loadAgents();
    } catch {
      // ignore
    }
  }, [loadAgents]);

  const openInTmux = useCallback(async (sessionId: string) => {
    try {
      await fetch(`/api/agents/${sessionId}/open-tmux`, { method: "POST" });
    } catch {
      // ignore
    }
  }, []);

  // Re-fetch when threshold changes (skip initial render)
  useEffect(() => {
    if (!initialLoad.current) {
      initialLoad.current = true;
      return;
    }
    loadAgents();
  }, [loadAgents]);

  return { agents, loading, loadAgents, generateSummary, openInTmux, threshold, setThreshold };
}
