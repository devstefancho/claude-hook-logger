import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { AgentInfo, TeamInfo } from "../types";

export interface TeamGroup {
  team: TeamInfo;
  agents: AgentInfo[];
  activeCount: number;
  idleCount: number;
}

export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [teams, setTeams] = useState<TeamInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(5); // minutes
  const [actionStatus, setActionStatus] = useState<{ id: string; type: string; ok: boolean } | null>(null);
  const initialLoad = useRef(false);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      const [agentsRes, teamsRes] = await Promise.all([
        fetch(`/api/agents?threshold=${threshold}`),
        fetch("/api/teams"),
      ]);
      const agentsData = await agentsRes.json();
      const teamsData = await teamsRes.json();
      setAgents(agentsData.agents || []);
      setTeams(teamsData.teams || []);
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

  // Match agents to teams by cwd
  const { teamGroups, ungroupedAgents } = useMemo(() => {
    const matched = new Set<string>();
    const groups: TeamGroup[] = [];

    for (const team of teams) {
      const teamAgents: AgentInfo[] = [];
      for (const member of team.members) {
        // Match by resolved sessionId from backend
        if (member.sessionId) {
          const agent = agents.find(
            (a) => !matched.has(a.sessionId) && a.sessionId === member.sessionId
          );
          if (agent) {
            matched.add(agent.sessionId);
            teamAgents.push(agent);
          }
        }
      }
      if (teamAgents.length > 0) {
        groups.push({
          team,
          agents: teamAgents,
          activeCount: teamAgents.filter((a) => a.status === "active").length,
          idleCount: teamAgents.filter((a) => a.status === "idle").length,
        });
      }
    }

    const ungrouped = agents.filter((a) => !matched.has(a.sessionId));
    return { teamGroups: groups, ungroupedAgents: ungrouped };
  }, [agents, teams]);

  // Re-fetch when threshold changes (skip initial render)
  useEffect(() => {
    if (!initialLoad.current) {
      initialLoad.current = true;
      return;
    }
    loadAgents();
  }, [loadAgents]);

  return {
    agents,
    teams,
    teamGroups,
    ungroupedAgents,
    loading,
    loadAgents,
    generateSummary,
    openInTmux,
    threshold,
    setThreshold,
    actionStatus,
  };
}
