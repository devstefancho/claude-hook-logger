#!/usr/bin/env node
// CLI entry point for the Hook Events Log Viewer server
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_DIR = path.join(process.env.HOME || "", ".claude", "hook-logger");
const DEFAULT_PORT = 7777;

const PORT = parseInt(process.argv[2] || String(DEFAULT_PORT), 10);
// Prefer built web assets (dist/web) over source web directory
const distWebDir = path.join(__dirname, "..", "dist", "web");
const srcWebDir = path.join(__dirname, "..", "web");
const webDir = fs.existsSync(path.join(distWebDir, "index.html")) ? distWebDir : srcWebDir;
const server = createServer(DEFAULT_LOG_DIR, path.join(__dirname, "index.html"), webDir);

function startServer() {
  server.listen(PORT, () => {
    console.log(`Hook Events Log Viewer running at http://localhost:${PORT}`);
    console.log(`Log directory: ${DEFAULT_LOG_DIR}`);
    console.log("Press Ctrl+C to stop");
  });
}

let retried = false;
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE" && !retried) {
    retried = true;
    console.log(`Port ${PORT} is in use. Attempting to kill existing process...`);
    try {
      const pid = execSync(`lsof -ti :${PORT}`, { encoding: "utf-8" }).trim();
      if (pid) {
        execSync(`kill -9 ${pid}`);
        console.log(`Killed process ${pid}`);
        setTimeout(startServer, 1000);
        return;
      }
    } catch {
      // lsof or kill failed
    }
    console.error(`Port ${PORT} is still in use. Try: sudo kill -9 $(lsof -ti :${PORT})`);
    process.exit(1);
  }
  throw err;
});

startServer();

function shutdown(): void {
  console.log("\nShutting down...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
