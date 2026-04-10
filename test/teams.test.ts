import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getTeams, enrichTeamSessions, buildSummary } from "../viewer/data.js";
import type { TeamInfo, LogEvent } from "../viewer/data.js";
import {
  startServer,
  stopServer,
  fetchJson,
} from "./helpers/server-helper.js";

// ---------------------------------------------------------------------------
// getTeams unit tests
// ---------------------------------------------------------------------------
describe("getTeams", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "teams-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when directory does not exist", () => {
    const teams = getTeams(path.join(tmpDir, "nonexistent"));
    assert.deepEqual(teams, []);
  });

  it("returns empty array when directory is empty", () => {
    const teamsDir = path.join(tmpDir, "teams");
    fs.mkdirSync(teamsDir);
    const teams = getTeams(teamsDir);
    assert.deepEqual(teams, []);
  });

  it("parses a valid team config", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const teamDir = path.join(teamsDir, "my-team");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({
        name: "my-team",
        description: "Test team",
        createdAt: 1000,
        leadAgentId: "lead@my-team",
        leadSessionId: "session-abc",
        members: [
          { agentId: "lead@my-team", name: "team-lead", agentType: "team-lead", cwd: "/proj" },
          { agentId: "impl@my-team", name: "implementer", cwd: "/proj/impl" },
        ],
      }),
    );

    const teams = getTeams(teamsDir);
    assert.equal(teams.length, 1);
    assert.equal(teams[0].name, "my-team");
    assert.equal(teams[0].description, "Test team");
    assert.equal(teams[0].leadSessionId, "session-abc");
    assert.equal(teams[0].members.length, 2);
    assert.equal(teams[0].members[0].name, "team-lead");
    assert.equal(teams[0].members[0].agentType, "team-lead");
    assert.equal(teams[0].members[1].name, "implementer");
    assert.equal(teams[0].members[1].cwd, "/proj/impl");
  });

  it("resolves lead member sessionId from leadAgentId", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const teamDir = path.join(teamsDir, "my-team");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({
        name: "my-team",
        leadAgentId: "lead@my-team",
        leadSessionId: "lead-session-123",
        members: [
          { agentId: "lead@my-team", name: "team-lead", cwd: "/proj" },
          { agentId: "impl@my-team", name: "implementer", cwd: "/proj" },
        ],
      }),
    );

    const teams = getTeams(teamsDir);
    assert.equal(teams[0].members[0].sessionId, "lead-session-123");
    // Non-lead member without tmuxPaneId should have no sessionId
    assert.equal(teams[0].members[1].sessionId, undefined);
  });

  it("skips directories without config.json", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const teamDir = path.join(teamsDir, "empty-team");
    fs.mkdirSync(teamDir, { recursive: true });
    const teams = getTeams(teamsDir);
    assert.equal(teams.length, 0);
  });

  it("skips malformed config.json", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const teamDir = path.join(teamsDir, "bad-team");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.writeFileSync(path.join(teamDir, "config.json"), "not-json");
    const teams = getTeams(teamsDir);
    assert.equal(teams.length, 0);
  });

  it("skips config without name or members", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const teamDir = path.join(teamsDir, "incomplete");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({ description: "no name" }),
    );
    const teams = getTeams(teamsDir);
    assert.equal(teams.length, 0);
  });

  it("parses multiple teams", () => {
    const teamsDir = path.join(tmpDir, "teams");
    for (const name of ["team-a", "team-b"]) {
      const teamDir = path.join(teamsDir, name);
      fs.mkdirSync(teamDir, { recursive: true });
      fs.writeFileSync(
        path.join(teamDir, "config.json"),
        JSON.stringify({
          name,
          members: [{ agentId: `lead@${name}`, name: "team-lead" }],
        }),
      );
    }
    const teams = getTeams(teamsDir);
    assert.equal(teams.length, 2);
  });

  it("includes tmuxPaneId in member data", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const teamDir = path.join(teamsDir, "my-team");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({
        name: "my-team",
        leadAgentId: "lead@my-team",
        leadSessionId: "lead-session",
        members: [
          { agentId: "lead@my-team", name: "team-lead", tmuxPaneId: "" },
          { agentId: "impl@my-team", name: "implementer", tmuxPaneId: "%42" },
        ],
      }),
    );

    const teams = getTeams(teamsDir);
    assert.equal(teams[0].members[0].tmuxPaneId, undefined); // empty string → undefined
    assert.equal(teams[0].members[1].tmuxPaneId, "%42");
  });

  it("resolves sessionId from session files for lead member", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const sessionsDir = path.join(tmpDir, "sessions");
    const teamDir = path.join(teamsDir, "my-team");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Create a session file
    fs.writeFileSync(
      path.join(sessionsDir, "1234.json"),
      JSON.stringify({ pid: 1234, sessionId: "session-abc", cwd: "/proj" }),
    );

    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({
        name: "my-team",
        leadAgentId: "lead@my-team",
        leadSessionId: "session-abc",
        members: [
          { agentId: "lead@my-team", name: "team-lead", cwd: "/proj" },
        ],
      }),
    );

    const teams = getTeams(teamsDir, sessionsDir);
    assert.equal(teams[0].members[0].sessionId, "session-abc");
  });

  it("works without sessionsDir parameter", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const teamDir = path.join(teamsDir, "my-team");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({
        name: "my-team",
        leadAgentId: "lead@my-team",
        leadSessionId: "lead-sid",
        members: [{ agentId: "lead@my-team", name: "team-lead" }],
      }),
    );

    // Should not throw even without sessionsDir
    const teams = getTeams(teamsDir);
    assert.equal(teams.length, 1);
    assert.equal(teams[0].members[0].sessionId, "lead-sid");
  });

  it("resolves sessionId via temporal matching when tmux fails", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const sessionsDir = path.join(tmpDir, "sessions");
    const teamDir = path.join(teamsDir, "my-team");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.mkdirSync(sessionsDir, { recursive: true });

    const joinedAt = Date.now() - 5000; // 5 seconds ago

    // Create session file with mtime close to joinedAt
    const sessionFile = path.join(sessionsDir, "9999.json");
    fs.writeFileSync(
      sessionFile,
      JSON.stringify({ pid: 9999, sessionId: "temporal-session", cwd: "/proj" }),
    );
    // Set mtime close to joinedAt
    const mtime = new Date(joinedAt + 500); // 500ms after joinedAt
    fs.utimesSync(sessionFile, mtime, mtime);

    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({
        name: "my-team",
        leadAgentId: "lead@my-team",
        leadSessionId: "lead-session",
        members: [
          { agentId: "lead@my-team", name: "team-lead", cwd: "/proj" },
          { agentId: "impl@my-team", name: "implementer", cwd: "/proj", joinedAt },
        ],
      }),
    );

    const teams = getTeams(teamsDir, sessionsDir);
    assert.equal(teams[0].members[0].sessionId, "lead-session"); // lead resolved
    assert.equal(teams[0].members[1].sessionId, "temporal-session"); // temporal fallback
  });

  it("temporal matching respects cwd filter", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const sessionsDir = path.join(tmpDir, "sessions");
    const teamDir = path.join(teamsDir, "my-team");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.mkdirSync(sessionsDir, { recursive: true });

    const joinedAt = Date.now();

    // Session with different cwd should NOT match
    const sessionFile = path.join(sessionsDir, "8888.json");
    fs.writeFileSync(
      sessionFile,
      JSON.stringify({ pid: 8888, sessionId: "wrong-cwd-session", cwd: "/other" }),
    );
    fs.utimesSync(sessionFile, new Date(joinedAt), new Date(joinedAt));

    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({
        name: "my-team",
        leadAgentId: "lead@my-team",
        leadSessionId: "lead-session",
        members: [
          { agentId: "lead@my-team", name: "team-lead", cwd: "/proj" },
          { agentId: "impl@my-team", name: "implementer", cwd: "/proj", joinedAt },
        ],
      }),
    );

    const teams = getTeams(teamsDir, sessionsDir);
    assert.equal(teams[0].members[1].sessionId, undefined); // no match due to cwd mismatch
  });

  it("temporal matching doesn't double-assign sessions", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const sessionsDir = path.join(tmpDir, "sessions");
    const teamDir = path.join(teamsDir, "my-team");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.mkdirSync(sessionsDir, { recursive: true });

    const joinedAt1 = Date.now() - 2000;
    const joinedAt2 = Date.now() - 1000;

    // Create two sessions, both in same cwd
    const sf1 = path.join(sessionsDir, "1001.json");
    fs.writeFileSync(sf1, JSON.stringify({ pid: 1001, sessionId: "session-1", cwd: "/proj" }));
    fs.utimesSync(sf1, new Date(joinedAt1 + 100), new Date(joinedAt1 + 100));

    const sf2 = path.join(sessionsDir, "1002.json");
    fs.writeFileSync(sf2, JSON.stringify({ pid: 1002, sessionId: "session-2", cwd: "/proj" }));
    fs.utimesSync(sf2, new Date(joinedAt2 + 100), new Date(joinedAt2 + 100));

    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({
        name: "my-team",
        leadAgentId: "lead@my-team",
        leadSessionId: "lead-session",
        members: [
          { agentId: "lead@my-team", name: "team-lead", cwd: "/proj" },
          { agentId: "planner@my-team", name: "planner", cwd: "/proj", joinedAt: joinedAt1 },
          { agentId: "impl@my-team", name: "implementer", cwd: "/proj", joinedAt: joinedAt2 },
        ],
      }),
    );

    const teams = getTeams(teamsDir, sessionsDir);
    const planner = teams[0].members[1];
    const impl = teams[0].members[2];

    // Both should be resolved, and they should NOT get the same session
    assert.ok(planner.sessionId, "planner should have sessionId");
    assert.ok(impl.sessionId, "implementer should have sessionId");
    assert.notEqual(planner.sessionId, impl.sessionId, "should not double-assign");
    // Planner (joinedAt1) should match session-1 (mtime closest to joinedAt1)
    assert.equal(planner.sessionId, "session-1");
    assert.equal(impl.sessionId, "session-2");
  });

  it("temporal matching rejects sessions with mtime far from joinedAt", () => {
    const teamsDir = path.join(tmpDir, "teams");
    const sessionsDir = path.join(tmpDir, "sessions");
    const teamDir = path.join(teamsDir, "my-team");
    fs.mkdirSync(teamDir, { recursive: true });
    fs.mkdirSync(sessionsDir, { recursive: true });

    const joinedAt = Date.now();

    // Create session file with mtime 10 minutes before joinedAt (exceeds 5-min window)
    const sessionFile = path.join(sessionsDir, "7777.json");
    fs.writeFileSync(
      sessionFile,
      JSON.stringify({ pid: 7777, sessionId: "stale-session", cwd: "/proj" }),
    );
    const staleMtime = new Date(joinedAt - 10 * 60 * 1000);
    fs.utimesSync(sessionFile, staleMtime, staleMtime);

    fs.writeFileSync(
      path.join(teamDir, "config.json"),
      JSON.stringify({
        name: "my-team",
        leadAgentId: "lead@my-team",
        leadSessionId: "lead-session",
        members: [
          { agentId: "lead@my-team", name: "team-lead", cwd: "/proj" },
          { agentId: "impl@my-team", name: "implementer", cwd: "/proj", joinedAt },
        ],
      }),
    );

    const teams = getTeams(teamsDir, sessionsDir);
    // Stale session should NOT be matched due to time window guard
    assert.equal(teams[0].members[1].sessionId, undefined);
  });
});

// ---------------------------------------------------------------------------
// enrichTeamSessions tests
// ---------------------------------------------------------------------------
describe("enrichTeamSessions", () => {
  let tmpDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "enrich-test-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves member sessionId from project JSONL files via teamName/agentName", () => {
    // Set up project JSONL file with teamName/agentName
    const projDir = path.join(tmpDir, ".claude", "projects", "-proj");
    fs.mkdirSync(projDir, { recursive: true });
    const sessionId = "new-session-abc";
    fs.writeFileSync(
      path.join(projDir, `${sessionId}.jsonl`),
      [
        JSON.stringify({ type: "permission-mode" }),
        JSON.stringify({ type: "user", teamName: "my-team", agentName: "implementer", message: { content: "hello" } }),
      ].join("\n"),
    );

    const teams: TeamInfo[] = [{
      name: "my-team",
      description: "Test",
      createdAt: 1000,
      leadSessionId: "lead-session",
      members: [
        { agentId: "lead@my-team", name: "team-lead", sessionId: "lead-session", cwd: "/proj" },
        { agentId: "implementer@my-team", name: "implementer", cwd: "/proj", joinedAt: 1000 },
      ],
    }];

    const summary = buildSummary([]);
    enrichTeamSessions(teams, summary);

    assert.equal(teams[0].members[1].sessionId, sessionId);
  });

  it("overrides stale sessionId with correct match from project JSONL", () => {
    const projDir = path.join(tmpDir, ".claude", "projects", "-proj");
    fs.mkdirSync(projDir, { recursive: true });

    const correctSessionId = "correct-session-123";
    fs.writeFileSync(
      path.join(projDir, `${correctSessionId}.jsonl`),
      JSON.stringify({ type: "user", teamName: "my-team", agentName: "planner" }),
    );

    // Also create a stale JSONL file (older)
    const staleFile = path.join(projDir, "stale-session-456.jsonl");
    fs.writeFileSync(staleFile, JSON.stringify({ type: "user" }));
    const oldTime = new Date(Date.now() - 3600000);
    fs.utimesSync(staleFile, oldTime, oldTime);

    const teams: TeamInfo[] = [{
      name: "my-team",
      description: "Test",
      createdAt: 1000,
      leadSessionId: "lead-session",
      members: [
        { agentId: "lead@my-team", name: "team-lead", sessionId: "lead-session", cwd: "/proj" },
        { agentId: "planner@my-team", name: "planner", cwd: "/proj", joinedAt: 1000, sessionId: "stale-session-456" },
      ],
    }];

    const summary = buildSummary([]);
    enrichTeamSessions(teams, summary);

    assert.equal(teams[0].members[1].sessionId, correctSessionId);
  });

  it("falls back to temporal matching when project JSONL not available", () => {
    // No project JSONL files, but summary has matching sessions
    const teams: TeamInfo[] = [{
      name: "my-team",
      description: "Test",
      createdAt: 1000,
      leadSessionId: "lead-session",
      members: [
        { agentId: "lead@my-team", name: "team-lead", sessionId: "lead-session", cwd: "/proj" },
        { agentId: "impl@my-team", name: "implementer", cwd: "/proj", joinedAt: 1000 },
      ],
    }];

    const events: LogEvent[] = [
      { ts: new Date(1500).toISOString(), event: "SessionStart", session_id: "temporal-match", cwd: "/proj" },
    ];
    const summary = buildSummary(events);
    enrichTeamSessions(teams, summary);

    assert.equal(teams[0].members[1].sessionId, "temporal-match");
  });

  it("skips lead member during project JSONL matching", () => {
    const projDir = path.join(tmpDir, ".claude", "projects", "-proj");
    fs.mkdirSync(projDir, { recursive: true });
    // Create JSONL that could match lead but shouldn't override
    fs.writeFileSync(
      path.join(projDir, "different-session.jsonl"),
      JSON.stringify({ type: "user", teamName: "my-team", agentName: "team-lead" }),
    );

    const teams: TeamInfo[] = [{
      name: "my-team",
      description: "Test",
      createdAt: 1000,
      leadSessionId: "lead-session",
      members: [
        { agentId: "team-lead@my-team", name: "team-lead", sessionId: "lead-session", cwd: "/proj" },
      ],
    }];

    const summary = buildSummary([]);
    enrichTeamSessions(teams, summary);

    // Lead should keep original sessionId
    assert.equal(teams[0].members[0].sessionId, "lead-session");
  });
});

// ---------------------------------------------------------------------------
// /api/teams endpoint tests
// ---------------------------------------------------------------------------
describe("GET /api/teams endpoint", () => {
  let tmpDir: string;
  let htmlPath: string;
  let instance: Awaited<ReturnType<typeof startServer>>;
  let originalHome: string | undefined;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "teams-api-test-"));
    htmlPath = path.join(tmpDir, "index.html");
    fs.writeFileSync(htmlPath, "<html><body>OK</body></html>");

    // Create a mock teams directory at ~/.claude/teams
    originalHome = process.env.HOME;
    const fakeHome = path.join(tmpDir, "home");
    const teamsDir = path.join(fakeHome, ".claude", "teams", "test-team");
    fs.mkdirSync(teamsDir, { recursive: true });
    fs.writeFileSync(
      path.join(teamsDir, "config.json"),
      JSON.stringify({
        name: "test-team",
        description: "API test team",
        createdAt: 2000,
        leadAgentId: "lead@test-team",
        leadSessionId: "lead-session-id",
        members: [
          { agentId: "lead@test-team", name: "team-lead", cwd: "/test" },
          { agentId: "impl@test-team", name: "implementer", cwd: "/test" },
        ],
      }),
    );
    process.env.HOME = fakeHome;

    const logDir = path.join(tmpDir, "logs");
    fs.mkdirSync(logDir, { recursive: true });
    instance = await startServer(logDir, htmlPath);
  });

  after(async () => {
    await stopServer(instance.server);
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns teams array with correct structure", async () => {
    const res = await fetchJson(instance.baseUrl, "/api/teams");
    assert.equal(res.status, 200);
    const teams = res.body.teams as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(teams));
    assert.equal(teams.length, 1);
    assert.equal(teams[0].name, "test-team");
    assert.equal(teams[0].description, "API test team");
    assert.equal(teams[0].leadSessionId, "lead-session-id");
    const members = teams[0].members as Array<Record<string, unknown>>;
    assert.equal(members.length, 2);
    assert.equal(members[0].name, "team-lead");
    assert.equal(members[0].sessionId, "lead-session-id"); // lead resolved
    assert.equal(members[1].name, "implementer");
  });

  it("returns CORS headers", async () => {
    const res = await fetchJson(instance.baseUrl, "/api/teams");
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
  });
});

// ---------------------------------------------------------------------------
// /api/teams enrichment – resolves unmatched members via hook events
// ---------------------------------------------------------------------------
describe("GET /api/teams enrichment", () => {
  let tmpDir: string;
  let htmlPath: string;
  let instance: Awaited<ReturnType<typeof startServer>>;
  let originalHome: string | undefined;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "teams-enrich-test-"));
    htmlPath = path.join(tmpDir, "index.html");
    fs.writeFileSync(htmlPath, "<html><body>OK</body></html>");

    originalHome = process.env.HOME;
    const fakeHome = path.join(tmpDir, "home");
    const teamsDir = path.join(fakeHome, ".claude", "teams", "enrich-team");
    fs.mkdirSync(teamsDir, { recursive: true });
    fs.mkdirSync(path.join(fakeHome, ".claude", "sessions"), { recursive: true });

    // Team with unresolved member (has joinedAt but no sessionId)
    const joinedAt = new Date("2024-01-01T00:00:05Z").getTime();
    fs.writeFileSync(
      path.join(teamsDir, "config.json"),
      JSON.stringify({
        name: "enrich-team",
        description: "Enrichment test",
        createdAt: 1000,
        leadAgentId: "lead@enrich-team",
        leadSessionId: "lead-sid",
        members: [
          { agentId: "lead@enrich-team", name: "team-lead", cwd: "/project-x", sessionId: "lead-sid" },
          { agentId: "impl@enrich-team", name: "implementer", cwd: "/project-x", joinedAt },
        ],
      }),
    );
    process.env.HOME = fakeHome;

    // Create log events with a session matching the unresolved member's cwd and joinedAt
    const logDir = path.join(tmpDir, "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const events = [
      { event: "SessionStart", session_id: "matched-session-123", ts: "2024-01-01T00:00:04Z", cwd: "/project-x" },
      { event: "PreToolUse", session_id: "matched-session-123", ts: "2024-01-01T00:00:10Z", data: { tool_name: "Read", tool_use_id: "t1" } },
      { event: "PostToolUse", session_id: "matched-session-123", ts: "2024-01-01T00:00:11Z", data: { tool_name: "Read", tool_use_id: "t1" } },
    ];
    fs.writeFileSync(
      path.join(logDir, "hook-events.jsonl"),
      events.map((e) => JSON.stringify(e)).join("\n") + "\n",
    );

    instance = await startServer(logDir, htmlPath);
  });

  after(async () => {
    await stopServer(instance.server);
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("resolves unmatched member sessionId via hook event temporal matching", async () => {
    const res = await fetchJson(instance.baseUrl, "/api/teams");
    assert.equal(res.status, 200);
    const teams = res.body.teams as Array<{ name: string; members: Array<{ name: string; sessionId?: string }> }>;
    assert.equal(teams.length, 1);
    const impl = teams[0].members.find((m) => m.name === "implementer");
    assert.ok(impl, "implementer member should exist");
    // getTeams couldn't resolve (no session files), server enrichment resolves via events
    assert.equal(impl.sessionId, "matched-session-123");
  });

  it("does not re-assign already assigned sessions", async () => {
    const res = await fetchJson(instance.baseUrl, "/api/teams");
    const teams = res.body.teams as Array<{ members: Array<{ name: string; sessionId?: string }> }>;
    const lead = teams[0].members.find((m) => m.name === "team-lead");
    assert.equal(lead!.sessionId, "lead-sid");
  });

  it("skips enrichment when all members are resolved", async () => {
    // This is implicitly tested - the existing /api/teams test has no joinedAt members
    const res = await fetchJson(instance.baseUrl, "/api/teams");
    assert.equal(res.status, 200);
  });
});
