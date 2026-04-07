#!/usr/bin/env node
// Cross-platform test runner that resolves glob patterns for Windows compatibility
import { readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const files = readdirSync("test")
  .filter(f => f.endsWith(".test.ts"))
  .map(f => join("test", f));

execFileSync(
  process.execPath,
  ["--import", "tsx/esm", "--experimental-test-module-mocks", "--test", ...files],
  { stdio: "inherit" }
);
