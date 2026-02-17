import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const PROJECT_ROOT = path.resolve(import.meta.dirname!, "..");
const TSX_BIN = path.join(PROJECT_ROOT, "node_modules", ".bin", "tsx");
const MERGE_SCRIPT = path.join(PROJECT_ROOT, "lib", "settings-merge-cli.ts");
const HOOKS_CONFIG = path.join(PROJECT_ROOT, "hooks-config.json");

describe("integration: settings-merge CLI", () => {
  let tmpDir: string;
  let settingsPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-hook-test-"));
    settingsPath = path.join(tmpDir, "settings.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function runInstall(): string {
    return execSync(
      `"${TSX_BIN}" ${MERGE_SCRIPT} install --config ${HOOKS_CONFIG} --settings ${settingsPath}`,
      { encoding: "utf-8", cwd: PROJECT_ROOT },
    );
  }

  function runUninstall(): string {
    return execSync(
      `"${TSX_BIN}" ${MERGE_SCRIPT} uninstall --settings ${settingsPath} --pattern "event-logger\\.sh"`,
      { encoding: "utf-8", cwd: PROJECT_ROOT },
    );
  }

  function readSettings(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
  }

  it("fresh install: merges hooks into empty settings", () => {
    const output = runInstall();
    assert.match(output, /hooks merged successfully/);

    const settings = readSettings();
    assert.ok(settings.hooks, "hooks key should exist");

    const hooks = settings.hooks as Record<string, unknown>;
    const expectedEvents = [
      "SessionStart", "SessionEnd", "UserPromptSubmit",
      "PreToolUse", "PostToolUse", "PostToolUseFailure",
      "Notification", "Stop", "SubagentStart", "SubagentStop",
    ];
    for (const event of expectedEvents) {
      assert.ok(hooks[event], `hooks.${event} should exist`);
      assert.ok(Array.isArray(hooks[event]), `hooks.${event} should be array`);
      const arr = hooks[event] as Array<{ hooks?: Array<{ command?: string }> }>;
      const command = arr[0]?.hooks?.[0]?.command;
      assert.match(command!, /event-logger\.sh/, `${event} should reference event-logger.sh`);
    }
  });

  it("double install: second run is idempotent (no changes)", () => {
    runInstall();
    const first = readSettings();

    const output = runUninstall();
    runInstall();
    const afterReinstall = readSettings();

    fs.rmSync(settingsPath);
    runInstall();
    const firstRun = readSettings();

    const secondOutput = runInstall();
    const secondRun = readSettings();

    assert.match(secondOutput, /already registered/);
    assert.deepStrictEqual(firstRun, secondRun);
  });

  it("uninstall: removes hooks, produces clean settings", () => {
    runInstall();
    const beforeUninstall = readSettings();
    assert.ok(beforeUninstall.hooks, "hooks should exist after install");

    const output = runUninstall();
    assert.match(output, /hooks removed successfully/);

    const afterUninstall = readSettings();
    assert.equal(afterUninstall.hooks, undefined, "hooks should be removed entirely");
  });

  it("reinstall after uninstall: produces clean state", () => {
    runInstall();
    const firstInstall = readSettings();

    runUninstall();
    runInstall();
    const reinstall = readSettings();

    assert.deepStrictEqual(reinstall, firstInstall,
      "reinstall should produce identical state to first install");
  });

  it("preserves non-hook data through install/uninstall cycle", () => {
    const existingSettings = {
      env: { ANTHROPIC_MODEL: "claude-sonnet-4-5-20250929" },
      permissions: { allow: ["Read", "Glob", "Grep"] },
      model: "claude-sonnet-4-5-20250929",
      customKey: "preserve-me",
    };
    fs.writeFileSync(settingsPath, JSON.stringify(existingSettings, null, 2));

    runInstall();
    const afterInstall = readSettings();
    assert.deepStrictEqual(afterInstall.env, existingSettings.env, "env preserved after install");
    assert.deepStrictEqual(afterInstall.permissions, existingSettings.permissions, "permissions preserved after install");
    assert.equal(afterInstall.model, existingSettings.model, "model preserved after install");
    assert.equal(afterInstall.customKey, existingSettings.customKey, "customKey preserved after install");
    assert.ok(afterInstall.hooks, "hooks added after install");

    runUninstall();
    const afterUninstall = readSettings();
    assert.deepStrictEqual(afterUninstall.env, existingSettings.env, "env preserved after uninstall");
    assert.deepStrictEqual(afterUninstall.permissions, existingSettings.permissions, "permissions preserved after uninstall");
    assert.equal(afterUninstall.model, existingSettings.model, "model preserved after uninstall");
    assert.equal(afterUninstall.customKey, existingSettings.customKey, "customKey preserved after uninstall");
    assert.equal(afterUninstall.hooks, undefined, "hooks removed after uninstall");
  });
});
