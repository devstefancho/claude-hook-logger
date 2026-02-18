import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadSettings, saveSettings, mergeHooks, removeHooksByConfig } from '../lib/settings-merge.js';
import {
  fullHooksConfig,
  minimalHooksConfig,
  allEventNames,
  settingsWithNonHookKeys,
  settingsWithStopTimeout,
  settingsWithNotificationMatchers,
  settingsWithOtherHooks,
  settingsAlreadyRegistered,
  settingsWithV2Logger,
} from './helpers/fixtures.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-merge-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── 1. loadSettings ────────────────────────────────────────────────────────

describe('loadSettings', () => {
  it('file not found → returns {}', () => {
    const result = loadSettings(path.join(tmpDir, 'nonexistent.json'));
    assert.deepStrictEqual(result, {});
  });

  it('empty file → returns {}', () => {
    const fp = path.join(tmpDir, 'empty.json');
    fs.writeFileSync(fp, '', 'utf-8');
    const result = loadSettings(fp);
    assert.deepStrictEqual(result, {});
  });

  it('whitespace-only file → returns {}', () => {
    const fp = path.join(tmpDir, 'ws.json');
    fs.writeFileSync(fp, '   \n\t  \n', 'utf-8');
    const result = loadSettings(fp);
    assert.deepStrictEqual(result, {});
  });

  it('valid JSON → parsed object', () => {
    const fp = path.join(tmpDir, 'valid.json');
    const data = { model: 'opus', env: { FOO: '1' } };
    fs.writeFileSync(fp, JSON.stringify(data), 'utf-8');
    const result = loadSettings(fp);
    assert.deepStrictEqual(result, data);
  });

  it('invalid JSON → throws Error', () => {
    const fp = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(fp, '{ broken json }}}', 'utf-8');
    assert.throws(() => loadSettings(fp), /Invalid JSON/);
  });

  it('file with no hooks key → returns as-is', () => {
    const fp = path.join(tmpDir, 'nohooks.json');
    const data = { env: { A: '1' }, model: 'sonnet' };
    fs.writeFileSync(fp, JSON.stringify(data), 'utf-8');
    const result = loadSettings(fp);
    assert.equal(result.hooks, undefined);
    assert.deepStrictEqual(result, data);
  });
});

// ─── 2. mergeHooks ──────────────────────────────────────────────────────────

describe('mergeHooks', () => {
  it('no hooks key → creates hooks + adds all events', () => {
    const result = mergeHooks({}, fullHooksConfig);
    assert.ok(result.hooks, 'should have hooks key');
    for (const ev of allEventNames) {
      assert.ok(result.hooks![ev], `should have ${ev}`);
      assert.ok(Array.isArray(result.hooks![ev]), `${ev} should be an array`);
    }
  });

  it('empty hooks {} → adds all events', () => {
    const result = mergeHooks({ hooks: {} }, fullHooksConfig);
    for (const ev of allEventNames) {
      assert.ok(result.hooks![ev], `should have ${ev}`);
    }
  });

  it('partial events (only Stop exists) → adds missing, preserves Stop', () => {
    const settings = {
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: '~/.claude/hooks/event-logger.sh', async: true }] }],
      },
    };
    const result = mergeHooks(settings, fullHooksConfig);
    assert.equal(result.hooks!.Stop.length, 1);
    assert.ok(result.hooks!.SessionStart);
    assert.ok(result.hooks!.PreToolUse);
  });

  it('already registered → no change (idempotent)', () => {
    const first = mergeHooks({}, fullHooksConfig);
    const second = mergeHooks(first, fullHooksConfig);
    assert.deepStrictEqual(second, first);
  });

  it('double install (mergeHooks twice) → second result === first', () => {
    const settings = { model: 'opus' };
    const first = mergeHooks(settings, fullHooksConfig);
    const second = mergeHooks(first, fullHooksConfig);
    assert.deepStrictEqual(JSON.stringify(second), JSON.stringify(first));
  });

  it('coexist with other hooks (SessionStart has notification-hook.sh)', () => {
    const result = mergeHooks(settingsWithOtherHooks, fullHooksConfig);
    assert.equal(result.hooks!.SessionStart.length, 2);
    assert.equal(result.hooks!.SessionStart[0].hooks[0].command, '~/.claude/hooks/notification-hook.sh');
    assert.equal(result.hooks!.SessionStart[1].hooks[0].command, '~/.claude/hooks/event-logger.sh');
  });

  it('notification matcher coexist (permission_prompt preserved + new group appended)', () => {
    const result = mergeHooks(settingsWithNotificationMatchers, fullHooksConfig);
    assert.equal(result.hooks!.Notification.length, 3);
    assert.equal(result.hooks!.Notification[0].matcher, 'permission_prompt');
    assert.equal(result.hooks!.Notification[1].matcher, 'idle_prompt');
    assert.equal(result.hooks!.Notification[2].hooks[0].command, '~/.claude/hooks/event-logger.sh');
  });

  it('async flag preservation on existing hooks', () => {
    const settings = {
      hooks: {
        SessionEnd: [
          { hooks: [{ type: 'command', command: '~/.claude/hooks/other.sh', async: true }] },
        ],
      },
    };
    const result = mergeHooks(settings, fullHooksConfig);
    assert.equal(result.hooks!.SessionEnd[0].hooks[0].async, true);
    assert.equal(result.hooks!.SessionEnd[0].hooks[0].command, '~/.claude/hooks/other.sh');
  });

  it('timeout preservation on existing hooks (Stop with stop-speak.sh timeout:15)', () => {
    const result = mergeHooks(settingsWithStopTimeout, fullHooksConfig);
    assert.equal(result.hooks!.Stop[0].hooks[0].command, '~/.claude/hooks/stop-speak.sh');
    assert.equal(result.hooks!.Stop[0].hooks[0].timeout, 15);
    assert.equal(result.hooks!.Stop[1].hooks[0].command, '~/.claude/hooks/event-logger.sh');
  });

  it('exact command pattern matching (event-logger-v2.sh !== event-logger.sh)', () => {
    const result = mergeHooks(settingsWithV2Logger, minimalHooksConfig);
    assert.equal(result.hooks!.Stop.length, 2);
    assert.equal(result.hooks!.Stop[0].hooks[0].command, '~/.claude/hooks/event-logger-v2.sh');
    assert.equal(result.hooks!.Stop[1].hooks[0].command, '~/.claude/hooks/event-logger.sh');
  });

  it('order preservation (existing hooks=[A, B] → result=[A, B, event-logger])', () => {
    const settings = {
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command: 'A.sh' }] },
          { hooks: [{ type: 'command', command: 'B.sh' }] },
        ],
      },
    };
    const result = mergeHooks(settings, minimalHooksConfig);
    assert.equal(result.hooks!.Stop.length, 3);
    assert.equal(result.hooks!.Stop[0].hooks[0].command, 'A.sh');
    assert.equal(result.hooks!.Stop[1].hooks[0].command, 'B.sh');
    assert.equal(result.hooks!.Stop[2].hooks[0].command, '~/.claude/hooks/event-logger.sh');
  });

  it('non-hook keys preserved (env, permissions, model, statusLine, enabledPlugins)', () => {
    const result = mergeHooks(settingsWithNonHookKeys, fullHooksConfig);
    assert.deepStrictEqual(result.env, settingsWithNonHookKeys.env);
    assert.deepStrictEqual(result.permissions, settingsWithNonHookKeys.permissions);
    assert.equal(result.model, 'opus');
    assert.deepStrictEqual(result.statusLine, settingsWithNonHookKeys.statusLine);
    assert.deepStrictEqual(result.enabledPlugins, settingsWithNonHookKeys.enabledPlugins);
    assert.equal(result.promptSuggestionEnabled, false);
  });

  it('full real settings.json test (load, merge, verify structure intact)', () => {
    const realSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
    if (!fs.existsSync(realSettingsPath)) return;

    const settings = loadSettings(realSettingsPath);
    const configPath = path.resolve('hooks-config.json');
    const hooksConfig = loadSettings(configPath);
    const merged = mergeHooks(settings, hooksConfig);

    assert.deepStrictEqual(merged.env, settings.env);
    assert.deepStrictEqual(merged.permissions, settings.permissions);
    assert.equal(merged.model, settings.model);
    assert.deepStrictEqual(merged.statusLine, settings.statusLine);
    assert.deepStrictEqual(merged.enabledPlugins, settings.enabledPlugins);
    assert.equal(merged.promptSuggestionEnabled, settings.promptSuggestionEnabled);

    for (const ev of allEventNames) {
      assert.ok(merged.hooks![ev], `merged should have ${ev}`);
    }

    const mergedAgain = mergeHooks(merged, hooksConfig);
    assert.deepStrictEqual(mergedAgain, merged);
  });

  it('empty hooksConfig → no change', () => {
    const settings = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'x.sh' }] }] } };
    const result = mergeHooks(settings, {});
    assert.deepStrictEqual(result, settings);
  });

  it('hooksConfig with no hooks property → no change', () => {
    const settings = { model: 'opus' };
    const result = mergeHooks(settings, { version: '1.0' });
    assert.deepStrictEqual(result, settings);
  });

  it('hooks config with empty event array → skip', () => {
    const config = { hooks: { Stop: [] } };
    const settings = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'x.sh' }] }] } };
    const result = mergeHooks(settings, config);
    assert.equal(result.hooks!.Stop.length, 1);
    assert.equal(result.hooks!.Stop[0].hooks[0].command, 'x.sh');
  });

  it('existing event groups is not an array → skip gracefully', () => {
    const settings = { hooks: { Stop: 'not-an-array' as any } };
    const result = mergeHooks(settings, minimalHooksConfig);
    assert.equal(result.hooks!.Stop, 'not-an-array');
  });

  it('existing group with non-array hooks → skip during duplicate check', () => {
    const settings = {
      hooks: {
        Stop: [{ hooks: 'not-hooks-array' as any }],
      },
    };
    const result = mergeHooks(settings, minimalHooksConfig);
    assert.equal(result.hooks!.Stop.length, 2);
    assert.equal(result.hooks!.Stop[0].hooks, 'not-hooks-array');
  });

  it('existing group with falsy hook entries → skip during duplicate check', () => {
    const settings = {
      hooks: {
        Stop: [{ hooks: [null as any, { type: 'other', command: 'x.sh' }] }],
      },
    };
    const result = mergeHooks(settings, minimalHooksConfig);
    assert.equal(result.hooks!.Stop.length, 2);
  });

  it('config first group has no command → skip event', () => {
    const config = {
      hooks: {
        Stop: [{ hooks: [{ type: 'command' }] }] as any,
      },
    };
    const settings = { hooks: {} };
    const result = mergeHooks(settings, config);
    assert.equal(result.hooks!.Stop, undefined);
  });

  it('config group with no hooks property → skip event', () => {
    const config = {
      hooks: {
        Stop: [{}] as any,
      },
    };
    const settings = { hooks: {} };
    const result = mergeHooks(settings, config);
    assert.equal(result.hooks!.Stop, undefined);
  });

  it('config group with empty hooks array → skip event', () => {
    const config = {
      hooks: {
        Stop: [{ hooks: [] }] as any,
      },
    };
    const settings = { hooks: {} };
    const result = mergeHooks(settings, config);
    assert.equal(result.hooks!.Stop, undefined);
  });
});

// ─── 3. removeHooksByConfig ──────────────────────────────────────────────────

describe('removeHooksByConfig', () => {
  it('normal removal (fully registered → all event-logger entries removed)', () => {
    const merged = mergeHooks({}, fullHooksConfig);
    const result = removeHooksByConfig(merged, fullHooksConfig);
    assert.equal(result.hooks, undefined);
  });

  it('not installed → no change', () => {
    const settings = { model: 'opus', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'other.sh' }] }] } };
    const result = removeHooksByConfig(settings, fullHooksConfig);
    assert.deepStrictEqual(result.hooks, settings.hooks);
  });

  it('coexist hooks ([notification-hook.sh, event-logger.sh] → notification stays)', () => {
    const settings = {
      hooks: {
        Notification: [
          {
            matcher: 'permission_prompt',
            hooks: [
              { type: 'command', command: '~/.claude/hooks/notification-hook.sh' },
              { type: 'command', command: '~/.claude/hooks/event-logger.sh', async: true },
            ],
          },
        ],
      },
    };
    const result = removeHooksByConfig(settings, fullHooksConfig);
    assert.equal(result.hooks!.Notification.length, 1);
    assert.equal(result.hooks!.Notification[0].hooks.length, 1);
    assert.equal(result.hooks!.Notification[0].hooks[0].command, '~/.claude/hooks/notification-hook.sh');
    assert.equal(result.hooks!.Notification[0].matcher, 'permission_prompt');
  });

  it('sole hook in matcher group → group removed', () => {
    const settings = {
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command: '~/.claude/hooks/event-logger.sh', async: true }] },
        ],
        SessionStart: [
          { hooks: [{ type: 'command', command: 'other.sh' }] },
        ],
      },
    };
    const result = removeHooksByConfig(settings, fullHooksConfig);
    assert.equal(result.hooks!.Stop, undefined);
    assert.ok(result.hooks!.SessionStart);
  });

  it('empty event array after removal → event key removed', () => {
    const settings = {
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command: '~/.claude/hooks/event-logger.sh' }] },
        ],
      },
    };
    const result = removeHooksByConfig(settings, fullHooksConfig);
    assert.equal(result.hooks, undefined);
  });

  it('idempotent (remove twice → same result)', () => {
    const merged = mergeHooks({}, fullHooksConfig);
    const first = removeHooksByConfig(merged, fullHooksConfig);
    const second = removeHooksByConfig(first, fullHooksConfig);
    assert.deepStrictEqual(second, first);
  });

  it('exact command match (event-logger-v2.sh not removed by event-logger.sh config)', () => {
    const settings = {
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command: '~/.claude/hooks/event-logger-v2.sh' }] },
        ],
      },
    };
    const result = removeHooksByConfig(settings, fullHooksConfig);
    assert.ok(result.hooks);
    assert.ok(result.hooks!.Stop);
    assert.equal(result.hooks!.Stop[0].hooks[0].command, '~/.claude/hooks/event-logger-v2.sh');
  });

  it('no hooks in settings → no change', () => {
    const settings = { model: 'opus', env: { A: '1' } };
    const result = removeHooksByConfig(settings, fullHooksConfig);
    assert.deepStrictEqual(result, settings);
  });

  it('matcher group without hooks array → preserved as-is', () => {
    const settings = {
      hooks: {
        Stop: [
          { matcher: 'some_pattern' } as any,
          { hooks: [{ type: 'command', command: '~/.claude/hooks/event-logger.sh' }] },
        ],
      },
    };
    const result = removeHooksByConfig(settings, fullHooksConfig);
    assert.equal(result.hooks!.Stop.length, 1);
    assert.equal(result.hooks!.Stop[0].matcher, 'some_pattern');
  });

  it('hooks array with falsy entries → handled gracefully', () => {
    const settings = {
      hooks: {
        Stop: [
          { hooks: [null as any, { type: 'command', command: '~/.claude/hooks/event-logger.sh' }] },
        ],
      },
    };
    const result = removeHooksByConfig(settings, fullHooksConfig);
    assert.equal(result.hooks!.Stop.length, 1);
    assert.equal(result.hooks!.Stop[0].hooks.length, 1);
    assert.equal(result.hooks!.Stop[0].hooks[0], null);
  });

  it('hooks with non-command type → not removed', () => {
    const settings = {
      hooks: {
        Stop: [
          { hooks: [{ type: 'shell', command: '~/.claude/hooks/event-logger.sh' }] },
        ],
      },
    };
    const result = removeHooksByConfig(settings, fullHooksConfig);
    assert.equal(result.hooks!.Stop.length, 1);
    assert.equal(result.hooks!.Stop[0].hooks[0].type, 'shell');
  });

  it('non-array matcherGroups → skip gracefully', () => {
    const settings = {
      hooks: {
        Stop: 'not-an-array' as any,
        SessionStart: [{ hooks: [{ type: 'command', command: '~/.claude/hooks/event-logger.sh' }] }],
      },
    };
    const result = removeHooksByConfig(settings, fullHooksConfig);
    assert.equal(result.hooks!.Stop, 'not-an-array');
    assert.equal(result.hooks!.SessionStart, undefined);
  });

  it('empty hooksConfig → no change', () => {
    const merged = mergeHooks({}, fullHooksConfig);
    const result = removeHooksByConfig(merged, {});
    assert.deepStrictEqual(result, merged);
  });
});

// ─── 4. saveSettings ────────────────────────────────────────────────────────

describe('saveSettings', () => {
  it('valid JSON with 2-space indent', () => {
    const fp = path.join(tmpDir, 'out.json');
    const data = { model: 'opus', env: { A: '1' } };
    saveSettings(fp, data);
    const raw = fs.readFileSync(fp, 'utf-8');
    const expected = JSON.stringify(data, null, 2) + '\n';
    assert.equal(raw, expected);
  });

  it('overwrite existing file', () => {
    const fp = path.join(tmpDir, 'overwrite.json');
    saveSettings(fp, { a: 1 });
    saveSettings(fp, { b: 2 });
    const result = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    assert.deepStrictEqual(result, { b: 2 });
  });

  it('create new file in existing dir', () => {
    const fp = path.join(tmpDir, 'newfile.json');
    assert.ok(!fs.existsSync(fp));
    saveSettings(fp, { x: 'y' });
    assert.ok(fs.existsSync(fp));
    const result = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    assert.deepStrictEqual(result, { x: 'y' });
  });

  it('output ends with newline', () => {
    const fp = path.join(tmpDir, 'nl.json');
    saveSettings(fp, { ok: true });
    const raw = fs.readFileSync(fp, 'utf-8');
    assert.ok(raw.endsWith('\n'), 'output should end with newline');
  });
});

// ─── 5. CLI integration ─────────────────────────────────────────────────────

describe('CLI integration', () => {
  const tsxBin = path.resolve('node_modules', '.bin', 'tsx');
  const cliPath = path.resolve('lib/settings-merge-cli.ts');
  const configPath = path.resolve('hooks-config.json');

  it('install command merges hooks', () => {
    const settingsFile = path.join(tmpDir, 'settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify({ model: 'opus' }), 'utf-8');

    const result = execFileSync(tsxBin, [cliPath, 'install', '--config', configPath, '--settings', settingsFile], {
      encoding: 'utf-8',
    });
    assert.ok(result.includes('hooks merged successfully'));

    const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    assert.ok(saved.hooks);
    for (const ev of allEventNames) {
      assert.ok(saved.hooks[ev], `should have ${ev}`);
    }
  });

  it('install command idempotent message', () => {
    const settingsFile = path.join(tmpDir, 'settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify({ model: 'opus' }), 'utf-8');

    execFileSync(tsxBin, [cliPath, 'install', '--config', configPath, '--settings', settingsFile], {
      encoding: 'utf-8',
    });

    const result = execFileSync(tsxBin, [cliPath, 'install', '--config', configPath, '--settings', settingsFile], {
      encoding: 'utf-8',
    });
    assert.ok(result.includes('already registered'));
  });

  it('uninstall command removes hooks', () => {
    const settingsFile = path.join(tmpDir, 'settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify({ model: 'opus' }), 'utf-8');

    execFileSync(tsxBin, [cliPath, 'install', '--config', configPath, '--settings', settingsFile], {
      encoding: 'utf-8',
    });

    const result = execFileSync(tsxBin, [cliPath, 'uninstall', '--config', configPath, '--settings', settingsFile], {
      encoding: 'utf-8',
    });
    assert.ok(result.includes('hooks removed successfully'));

    const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'));
    assert.equal(saved.hooks, undefined);
    assert.equal(saved.model, 'opus');
  });

  it('uninstall command idempotent message', () => {
    const settingsFile = path.join(tmpDir, 'settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify({ model: 'opus' }), 'utf-8');

    const result = execFileSync(tsxBin, [cliPath, 'uninstall', '--config', configPath, '--settings', settingsFile], {
      encoding: 'utf-8',
    });
    assert.ok(result.includes('no matching hooks found'));
  });
});
