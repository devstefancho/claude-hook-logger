import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { LogEvent } from "../viewer/data.js";
import { createServer } from "../viewer/server.js";
import type { QueryFn } from "../viewer/server.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "chat-handler-test-"));
}

function writeJsonl(dir: string, filename: string, events: LogEvent[]): void {
  fs.writeFileSync(
    path.join(dir, filename),
    events.map((e) => JSON.stringify(e)).join("\n") + "\n",
  );
}

function createMockQuery(generator: () => AsyncGenerator): QueryFn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (() => generator()) as any;
}

function startTestServer(
  logDir: string,
  htmlPath: string,
  queryFn: QueryFn,
): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(logDir, htmlPath, undefined, queryFn);
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, baseUrl: `http://localhost:${port}` });
    });
    server.on("error", reject);
  });
}

function stopTestServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("handleChat – streaming response", () => {
  let tmpDir: string;
  let htmlPath: string;

  before(() => {
    tmpDir = makeTmpDir();
    htmlPath = path.join(tmpDir, "index.html");
    fs.writeFileSync(htmlPath, "<html><body>OK</body></html>");

    const events: LogEvent[] = [
      { event: "SessionStart", session_id: "s1", ts: "2024-01-01T00:00:00Z", cwd: "/project" },
      { event: "SessionEnd", session_id: "s1", ts: "2024-01-01T00:01:00Z" },
    ];
    writeJsonl(tmpDir, "hook-events.jsonl", events);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("streams assistant text response via SSE", async () => {
    const mockQuery = createMockQuery(async function* () {
      yield {
        type: "assistant",
        message: { content: [{ type: "text", text: "Hello from mock!" }] },
      };
      yield { type: "result", subtype: "success", result: "" };
    });

    const { server, baseUrl } = await startTestServer(tmpDir, htmlPath, mockQuery);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test message" }),
      });

      assert.equal(res.status, 200);
      assert.ok(res.headers.get("content-type")!.includes("text/event-stream"));

      const text = await res.text();
      assert.ok(text.includes("Hello from mock!"));
      assert.ok(text.includes("[DONE]"));
    } finally {
      await stopTestServer(server);
    }
  });

  it("streams tool_use events with mcp prefix stripped", async () => {
    const mockQuery = createMockQuery(async function* () {
      yield {
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "mcp__hook-logger__get_dashboard_summary", input: {} },
            { type: "text", text: "Summary result" },
          ],
        },
      };
      yield { type: "result", subtype: "success", result: "" };
    });

    const { server, baseUrl } = await startTestServer(tmpDir, htmlPath, mockQuery);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "show summary" }),
      });

      const text = await res.text();
      assert.ok(text.includes("get_dashboard_summary"));
      assert.ok(text.includes("Summary result"));
    } finally {
      await stopTestServer(server);
    }
  });

  it("sends result text when no assistant content provided", async () => {
    const mockQuery = createMockQuery(async function* () {
      yield { type: "result", subtype: "success", result: "Fallback result text" };
    });

    const { server, baseUrl } = await startTestServer(tmpDir, htmlPath, mockQuery);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test" }),
      });

      const text = await res.text();
      assert.ok(text.includes("Fallback result text"));
    } finally {
      await stopTestServer(server);
    }
  });

  it("sends error message on non-success result", async () => {
    const mockQuery = createMockQuery(async function* () {
      yield { type: "result", subtype: "error", errors: ["Something went wrong"] };
    });

    const { server, baseUrl } = await startTestServer(tmpDir, htmlPath, mockQuery);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test" }),
      });

      const text = await res.text();
      assert.ok(text.includes("Error (error)"));
      assert.ok(text.includes("Something went wrong"));
    } finally {
      await stopTestServer(server);
    }
  });

  it("sends fallback error when no content at all", async () => {
    const mockQuery = createMockQuery(async function* () {
      yield { type: "result", subtype: "success", result: "" };
    });

    const { server, baseUrl } = await startTestServer(tmpDir, htmlPath, mockQuery);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test" }),
      });

      const text = await res.text();
      assert.ok(text.includes("No response received"));
    } finally {
      await stopTestServer(server);
    }
  });

  it("handles query() throwing an error", async () => {
    const mockQuery = createMockQuery(async function* () {
      throw new Error("API connection failed");
    });

    const { server, baseUrl } = await startTestServer(tmpDir, htmlPath, mockQuery);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test" }),
      });

      const text = await res.text();
      assert.ok(text.includes("API connection failed"));
      assert.ok(text.includes("[DONE]"));
    } finally {
      await stopTestServer(server);
    }
  });

  it("skips result text when assistant already provided content", async () => {
    const mockQuery = createMockQuery(async function* () {
      yield {
        type: "assistant",
        message: { content: [{ type: "text", text: "Primary text" }] },
      };
      yield { type: "result", subtype: "success", result: "Should be skipped" };
    });

    const { server, baseUrl } = await startTestServer(tmpDir, htmlPath, mockQuery);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test" }),
      });

      const text = await res.text();
      assert.ok(text.includes("Primary text"));
      assert.ok(!text.includes("Should be skipped"));
    } finally {
      await stopTestServer(server);
    }
  });

  it("handles non-success result with no errors array", async () => {
    const mockQuery = createMockQuery(async function* () {
      yield { type: "result", subtype: "canceled" };
    });

    const { server, baseUrl } = await startTestServer(tmpDir, htmlPath, mockQuery);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "test" }),
      });

      const text = await res.text();
      assert.ok(text.includes("Error (canceled)"));
      assert.ok(text.includes("Unknown error"));
    } finally {
      await stopTestServer(server);
    }
  });
});
