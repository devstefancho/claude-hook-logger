import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { query as sdkQuery } from "@anthropic-ai/claude-agent-sdk";

// Re-export everything from data.ts for backward compatibility
export {
  isBuiltinCommand,
  parseLogFile,
  isValidFilename,
  getLogFiles,
  buildSummary,
  buildChatContext,
  buildMinimalContext,
  filterEventsByTime,
  getSessionEvents,
  buildSessionDetail,
  getClaudeSessions,
  buildAgentList,
  getRecentPrompts,
  getCachedSummary,
  setCachedSummary,
  getTeams,
} from "./data.js";
export type { LogEvent, SessionInfo, ToolUsageEntry, Summary, AgentInfo, ClaudeSession, TeamInfo, TeamMember } from "./data.js";

import {
  parseLogFile,
  isValidFilename,
  getLogFiles,
  buildSummary,
  buildMinimalContext,
  getClaudeSessions,
  buildAgentList,
  getCachedSummary,
  setCachedSummary,
  getTeams,
} from "./data.js";
import { createHookLoggerMcpServer } from "./mcp-tools.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryFn = typeof sdkQuery;

function sendJson(res: http.ServerResponse, data: unknown, status = 200): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-cache",
  });
  res.end(body);
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
};

function serveStaticFile(res: http.ServerResponse, filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-cache" });
  res.end(content);
  return true;
}

export function handleChat(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  logDir: string,
  mcpServer: ReturnType<typeof createHookLoggerMcpServer>,
  queryFn: QueryFn = sdkQuery,
): void {
  let body = "";
  req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
  req.on("end", async () => {
    let message: string;
    try {
      const parsed = JSON.parse(body);
      message = parsed.message;
    } catch {
      sendJson(res, { error: "Invalid JSON body" }, 400);
      return;
    }

    if (!message) {
      sendJson(res, { error: "message is required" }, 400);
      return;
    }

    // Build minimal system prompt context with quick stats
    const events = parseLogFile(logDir, "hook-events.jsonl");
    const summary = buildSummary(events);
    const contextAppend = buildMinimalContext(summary);

    // Set up SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Only pass necessary env vars to Claude SDK (allowlist)
    const ALLOWED_ENV = new Set(["PATH", "HOME", "USER", "LANG", "TZ", "SHELL", "TERM"]);
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (ALLOWED_ENV.has(key) && value !== undefined) {
        env[key] = value;
      }
    }

    const abortController = new AbortController();
    res.on("close", () => {
      abortController.abort();
    });

    try {
      const conversation = queryFn({
        prompt: message,
        options: {
          systemPrompt: {
            type: "preset",
            preset: "claude_code",
            append: contextAppend,
          },
          abortController,
          maxTurns: 3,
          allowedTools: [
            "mcp__hook-logger__get_dashboard_summary",
            "mcp__hook-logger__list_sessions",
            "mcp__hook-logger__get_session_detail",
            "mcp__hook-logger__get_recent_activity",
            "mcp__hook-logger__get_tool_skill_usage",
            "mcp__hook-logger__search_events",
            "mcp__hook-logger__list_agents",
            "mcp__hook-logger__get_agent_detail",
          ],
          mcpServers: { "hook-logger": mcpServer },
          permissionMode: "acceptEdits",
          persistSession: false,
          env,
        },
      });

      let hasContent = false;
      for await (const msg of conversation) {
        if (msg.type === "assistant") {
          const assistantMsg = msg as { message?: { content?: Array<{ type: string; text?: string; name?: string; input?: unknown }> } };
          if (assistantMsg.message?.content) {
            for (const block of assistantMsg.message.content) {
              if (block.type === "text" && block.text) {
                hasContent = true;
                res.write(`data: ${JSON.stringify({ text: block.text })}\n\n`);
              } else if (block.type === "tool_use" && block.name) {
                // Send tool usage info to client (strip mcp__ prefix for display)
                const toolName = block.name.replace(/^mcp__hook-logger__/, "");
                res.write(`data: ${JSON.stringify({ tool_use: toolName })}\n\n`);
              }
            }
          }
        } else if (msg.type === "result") {
          const resultMsg = msg as { subtype?: string; result?: string; errors?: string[] };
          if (resultMsg.subtype === "success" && resultMsg.result && !hasContent) {
            // Only send result text if assistant message didn't already provide it
            hasContent = true;
            res.write(`data: ${JSON.stringify({ text: resultMsg.result })}\n\n`);
          } else if (resultMsg.subtype !== "success") {
            const errText = resultMsg.errors?.join(", ") || "Unknown error";
            res.write(`data: ${JSON.stringify({ text: `\nError (${resultMsg.subtype}): ${errText}` })}\n\n`);
          }
        }
      }
      if (!hasContent) {
        res.write(`data: ${JSON.stringify({ text: "Error: No response received from Claude." })}\n\n`);
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.write(`data: ${JSON.stringify({ text: `\nError: ${errorMsg}` })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  });
}

export function createServer(logDir: string, htmlPath: string, webDir?: string, queryFn?: QueryFn): http.Server {
  const mcpServer = createHookLoggerMcpServer(logDir);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    // API endpoints
    if (pathname === "/api/files") {
      return sendJson(res, { files: getLogFiles(logDir) });
    }

    if (pathname === "/api/events") {
      const file = url.searchParams.get("file") || "hook-events.jsonl";
      if (!isValidFilename(file)) return sendJson(res, { error: "Invalid filename" }, 400);
      const events = parseLogFile(logDir, file);
      return sendJson(res, { events, count: events.length });
    }

    if (pathname === "/api/summary") {
      const file = url.searchParams.get("file") || "hook-events.jsonl";
      if (!isValidFilename(file)) return sendJson(res, { error: "Invalid filename" }, 400);
      const events = parseLogFile(logDir, file);
      const summary = buildSummary(events);
      return sendJson(res, summary);
    }

    if (pathname === "/api/teams") {
      const teamsDir = path.join(process.env.HOME || "", ".claude", "teams");
      const sessionsDir = path.join(process.env.HOME || "", ".claude", "sessions");
      const teams = getTeams(teamsDir, sessionsDir);

      // Enrich: resolve unmatched members using hook event sessions
      const events = parseLogFile(logDir, "hook-events.jsonl");
      const summary = buildSummary(events);
      for (const team of teams) {
        const assignedSids = new Set(team.members.filter(m => m.sessionId).map(m => m.sessionId!));
        const unresolvedMembers = team.members
          .filter(m => !m.sessionId && m.joinedAt)
          .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

        if (unresolvedMembers.length === 0) continue;

        // Find candidate sessions: same cwd, not already assigned, not ended
        const candidateSessions = summary.sessions
          .filter(s => !assignedSids.has(s.id) && s.cwd && unresolvedMembers.some(m => m.cwd === s.cwd))
          .sort((a, b) => new Date(a.firstTs).getTime() - new Date(b.firstTs).getTime());

        for (const member of unresolvedMembers) {
          const match = candidateSessions.find(
            s => s.cwd === member.cwd && !assignedSids.has(s.id)
              && Math.abs(new Date(s.firstTs).getTime() - member.joinedAt!) < 60000
          );
          if (match) {
            member.sessionId = match.id;
            assignedSids.add(match.id);
          }
        }
      }

      return sendJson(res, { teams });
    }

    if (pathname === "/api/agents") {
      const includeEnded = url.searchParams.get("includeEnded") === "true";
      const thresholdMin = parseInt(url.searchParams.get("threshold") || "5", 10);
      const thresholdMs = thresholdMin * 60 * 1000;
      const events = parseLogFile(logDir, "hook-events.jsonl");
      const sessionsDir = path.join(process.env.HOME || "", ".claude", "sessions");
      const claudeSessions = getClaudeSessions(sessionsDir);
      const agents = buildAgentList(events, claudeSessions, { includeEnded, thresholdMs });
      for (const agent of agents) {
        agent.summary = getCachedSummary(agent.sessionId);
      }
      return sendJson(res, { agents });
    }

    // POST /api/agents/:id/summary
    const summaryMatch = pathname.match(/^\/api\/agents\/([^/]+)\/summary$/);
    if (summaryMatch && req.method === "POST") {
      const sessionId = summaryMatch[1];
      const events = parseLogFile(logDir, "hook-events.jsonl");
      const sessionsDir = path.join(process.env.HOME || "", ".claude", "sessions");
      const claudeSessions = getClaudeSessions(sessionsDir);
      const agentList = buildAgentList(events, claudeSessions, { includeEnded: true });
      const agent = agentList.find(a => a.sessionId === sessionId || a.sessionId.startsWith(sessionId));
      if (!agent) return sendJson(res, { error: "Agent not found" }, 404);

      const prompts = agent.recentPrompts;
      if (!prompts.length) return sendJson(res, { summary: "(프롬프트 없음)" });

      try {
        const promptText = prompts.map((p, i) => `${i + 1}. ${p}`).join("\n");
        const input = `최근 프롬프트:\n${promptText}`;
        const result = execSync(
          `echo ${JSON.stringify(input)} | claude --bare -p "위 프롬프트들을 보고 이 세션에서 무슨 작업을 했는지 한줄(30자 이내) 한국어로 요약해. 요약만 출력해." --model haiku --no-session-persistence`,
          { encoding: "utf-8", timeout: 30000 }
        ).trim();
        setCachedSummary(sessionId, result);
        return sendJson(res, { summary: result });
      } catch {
        return sendJson(res, { summary: "(요약 생성 실패)" });
      }
    }

    // POST /api/agents/:id/open-tmux
    const tmuxMatch = pathname.match(/^\/api\/agents\/([^/]+)\/open-tmux$/);
    if (tmuxMatch && req.method === "POST") {
      const sessionId = tmuxMatch[1];
      const sessionsDir = path.join(process.env.HOME || "", ".claude", "sessions");
      const claudeSessions = getClaudeSessions(sessionsDir);
      const session = [...claudeSessions.values()].find(s => s.sessionId === sessionId || s.sessionId.startsWith(sessionId));
      if (!session) return sendJson(res, { error: "Session not found" }, 404);

      try {
        // Build set of ancestor PIDs from agent PID up to init
        const ancestorPids = new Set<number>();
        let currentPid = session.pid;
        while (currentPid && currentPid > 1) {
          ancestorPids.add(currentPid);
          try {
            const ppid = parseInt(execSync(`ps -o ppid= -p ${currentPid}`, { encoding: "utf-8" }).trim());
            if (ppid === currentPid || ppid <= 1) break;
            currentPid = ppid;
          } catch { break; }
        }

        // Find tmux pane whose PID is in the ancestor chain
        const panes = execSync("tmux list-panes -a -F '#{pane_pid} #{session_name} #{window_index}'", { encoding: "utf-8" });
        let targetSession: string | null = null;
        let targetWindow: string | null = null;
        for (const line of panes.split("\n")) {
          const parts = line.trim().split(" ");
          if (parts.length >= 3) {
            const panePid = parseInt(parts[0]);
            if (ancestorPids.has(panePid)) {
              targetSession = parts[1];
              targetWindow = parts[2];
              break;
            }
          }
        }
        if (targetSession && targetWindow) {
          execSync(`tmux select-window -t ${targetSession}:${targetWindow}`);
          return sendJson(res, { ok: true, session: targetSession, window: targetWindow });
        }
        return sendJson(res, { error: "tmux window not found for this agent" }, 404);
      } catch (err) {
        return sendJson(res, { error: String(err) }, 500);
      }
    }

    if (pathname === "/api/chat" && req.method === "POST") {
      return handleChat(req, res, logDir, mcpServer, queryFn);
    }

    // Serve React build if webDir exists
    if (webDir && fs.existsSync(webDir)) {
      // Try exact file match for assets
      if (pathname !== "/" && pathname !== "/index.html") {
        const assetPath = path.join(webDir, pathname);
        if (serveStaticFile(res, assetPath)) return;
      }

      // SPA fallback: serve index.html for all non-API routes
      const indexPath = path.join(webDir, "index.html");
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, "utf-8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
        res.end(html);
        return;
      }
    }

    // Fallback: serve legacy index.html
    if (pathname === "/" || pathname === "/index.html") {
      const html = fs.readFileSync(htmlPath, "utf-8");
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      res.end(html);
      return;
    }

    sendJson(res, { error: "Not found" }, 404);
  });

  return server;
}
