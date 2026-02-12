import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync, utimesSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  createTempHome,
  cleanupTempHome,
  runRotateLogs,
  readLogFile,
  writeLogFile,
  getLogDir,
} from './helpers/bash-runner.mjs';

/**
 * Helper: build a JSONL line with a specific date in ts field.
 */
function makeEntry(dateStr, event = 'Stop') {
  return JSON.stringify({
    ts: `${dateStr}T12:00:00.000Z`,
    event,
    session_id: 'test-session',
    cwd: '/tmp',
    permission_mode: '',
    data: {},
  });
}

/**
 * Helper: get today's date string in YYYY-MM-DD format (UTC).
 */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Helper: get a past date string N days ago.
 */
function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0];
}

let tempHome;

beforeEach(() => {
  tempHome = createTempHome();
});

afterEach(() => {
  cleanupTempHome(tempHome);
});

describe('rotate-logs', () => {
  it('no log file exists → exits 0, no error', () => {
    // Remove the log file if it exists (it shouldn't, but be safe)
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
    // No archive files should exist
    const logDir = getLogDir(tempHome);
    const archives = readdirSync(logDir).filter(f => f.match(/hook-events\.\d{4}-\d{2}-\d{2}\.jsonl/));
    assert.equal(archives.length, 0);
  });

  it('log from today → no rotation', () => {
    const entry = makeEntry(todayStr());
    writeLogFile(tempHome, entry + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    // Log file should still have the entry
    const lines = readLogFile(tempHome);
    assert.equal(lines.length, 1);

    // No archive files
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

    // Archive file should exist with yesterday's date
    const logDir = getLogDir(tempHome);
    const archiveName = `hook-events.${yesterday}.jsonl`;
    assert.ok(existsSync(join(logDir, archiveName)), `Expected ${archiveName} to exist`);

    // Archive should contain the entry
    const archiveContent = readFileSync(join(logDir, archiveName), 'utf-8').trim();
    const archiveLine = JSON.parse(archiveContent);
    assert.equal(archiveLine.event, 'Stop');

    // Current log should be empty or not exist
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

    // Create an existing archive with one entry
    const existingEntry = makeEntry(yesterday, 'SessionStart');
    writeFileSync(archivePath, existingEntry + '\n');

    // Write current log with entry from yesterday
    const currentEntry = makeEntry(yesterday, 'SessionEnd');
    writeLogFile(tempHome, currentEntry + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    // Archive should now have both entries
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
    // If the file was moved (not appended), it may not exist at all, which is also fine
  });

  it('archives older than 30 days → deleted', () => {
    const logDir = getLogDir(tempHome);
    const oldDate = daysAgo(35);
    const archivePath = join(logDir, `hook-events.${oldDate}.jsonl`);

    // Create an old archive and set its mtime to >30 days ago
    writeFileSync(archivePath, makeEntry(oldDate) + '\n');
    const oldTime = new Date();
    oldTime.setUTCDate(oldTime.getUTCDate() - 35);
    utimesSync(archivePath, oldTime, oldTime);

    // Create current log from today so rotation doesn't happen
    writeLogFile(tempHome, makeEntry(todayStr()) + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    // Old archive should be deleted
    assert.ok(!existsSync(archivePath), `Old archive ${archivePath} should be deleted`);
  });

  it('multiple days of logs → only rotates current log', () => {
    const logDir = getLogDir(tempHome);
    const twoDaysAgo = daysAgo(2);
    const yesterday = daysAgo(1);

    // Create an existing archive for two days ago
    const archive2 = join(logDir, `hook-events.${twoDaysAgo}.jsonl`);
    writeFileSync(archive2, makeEntry(twoDaysAgo) + '\n');

    // Current log has entries from yesterday
    writeLogFile(tempHome, makeEntry(yesterday) + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    // Both archives should exist
    assert.ok(existsSync(archive2), 'Two-days-ago archive should still exist');
    const archive1 = join(logDir, `hook-events.${yesterday}.jsonl`);
    assert.ok(existsSync(archive1), 'Yesterday archive should be created');
  });

  it('log with invalid first line (no ts) → no rotation', () => {
    writeLogFile(tempHome, JSON.stringify({ event: 'Stop', data: {} }) + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    // Log file should still have the entry (not rotated)
    const logFile = join(getLogDir(tempHome), 'hook-events.jsonl');
    const content = readFileSync(logFile, 'utf-8').trim();
    assert.ok(content.length > 0, 'log file should still have content');

    // No archives should be created
    const logDir = getLogDir(tempHome);
    const archives = readdirSync(logDir).filter(f => f.match(/hook-events\.\d{4}-\d{2}-\d{2}\.jsonl/));
    assert.equal(archives.length, 0);
  });

  it('empty first line ts → no rotation', () => {
    writeLogFile(tempHome, JSON.stringify({ ts: '', event: 'Stop', data: {} }) + '\n');

    const result = runRotateLogs(tempHome);
    assert.equal(result.exitCode, 0);

    // Log file should still have the entry
    const logFile = join(getLogDir(tempHome), 'hook-events.jsonl');
    const content = readFileSync(logFile, 'utf-8').trim();
    assert.ok(content.length > 0, 'log file should still have content');

    // No archives
    const logDir = getLogDir(tempHome);
    const archives = readdirSync(logDir).filter(f => f.match(/hook-events\.\d{4}-\d{2}-\d{2}\.jsonl/));
    assert.equal(archives.length, 0);
  });
});
