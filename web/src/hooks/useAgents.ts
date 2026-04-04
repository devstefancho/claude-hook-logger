import { useState, useCallback, useEffect, useRef } from "react";
import type { AgentInfo } from "../types";

export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(5); // minutes
  const [actionStatus, setActionStatus] = useState<{ id: string; type: string; ok: boolean } | null>(null);
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
      setActionStatus({ id: sessionId, type: "summary", ok: true });
      const res = await fetch(`/api/agents/${sessionId}/summary`, { method: "POST" });
      if (!res.ok) {
        setActionStatus({ id: sessionId, type: "summary", ok: false });
      } else {
        await loadAgents();
      }
    } catch {
      setActionStatus({ id: sessionId, type: "summary", ok: false });
    }
    setTimeout(() => setActionStatus(null), 2000);
  }, [loadAgents]);

  const openInTmux = useCallback(async (sessionId: string) => {
    try {
      setActionStatus({ id: sessionId, type: "tmux", ok: true });
      const res = await fetch(`/api/agents/${sessionId}/open-tmux`, { method: "POST" });
      if (!res.ok) {
        setActionStatus({ id: sessionId, type: "tmux", ok: false });
      }
    } catch {
      setActionStatus({ id: sessionId, type: "tmux", ok: false });
    }
    setTimeout(() => setActionStatus(null), 2000);
  }, []);

  // Re-fetch when threshold changes (skip initial render)
  useEffect(() => {
    if (!initialLoad.current) {
      initialLoad.current = true;
      return;
    }
    loadAgents();
  }, [loadAgents]);

  return { agents, loading, loadAgents, generateSummary, openInTmux, threshold, setThreshold, actionStatus };
}
