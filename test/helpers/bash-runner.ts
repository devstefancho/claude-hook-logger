import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROJECT_ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');

export type LogLine = Record<string, unknown> & { data: Record<string, unknown> };

export interface EventLoggerResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  logLines: LogLine[];
}

export interface RotateLogsResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export function createTempHome(): string {
  const tempHome = mkdtempSync(join(tmpdir(), 'claude-hook-test-'));
  const logsDir = join(tempHome, '.claude', 'logs');
  const hooksDir = join(tempHome, '.claude', 'hooks');
  mkdirSync(logsDir, { recursive: true });
  mkdirSync(hooksDir, { recursive: true });

  const eventLoggerSrc = join(PROJECT_ROOT, 'hooks', 'event-logger.sh');
  const rotateLogsSrc = join(PROJECT_ROOT, 'hooks', 'rotate-logs.sh');
  const eventLoggerDst = join(hooksDir, 'event-logger.sh');
  const rotateLogsDst = join(hooksDir, 'rotate-logs.sh');

  writeFileSync(eventLoggerDst, readFileSync(eventLoggerSrc));
  execFileSync('chmod', ['+x', eventLoggerDst]);
  writeFileSync(rotateLogsDst, readFileSync(rotateLogsSrc));
  execFileSync('chmod', ['+x', rotateLogsDst]);

  return tempHome;
}

export function cleanupTempHome(tempHome: string): void {
  rmSync(tempHome, { recursive: true, force: true });
}

export function runEventLogger(tempHome: string, input: Record<string, unknown> | string): EventLoggerResult {
  const scriptPath = join(tempHome, '.claude', 'hooks', 'event-logger.sh');
  const stdinData = typeof input === 'string' ? input : JSON.stringify(input);

  const result = spawnSync('bash', [scriptPath], {
    input: stdinData,
    env: {
      ...process.env,
      HOME: tempHome,
      PATH: process.env.PATH,
    },
    timeout: 10000,
  });

  const logFile = join(tempHome, '.claude', 'logs', 'hook-events.jsonl');
  const logLines: LogLine[] = [];
  if (existsSync(logFile)) {
    const content = readFileSync(logFile, 'utf-8').trim();
    if (content) {
      for (const line of content.split('\n')) {
        if (line.trim()) {
          logLines.push(JSON.parse(line) as LogLine);
        }
      }
    }
  }

  return {
    exitCode: result.status,
    stdout: result.stdout?.toString() || '',
    stderr: result.stderr?.toString() || '',
    logLines,
  };
}

export function runRotateLogs(tempHome: string): RotateLogsResult {
  const scriptPath = join(tempHome, '.claude', 'hooks', 'rotate-logs.sh');

  const result = spawnSync('bash', [scriptPath], {
    env: {
      ...process.env,
      HOME: tempHome,
      PATH: process.env.PATH,
    },
    timeout: 10000,
  });

  return {
    exitCode: result.status,
    stdout: result.stdout?.toString() || '',
    stderr: result.stderr?.toString() || '',
  };
}

export function readLogFile(tempHome: string): LogLine[] {
  const logFile = join(tempHome, '.claude', 'logs', 'hook-events.jsonl');
  if (!existsSync(logFile)) return [];
  const content = readFileSync(logFile, 'utf-8').trim();
  if (!content) return [];
  return content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l) as LogLine);
}

export function writeLogFile(tempHome: string, content: string): void {
  const logFile = join(tempHome, '.claude', 'logs', 'hook-events.jsonl');
  writeFileSync(logFile, content);
}

export function getLogDir(tempHome: string): string {
  return join(tempHome, '.claude', 'logs');
}
