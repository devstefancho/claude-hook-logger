#!/usr/bin/env node
// CLI entry point for settings-merge (install/uninstall hooks in settings.json)
import path from "node:path";
import { loadSettings, saveSettings, mergeHooks, removeHooksByConfig } from "./settings-merge.js";

const args = process.argv.slice(2);
const command = args[0];

function getArg(name: string): string | null {
  const idx = args.indexOf(name);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

if (command === "install") {
  const configPath = getArg("--config");
  const settingsPath = getArg("--settings");

  if (!configPath || !settingsPath) {
    console.error("Usage: node settings-merge-cli.js install --config <path> --settings <path>");
    process.exit(1);
  }

  const resolvedConfig = path.resolve(configPath);
  const resolvedSettings = path.resolve(settingsPath);

  const hooksConfig = loadSettings(resolvedConfig);
  const settings = loadSettings(resolvedSettings);
  const merged = mergeHooks(settings, hooksConfig);

  if (JSON.stringify(merged) === JSON.stringify(settings)) {
    console.log("settings.json: hooks already registered, no changes needed.");
  } else {
    saveSettings(resolvedSettings, merged);
    console.log("settings.json: hooks merged successfully.");
  }
} else if (command === "uninstall") {
  const configPath = getArg("--config");
  const settingsPath = getArg("--settings");

  if (!configPath || !settingsPath) {
    console.error("Usage: node settings-merge-cli.js uninstall --config <path> --settings <path>");
    process.exit(1);
  }

  const resolvedConfig = path.resolve(configPath);
  const resolvedSettings = path.resolve(settingsPath);

  const hooksConfig = loadSettings(resolvedConfig);
  const settings = loadSettings(resolvedSettings);
  const cleaned = removeHooksByConfig(settings, hooksConfig);

  if (JSON.stringify(cleaned) === JSON.stringify(settings)) {
    console.log("settings.json: no matching hooks found, no changes needed.");
  } else {
    saveSettings(resolvedSettings, cleaned);
    console.log("settings.json: hooks removed successfully.");
  }
} else {
  console.error("Usage: node settings-merge-cli.js <install|uninstall> [options]");
  process.exit(1);
}
