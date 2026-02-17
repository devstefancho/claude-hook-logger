import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import {
  createTempHome,
  cleanupTempHome,
  runEventLogger,
  readLogFile,
  writeLogFile,
  getLogDir,
} from './helpers/bash-runner.mjs';

let tempHome;

beforeEach(() => {
  tempHome = createTempHome();
});

afterEach(() => {
  cleanupTempHome(tempHome);
});

// ─── Common field tests ─────────────────────────────────────────────────────

describe('common fields', () => {
  it('empty stdin exits 0 with no log entry', () => {
    const result = runEventLogger(tempHome, '');
    assert.equal(result.exitCode, 0);
    assert.equal(result.logLines.length, 0);
  });

  it('minimal input creates entry with all common fields', () => {
    const result = runEventLogger(tempHome, { hook_event_name: 'SessionStart' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.logLines.length, 1);
    const entry = result.logLines[0];
    assert.ok(entry.ts, 'ts should be present');
    assert.equal(entry.event, 'SessionStart');
    assert.ok('session_id' in entry, 'session_id should be present');
    assert.ok('cwd' in entry, 'cwd should be present');
    assert.ok('permission_mode' in entry, 'permission_mode should be present');
    assert.ok('data' in entry, 'data should be present');
  });

  it('missing fields default to "unknown"', () => {
    const result = runEventLogger(tempHome, { hook_event_name: 'SessionStart' });
    const entry = result.logLines[0];
    assert.equal(entry.session_id, 'unknown');
    assert.equal(entry.cwd, 'unknown');
  });

  it('output is valid JSONL (parseable JSON per line)', () => {
    runEventLogger(tempHome, { hook_event_name: 'SessionStart', session_id: 's1' });
    runEventLogger(tempHome, { hook_event_name: 'SessionEnd', session_id: 's1', reason: 'done' });
    const lines = readLogFile(tempHome);
    assert.equal(lines.length, 2);
    // Each line was parseable (readLogFile would throw otherwise)
    assert.equal(lines[0].event, 'SessionStart');
    assert.equal(lines[1].event, 'SessionEnd');
  });

  it('common fields present: ts, event, session_id, cwd, permission_mode, data', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'Stop',
      session_id: 'abc',
      cwd: '/tmp',
      permission_mode: 'default',
      stop_hook_active: true,
    });
    const entry = result.logLines[0];
    const requiredFields = ['ts', 'event', 'session_id', 'cwd', 'permission_mode', 'data'];
    for (const field of requiredFields) {
      assert.ok(field in entry, `field "${field}" should be present`);
    }
    assert.match(entry.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    assert.equal(entry.event, 'Stop');
    assert.equal(entry.session_id, 'abc');
    assert.equal(entry.cwd, '/tmp');
    assert.equal(entry.permission_mode, 'default');
  });
});

// ─── SessionStart ───────────────────────────────────────────────────────────

describe('SessionStart', () => {
  it('captures source field', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'SessionStart',
      source: 'cli',
    });
    assert.equal(result.logLines[0].data.source, 'cli');
  });

  it('captures model field', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'SessionStart',
      model: 'claude-sonnet-4-5-20250929',
    });
    assert.equal(result.logLines[0].data.model, 'claude-sonnet-4-5-20250929');
  });

  it('source and model default to null when missing', () => {
    const result = runEventLogger(tempHome, { hook_event_name: 'SessionStart' });
    assert.equal(result.logLines[0].data.source, null);
    assert.equal(result.logLines[0].data.model, null);
  });
});

// ─── SessionEnd ─────────────────────────────────────────────────────────────

describe('SessionEnd', () => {
  it('captures reason field', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'SessionEnd',
      reason: 'user_exit',
    });
    assert.equal(result.logLines[0].data.reason, 'user_exit');
  });

  it('reason defaults to null when missing', () => {
    const result = runEventLogger(tempHome, { hook_event_name: 'SessionEnd' });
    assert.equal(result.logLines[0].data.reason, null);
  });
});

// ─── UserPromptSubmit ───────────────────────────────────────────────────────

describe('UserPromptSubmit', () => {
  it('captures prompt and prompt_length', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'UserPromptSubmit',
      prompt: 'Hello world',
    });
    assert.equal(result.logLines[0].data.prompt, 'Hello world');
    assert.equal(result.logLines[0].data.prompt_length, 11);
  });

  it('truncates prompt to 500 chars', () => {
    const longPrompt = 'A'.repeat(700);
    const result = runEventLogger(tempHome, {
      hook_event_name: 'UserPromptSubmit',
      prompt: longPrompt,
    });
    assert.equal(result.logLines[0].data.prompt.length, 500);
    assert.equal(result.logLines[0].data.prompt_length, 700);
  });

  it('empty prompt yields empty string and length 0', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'UserPromptSubmit',
      prompt: '',
    });
    assert.equal(result.logLines[0].data.prompt, '');
    assert.equal(result.logLines[0].data.prompt_length, 0);
  });
});

// ─── PreToolUse: Bash ───────────────────────────────────────────────────────

describe('PreToolUse - Bash', () => {
  it('captures command summary', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_use_id: 'tu1',
      tool_input: { command: 'ls -la /tmp' },
    });
    const data = result.logLines[0].data;
    assert.equal(data.tool_name, 'Bash');
    assert.equal(data.tool_use_id, 'tu1');
    assert.equal(data.tool_input_summary, 'ls -la /tmp');
  });

  it('truncates command to 200 chars', () => {
    const longCmd = 'echo ' + 'x'.repeat(300);
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_use_id: 'tu2',
      tool_input: { command: longCmd },
    });
    assert.equal(result.logLines[0].data.tool_input_summary.length, 200);
  });
});

// ─── PreToolUse: Read ───────────────────────────────────────────────────────

describe('PreToolUse - Read', () => {
  it('captures file_path', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_use_id: 'tu3',
      tool_input: { file_path: '/src/main.js' },
    });
    assert.equal(result.logLines[0].data.tool_input_summary, '/src/main.js');
  });
});

// ─── PreToolUse: Write ──────────────────────────────────────────────────────

describe('PreToolUse - Write', () => {
  it('captures file_path', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_use_id: 'tu4',
      tool_input: { file_path: '/src/output.txt' },
    });
    assert.equal(result.logLines[0].data.tool_input_summary, '/src/output.txt');
  });
});

// ─── PreToolUse: Edit ───────────────────────────────────────────────────────

describe('PreToolUse - Edit', () => {
  it('captures file_path', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Edit',
      tool_use_id: 'tu5',
      tool_input: { file_path: '/src/config.json' },
    });
    assert.equal(result.logLines[0].data.tool_input_summary, '/src/config.json');
  });
});

// ─── PreToolUse: Glob ───────────────────────────────────────────────────────

describe('PreToolUse - Glob', () => {
  it('captures pattern', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Glob',
      tool_use_id: 'tu6',
      tool_input: { pattern: '**/*.js' },
    });
    assert.equal(result.logLines[0].data.tool_input_summary, '**/*.js');
  });
});

// ─── PreToolUse: Grep ───────────────────────────────────────────────────────

describe('PreToolUse - Grep', () => {
  it('captures pattern', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Grep',
      tool_use_id: 'tu7',
      tool_input: { pattern: 'TODO|FIXME' },
    });
    assert.equal(result.logLines[0].data.tool_input_summary, 'TODO|FIXME');
  });
});

// ─── PreToolUse: Task ───────────────────────────────────────────────────────

describe('PreToolUse - Task', () => {
  it('captures description', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Task',
      tool_use_id: 'tu8',
      tool_input: { description: 'Run integration tests' },
    });
    assert.equal(result.logLines[0].data.tool_input_summary, 'Run integration tests');
  });
});

// ─── PreToolUse: WebFetch ───────────────────────────────────────────────────

describe('PreToolUse - WebFetch', () => {
  it('captures url', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'WebFetch',
      tool_use_id: 'tu9',
      tool_input: { url: 'https://example.com/api' },
    });
    assert.equal(result.logLines[0].data.tool_input_summary, 'https://example.com/api');
  });
});

// ─── PreToolUse: WebSearch ──────────────────────────────────────────────────

describe('PreToolUse - WebSearch', () => {
  it('captures query', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'WebSearch',
      tool_use_id: 'tu10',
      tool_input: { query: 'node.js best practices' },
    });
    assert.equal(result.logLines[0].data.tool_input_summary, 'node.js best practices');
  });
});

// ─── PreToolUse: Skill ─────────────────────────────────────────────────────

describe('PreToolUse - Skill', () => {
  it('captures skill name', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Skill',
      tool_use_id: 'tu-skill1',
      tool_input: { skill: 'commit' },
    });
    assert.equal(result.logLines[0].data.tool_input_summary, 'commit');
  });

  it('captures skill name with args', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Skill',
      tool_use_id: 'tu-skill2',
      tool_input: { skill: 'review-pr', args: '123' },
    });
    assert.equal(result.logLines[0].data.tool_input_summary, 'review-pr');
  });

  it('missing skill field yields empty string', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Skill',
      tool_use_id: 'tu-skill3',
      tool_input: {},
    });
    assert.equal(result.logLines[0].data.tool_input_summary, '');
  });

  it('empty tool_input yields empty string', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Skill',
      tool_use_id: 'tu-skill4',
      tool_input: {},
    });
    assert.equal(result.logLines[0].data.tool_input_summary, '');
  });
});

// ─── PreToolUse: Unknown tool ───────────────────────────────────────────────

describe('PreToolUse - unknown tool', () => {
  it('captures tool_input as string', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'CustomTool',
      tool_use_id: 'tu11',
      tool_input: { foo: 'bar', baz: 123 },
    });
    const summary = result.logLines[0].data.tool_input_summary;
    assert.ok(summary.includes('foo'));
    assert.ok(summary.includes('bar'));
  });

  it('unknown tool input summary is truncated to 200 chars', () => {
    const bigInput = {};
    for (let i = 0; i < 50; i++) {
      bigInput[`key_${i}`] = 'x'.repeat(20);
    }
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'CustomTool',
      tool_use_id: 'tu12',
      tool_input: bigInput,
    });
    assert.ok(result.logLines[0].data.tool_input_summary.length <= 200);
  });
});

// ─── PostToolUse ────────────────────────────────────────────────────────────

describe('PostToolUse', () => {
  it('captures tool_name, tool_use_id, success=true', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_use_id: 'tu20',
    });
    const data = result.logLines[0].data;
    assert.equal(data.tool_name, 'Bash');
    assert.equal(data.tool_use_id, 'tu20');
    assert.equal(data.success, true);
  });
});

// ─── PostToolUseFailure ─────────────────────────────────────────────────────

describe('PostToolUseFailure', () => {
  it('captures tool_name, tool_use_id, error, is_interrupt=false', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      tool_use_id: 'tu21',
      error: 'command not found',
      is_interrupt: false,
    });
    const data = result.logLines[0].data;
    assert.equal(data.tool_name, 'Bash');
    assert.equal(data.tool_use_id, 'tu21');
    assert.equal(data.error, 'command not found');
    assert.equal(data.is_interrupt, false);
  });

  it('captures is_interrupt=true', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Read',
      tool_use_id: 'tu22',
      error: 'user interrupted',
      is_interrupt: true,
    });
    const data = result.logLines[0].data;
    assert.equal(data.is_interrupt, true);
  });

  it('truncates error message to 300 chars', () => {
    const longError = 'E'.repeat(500);
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      tool_use_id: 'tu23',
      error: longError,
    });
    assert.equal(result.logLines[0].data.error.length, 300);
  });
});

// ─── Notification ───────────────────────────────────────────────────────────

describe('Notification', () => {
  it('captures notification_type and message', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'Notification',
      notification_type: 'info',
      message: 'Build succeeded',
    });
    const data = result.logLines[0].data;
    assert.equal(data.notification_type, 'info');
    assert.equal(data.message, 'Build succeeded');
  });
});

// ─── Stop ───────────────────────────────────────────────────────────────────

describe('Stop', () => {
  it('captures stop_hook_active=true', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'Stop',
      stop_hook_active: true,
    });
    assert.equal(result.logLines[0].data.stop_hook_active, true);
  });

  it('captures stop_hook_active=false', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'Stop',
      stop_hook_active: false,
    });
    assert.equal(result.logLines[0].data.stop_hook_active, false);
  });
});

// ─── SubagentStart ──────────────────────────────────────────────────────────

describe('SubagentStart', () => {
  it('captures agent_id and agent_type', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'SubagentStart',
      agent_id: 'agent-001',
      agent_type: 'researcher',
    });
    const data = result.logLines[0].data;
    assert.equal(data.agent_id, 'agent-001');
    assert.equal(data.agent_type, 'researcher');
  });
});

// ─── SubagentStop ───────────────────────────────────────────────────────────

describe('SubagentStop', () => {
  it('captures agent_id and agent_type', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'SubagentStop',
      agent_id: 'agent-001',
      agent_type: 'researcher',
    });
    const data = result.logLines[0].data;
    assert.equal(data.agent_id, 'agent-001');
    assert.equal(data.agent_type, 'researcher');
  });
});

// ─── Unknown event ──────────────────────────────────────────────────────────

describe('Unknown event type', () => {
  it('data is empty {}', () => {
    const result = runEventLogger(tempHome, {
      hook_event_name: 'SomeNewEvent',
      session_id: 's1',
    });
    assert.deepEqual(result.logLines[0].data, {});
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('log rotation triggered on SessionStart', () => {
    // Write an old log entry with a past date
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    const oldEntry = JSON.stringify({ ts: `${yStr}T10:00:00.000Z`, event: 'Stop', session_id: 's0', cwd: '/', permission_mode: '', data: {} });
    writeLogFile(tempHome, oldEntry + '\n');

    // Run a SessionStart event - this triggers rotate-logs.sh in background
    const result = runEventLogger(tempHome, {
      hook_event_name: 'SessionStart',
      session_id: 's1',
      source: 'cli',
    });
    assert.equal(result.exitCode, 0);

    // Give the background rotation a moment to complete
    execSync('sleep 0.5');

    // Check that an archive file was created
    const logDir = getLogDir(tempHome);
    const files = readdirSync(logDir);
    const archives = files.filter(f => f.match(/hook-events\.\d{4}-\d{2}-\d{2}\.jsonl/));
    assert.ok(archives.length > 0, `Expected archive files but found: ${files.join(', ')}`);
  });

  it('large prompt (>500 chars) is truncated', () => {
    const prompt = 'B'.repeat(600);
    const result = runEventLogger(tempHome, {
      hook_event_name: 'UserPromptSubmit',
      prompt,
    });
    assert.equal(result.logLines[0].data.prompt.length, 500);
    assert.equal(result.logLines[0].data.prompt_length, 600);
  });

  it('special characters in prompt (quotes, newlines) handled correctly', () => {
    const prompt = 'He said "hello"\nand then \'goodbye\'';
    const result = runEventLogger(tempHome, {
      hook_event_name: 'UserPromptSubmit',
      prompt,
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.logLines[0].data.prompt_length, prompt.length);
    // The prompt may have newlines converted by head -c, but should still be valid
    assert.ok(result.logLines[0].data.prompt.includes('He said'));
  });

  it('multiple events append to same file (JSONL)', () => {
    runEventLogger(tempHome, { hook_event_name: 'SessionStart', session_id: 's1' });
    runEventLogger(tempHome, { hook_event_name: 'UserPromptSubmit', session_id: 's1', prompt: 'hi' });
    runEventLogger(tempHome, { hook_event_name: 'Stop', session_id: 's1', stop_hook_active: false });

    const lines = readLogFile(tempHome);
    assert.equal(lines.length, 3);
    assert.equal(lines[0].event, 'SessionStart');
    assert.equal(lines[1].event, 'UserPromptSubmit');
    assert.equal(lines[2].event, 'Stop');
  });

  it('log directory created if missing', () => {
    // Remove the log directory
    const logDir = getLogDir(tempHome);
    rmSync(logDir, { recursive: true, force: true });
    assert.ok(!existsSync(logDir));

    const result = runEventLogger(tempHome, { hook_event_name: 'SessionStart' });
    assert.equal(result.exitCode, 0);
    assert.ok(existsSync(logDir), 'log directory should be recreated');
  });

  it('large command (>200 chars) truncated in Bash tool summary', () => {
    const longCmd = 'find / -name ' + '"' + 'x'.repeat(300) + '"';
    const result = runEventLogger(tempHome, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_use_id: 'tu99',
      tool_input: { command: longCmd },
    });
    assert.ok(result.logLines[0].data.tool_input_summary.length <= 200);
  });
});
