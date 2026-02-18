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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
}
