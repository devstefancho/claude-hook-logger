import { useState, useCallback } from "react";
import type { AgentInfo } from "../types";

export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      // ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

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

  return { agents, loading, loadAgents, generateSummary, openInTmux };
}
