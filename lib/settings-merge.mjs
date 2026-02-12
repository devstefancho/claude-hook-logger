import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Load settings from a JSON file.
 * @param {string} filePath - Path to settings.json
 * @returns {object} Parsed settings or {} if file missing/empty
 * @throws {Error} If file contains invalid JSON (data protection)
 */
export function loadSettings(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const trimmed = content.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${err.message}`);
  }
}

/**
 * Atomically save settings to a JSON file.
 * Writes to a tmp file first, then renames for crash safety.
 * @param {string} filePath - Path to settings.json
 * @param {object} settings - Settings object to save
 */
export function saveSettings(filePath, settings) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = path.join(dir, `.settings-merge-${crypto.randomBytes(4).toString("hex")}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  fs.renameSync(tmpPath, filePath);
}

/**
 * Check if a hook command matches the target command string.
 * @param {object} hook - Hook object with .command
 * @param {string} command - Command string to match
 * @returns {boolean}
 */
function hookMatchesCommand(hook, command) {
  return hook && hook.type === "command" && hook.command === command;
}

/**
 * Check if a hook command matches a regex pattern.
 * @param {object} hook - Hook object with .command
 * @param {RegExp} pattern - Pattern to match against
 * @returns {boolean}
 */
function hookMatchesPattern(hook, pattern) {
  return hook && hook.type === "command" && pattern.test(hook.command);
}

/**
 * Merge hook configuration into existing settings.
 * Appends only - never replaces existing hooks.
 * Idempotent: running twice produces the same result.
 *
 * @param {object} settings - Current settings object
 * @param {object} hooksConfig - Hook config with .hooks property
 * @returns {object} New settings object with hooks merged
 */
export function mergeHooks(settings, hooksConfig) {
  const result = { ...settings };

  if (!hooksConfig || !hooksConfig.hooks) return result;

  if (!result.hooks) {
    result.hooks = {};
  } else {
    result.hooks = { ...result.hooks };
  }

  for (const [eventName, configMatcherGroups] of Object.entries(hooksConfig.hooks)) {
    if (!Array.isArray(configMatcherGroups) || configMatcherGroups.length === 0) continue;

    // Get the command from the config's first matcher group's first hook
    const targetCommand = configMatcherGroups[0]?.hooks?.[0]?.command;
    if (!targetCommand) continue;

    if (!result.hooks[eventName]) {
      // Event doesn't exist - add all config matcher groups
      result.hooks[eventName] = configMatcherGroups.map(mg => deepClone(mg));
      continue;
    }

    // Event exists - check if command is already registered anywhere
    const existingGroups = result.hooks[eventName];
    if (!Array.isArray(existingGroups)) continue;

    let alreadyRegistered = false;
    for (const group of existingGroups) {
      const hooks = group.hooks;
      if (!Array.isArray(hooks)) continue;
      for (const hook of hooks) {
        if (hookMatchesCommand(hook, targetCommand)) {
          alreadyRegistered = true;
          break;
        }
      }
      if (alreadyRegistered) break;
    }

    if (!alreadyRegistered) {
      // Append new matcher groups to the end
      result.hooks[eventName] = [
        ...existingGroups,
        ...configMatcherGroups.map(mg => deepClone(mg)),
      ];
    }
  }

  return result;
}

/**
 * Remove hooks matching a command pattern from settings.
 * Cleans up empty matcher groups and event keys.
 * Idempotent: running twice produces the same result.
 *
 * @param {object} settings - Current settings object
 * @param {string} commandPattern - Regex pattern string to match hook commands
 * @returns {object} New settings object with matching hooks removed
 */
export function removeHooks(settings, commandPattern) {
  const result = { ...settings };
  const pattern = new RegExp(commandPattern);

  if (!result.hooks) return result;

  result.hooks = { ...result.hooks };

  for (const [eventName, matcherGroups] of Object.entries(result.hooks)) {
    if (!Array.isArray(matcherGroups)) continue;

    const newGroups = [];
    for (const group of matcherGroups) {
      if (!group.hooks || !Array.isArray(group.hooks)) {
        newGroups.push(group);
        continue;
      }

      const filteredHooks = group.hooks.filter(hook => !hookMatchesPattern(hook, pattern));

      if (filteredHooks.length > 0) {
        newGroups.push({ ...group, hooks: filteredHooks });
      }
      // If filteredHooks is empty, drop the entire matcher group
    }

    if (newGroups.length > 0) {
      result.hooks[eventName] = newGroups;
    } else {
      delete result.hooks[eventName];
    }
  }

  // If hooks object is now empty, remove it
  if (Object.keys(result.hooks).length === 0) {
    delete result.hooks;
  }

  return result;
}

/**
 * Deep clone a plain object/array.
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// --- CLI Interface ---
if (process.argv[1] && process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  const command = args[0];

  function getArg(name) {
    const idx = args.indexOf(name);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
  }

  if (command === "install") {
    const configPath = getArg("--config");
    const settingsPath = getArg("--settings");

    if (!configPath || !settingsPath) {
      console.error("Usage: node settings-merge.mjs install --config <path> --settings <path>");
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
    const settingsPath = getArg("--settings");
    const pattern = getArg("--pattern");

    if (!settingsPath || !pattern) {
      console.error("Usage: node settings-merge.mjs uninstall --settings <path> --pattern <regex>");
      process.exit(1);
    }

    const resolvedSettings = path.resolve(settingsPath);
    const settings = loadSettings(resolvedSettings);
    const cleaned = removeHooks(settings, pattern);

    if (JSON.stringify(cleaned) === JSON.stringify(settings)) {
      console.log("settings.json: no matching hooks found, no changes needed.");
    } else {
      saveSettings(resolvedSettings, cleaned);
      console.log("settings.json: hooks removed successfully.");
    }
  } else {
    console.error("Usage: node settings-merge.mjs <install|uninstall> [options]");
    process.exit(1);
  }
}
