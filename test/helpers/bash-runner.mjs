import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PROJECT_ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '');

/**
 * Create a temporary HOME directory with .claude/logs and .claude/hooks structure.
 * Copies hook scripts into the temp HOME so the scripts can find rotate-logs.sh.
 */
export function createTempHome() {
  const tempHome = mkdtempSync(join(tmpdir(), 'claude-hook-test-'));
  const logsDir = join(tempHome, '.claude', 'logs');
  const hooksDir = join(tempHome, '.claude', 'hooks');
  mkdirSync(logsDir, { recursive: true });
  mkdirSync(hooksDir, { recursive: true });

  // Copy hook scripts into temp HOME
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

/**
 * Clean up a temporary HOME directory.
 */
export function cleanupTempHome(tempHome) {
  rmSync(tempHome, { recursive: true, force: true });
}

/**
 * Run event-logger.sh with the given JSON input piped via stdin.
 * @param {string} tempHome - The temp HOME directory
 * @param {object|string} input - JSON object or string to pipe via stdin
 * @returns {{ exitCode: number, stdout: string, stderr: string, logLines: object[] }}
 */
export function runEventLogger(tempHome, input) {
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
  const logLines = [];
  if (existsSync(logFile)) {
    const content = readFileSync(logFile, 'utf-8').trim();
    if (content) {
      for (const line of content.split('\n')) {
        if (line.trim()) {
          logLines.push(JSON.parse(line));
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

/**
 * Run rotate-logs.sh with the given temp HOME.
 * @param {string} tempHome - The temp HOME directory
 * @returns {{ exitCode: number, stdout: string, stderr: string }}
 */
export function runRotateLogs(tempHome) {
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

/**
 * Read the log file from the temp HOME.
 * @param {string} tempHome
 * @returns {object[]} Array of parsed JSONL entries
 */
export function readLogFile(tempHome) {
  const logFile = join(tempHome, '.claude', 'logs', 'hook-events.jsonl');
  if (!existsSync(logFile)) return [];
  const content = readFileSync(logFile, 'utf-8').trim();
  if (!content) return [];
  return content.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

/**
 * Write raw content to the log file.
 * @param {string} tempHome
 * @param {string} content
 */
export function writeLogFile(tempHome, content) {
  const logFile = join(tempHome, '.claude', 'logs', 'hook-events.jsonl');
  writeFileSync(logFile, content);
}

/**
 * Get the log directory path.
 */
export function getLogDir(tempHome) {
  return join(tempHome, '.claude', 'logs');
}
