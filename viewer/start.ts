#!/usr/bin/env node
// CLI entry point for the Hook Events Log Viewer server
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_LOG_DIR = path.join(process.env.HOME || "", ".claude", "logs");
const DEFAULT_PORT = 7777;

const PORT = parseInt(process.argv[2] || String(DEFAULT_PORT), 10);
const server = createServer(DEFAULT_LOG_DIR, path.join(__dirname, "index.html"));

server.listen(PORT, () => {
  console.log(`Hook Events Log Viewer running at http://localhost:${PORT}`);
  console.log(`Log directory: ${DEFAULT_LOG_DIR}`);
  console.log("Press Ctrl+C to stop");
});

function shutdown(): void {
  console.log("\nShutting down...");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
