import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildChatContext } from "../viewer/server.js";
import type { Summary } from "../viewer/server.js";

describe("buildChatContext", () => {
  it("builds context string from summary", () => {
    const summary: Summary = {
      totalEvents: 100,
      sessionCount: 3,
      liveSessionCount: 1,
      staleSessionCount: 1,
      toolCount: 5,
      interruptCount: 2,
      orphanCount: 1,
      sessions: [
        {
          id: "abc12345-1234",
          cwd: "/project",
          eventCount: 50,
          firstTs: "2024-01-01T00:00:00Z",
          lastTs: "2024-01-01T01:00:00Z",
          hasInterrupt: false,
          orphanCount: 0,
          hasSessionStart: true,
          hasSessionEnd: false,
          isLive: true,
          isStale: false,
        },
      ],
      toolUsage: [
        { name: "Read", count: 30 },
        { name: "Write", count: 20 },
      ],
      skillUsage: [
        { name: "commit", count: 5 },
      ],
      orphanIds: ["orphan1"],
    };

    const ctx = buildChatContext(summary);
    assert.ok(ctx.includes("Total events: 100"));
    assert.ok(ctx.includes("Sessions: 3"));
    assert.ok(ctx.includes("1 live"));
    assert.ok(ctx.includes("1 stale"));
    assert.ok(ctx.includes("Read: 30"));
    assert.ok(ctx.includes("Write: 20"));
    assert.ok(ctx.includes("commit: 5"));
    assert.ok(ctx.includes("abc12345"));
    assert.ok(ctx.includes("orphan1"));
  });

  it("handles empty summary", () => {
    const summary: Summary = {
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

    const ctx = buildChatContext(summary);
    assert.ok(ctx.includes("Total events: 0"));
    assert.ok(ctx.includes("(none)"));
  });
});
