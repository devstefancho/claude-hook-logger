import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  createTempHome,
  cleanupTempHome,
  runRotateLogs,
  readLogFile,
  writeLogFile,
  getLogDir,
} from './helpers/bash-runner.js';

function makeEntry(dateStr: string, event = 'Stop'): string {
  return JSON.stringify({
    ts: `${dateStr}T12:00:00.000Z`,
    event,
    session_id: 'test-session',
    cwd: '/tmp',
    permission_mode: '',
    data: {},
  });
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0];
}

let tempHome: string;

beforeEach(() => {
  tempHome = createTempHome();
});

afterEach(() => {
  cleanupTempHome(tempHome);
});

describe('rotate-logs', () => {
  it('no log file exists → exits 0, no error', () => {
    const logFile = join(getLogDir(tempHome), 'hook-events.jsonl');
    if (existsSync(logFile)) {
      unlinkSync(logFile);
    }
    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);
  });

  it('empty log file → exits 0, no action', () => {
    writeLogFile(tempHome, '');
    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);
    const logDir = getLogDir(tempHome);
    const archives = readdirSync(logDir).filter(f => f.match(/hook-events\.\d{4}-\d{2}-\d{2}\.jsonl/));
    assert.equal(archives.length, 0);
  });

  it('log from today → no rotation', () => {
    const entry = makeEntry(todayStr());
    writeLogFile(tempHome, entry + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    const lines = readLogFile(tempHome);
    assert.equal(lines.length, 1);

    const logDir = getLogDir(tempHome);
    const archives = readdirSync(logDir).filter(f => f.match(/hook-events\.\d{4}-\d{2}-\d{2}\.jsonl/));
    assert.equal(archives.length, 0);
  });

  it('log from yesterday → rotated to hook-events.YYYY-MM-DD.jsonl', () => {
    const yesterday = daysAgo(1);
    const entry = makeEntry(yesterday);
    writeLogFile(tempHome, entry + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    const logDir = getLogDir(tempHome);
    const archiveName = `hook-events.${yesterday}.jsonl`;
    assert.ok(existsSync(join(logDir, archiveName)), `Expected ${archiveName} to exist`);

    const archiveContent = readFileSync(join(logDir, archiveName), 'utf-8').trim();
    const archiveLine = JSON.parse(archiveContent);
    assert.equal(archiveLine.event, 'Stop');

    const logFile = join(logDir, 'hook-events.jsonl');
    if (existsSync(logFile)) {
      const content = readFileSync(logFile, 'utf-8').trim();
      assert.equal(content, '', 'current log should be empty after rotation');
    }
  });

  it('existing archive for same date → appends to existing archive', () => {
    const yesterday = daysAgo(1);
    const logDir = getLogDir(tempHome);
    const archivePath = join(logDir, `hook-events.${yesterday}.jsonl`);

    const existingEntry = makeEntry(yesterday, 'SessionStart');
    writeFileSync(archivePath, existingEntry + '\n');

    const currentEntry = makeEntry(yesterday, 'SessionEnd');
    writeLogFile(tempHome, currentEntry + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    const archiveContent = readFileSync(archivePath, 'utf-8').trim();
    const archiveLines = archiveContent.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
    assert.equal(archiveLines.length, 2);
    assert.equal(archiveLines[0].event, 'SessionStart');
    assert.equal(archiveLines[1].event, 'SessionEnd');
  });

  it('current log cleared after rotation', () => {
    const yesterday = daysAgo(1);
    const entry = makeEntry(yesterday);
    writeLogFile(tempHome, entry + '\n');

    runRotateLogs(tempHome);

    const logFile = join(getLogDir(tempHome), 'hook-events.jsonl');
    if (existsSync(logFile)) {
      const content = readFileSync(logFile, 'utf-8').trim();
      assert.equal(content, '', 'log file should be empty after rotation');
    }
  });

  it('multiple days of logs → only rotates current log', () => {
    const logDir = getLogDir(tempHome);
    const twoDaysAgo = daysAgo(2);
    const yesterday = daysAgo(1);

    const archive2 = join(logDir, `hook-events.${twoDaysAgo}.jsonl`);
    writeFileSync(archive2, makeEntry(twoDaysAgo) + '\n');

    writeLogFile(tempHome, makeEntry(yesterday) + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    assert.ok(existsSync(archive2), 'Two-days-ago archive should still exist');
    const archive1 = join(logDir, `hook-events.${yesterday}.jsonl`);
    assert.ok(existsSync(archive1), 'Yesterday archive should be created');
  });

  it('log with invalid first line (no ts) → no rotation', () => {
    writeLogFile(tempHome, JSON.stringify({ event: 'Stop', data: {} }) + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    const logFile = join(getLogDir(tempHome), 'hook-events.jsonl');
    const content = readFileSync(logFile, 'utf-8').trim();
    assert.ok(content.length > 0, 'log file should still have content');

    const logDir = getLogDir(tempHome);
    const archives = readdirSync(logDir).filter(f => f.match(/hook-events\.\d{4}-\d{2}-\d{2}\.jsonl/));
    assert.equal(archives.length, 0);
  });

  it('empty first line ts → no rotation', () => {
    writeLogFile(tempHome, JSON.stringify({ ts: '', event: 'Stop', data: {} }) + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    const logFile = join(getLogDir(tempHome), 'hook-events.jsonl');
    const content = readFileSync(logFile, 'utf-8').trim();
    assert.ok(content.length > 0, 'log file should still have content');

    const logDir = getLogDir(tempHome);
    const archives = readdirSync(logDir).filter(f => f.match(/hook-events\.\d{4}-\d{2}-\d{2}\.jsonl/));
    assert.equal(archives.length, 0);
  });
});
