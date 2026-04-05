export interface LogEvent {
  event: string;
  session_id?: string;
  ts: string;
  cwd?: string;
  permission_mode?: string;
  data?: {
    tool_name?: string;
    tool_use_id?: string;
    tool_input_summary?: string;
    stop_hook_active?: boolean;
    prompt?: string;
    success?: boolean;
    error?: string;
    message?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface SessionInfo {
  id: string;
  cwd: string;
  eventCount: number;
  firstTs: string;
  lastTs: string;
  hasInterrupt: boolean;
  orphanCount: number;
  hasSessionStart: boolean;
  hasSessionEnd: boolean;
  isLive: boolean;
  isStale: boolean;
}

export interface ToolUsageEntry {
  name: string;
  count: number;
}

export interface Summary {
  totalEvents: number;
  sessionCount: number;
  liveSessionCount: number;
  staleSessionCount: number;
  toolCount: number;
  interruptCount: number;
  orphanCount: number;
  sessions: SessionInfo[];
  toolUsage: ToolUsageEntry[];
  skillUsage: ToolUsageEntry[];
  orphanIds: string[];
}

export interface AgentInfo {
  sessionId: string;
  name: string | null;
  cwd: string;
  projectName: string;
  branch: string | null;
  status: "active" | "idle" | "waiting" | "ended";
  lastActivity: string;
  lastToolName: string | null;
  sessionDuration: number;
  eventCount: number;
  summary: string | null;
  recentPrompts: string[];
  pid: number | null;
}

export interface TeamMember {
  agentId: string;
  name: string;
  agentType?: string;
  model?: string;
  cwd?: string;
  tmuxPaneId?: string;
  sessionId?: string;
  joinedAt?: number;
}

export interface TeamInfo {
  name: string;
  description: string;
  createdAt: number;
  leadSessionId: string;
  members: TeamMember[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
}
