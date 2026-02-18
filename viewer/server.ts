import http from "node:http";
import fs from "node:fs";
import path from "node:path";
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
} from "./data.js";
export type { LogEvent, SessionInfo, ToolUsageEntry, Summary } from "./data.js";

import {
  parseLogFile,
  isValidFilename,
  getLogFiles,
  buildSummary,
  buildMinimalContext,
} from "./data.js";
import type { Summary } from "./data.js";
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

  const server = http.createServer((req, res) => {
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
