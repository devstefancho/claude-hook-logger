import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface Hook {
  type: string;
  command: string;
  async?: boolean;
  timeout?: number;
}

export interface MatcherGroup {
  matcher?: string;
  hooks: Hook[];
}

export interface HooksMap {
  [eventName: string]: MatcherGroup[];
}

export interface Settings {
  hooks?: HooksMap;
  [key: string]: unknown;
}

export interface HooksConfig {
  hooks?: HooksMap;
  [key: string]: unknown;
}

export function loadSettings(filePath: string): Settings {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const trimmed = content.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed) as Settings;
  } catch (err) {
    throw new Error(`Invalid JSON in ${filePath}: ${(err as Error).message}`);
  }
}

export function saveSettings(filePath: string, settings: Settings): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = path.join(dir, `.settings-merge-${crypto.randomBytes(4).toString("hex")}.tmp`);
  fs.writeFileSync(tmpPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  fs.renameSync(tmpPath, filePath);
}

function hookMatchesCommand(hook: Hook, command: string): boolean {
  return hook && hook.type === "command" && hook.command === command;
}

export function mergeHooks(settings: Settings, hooksConfig: HooksConfig): Settings {
  const result: Settings = { ...settings };

  if (!hooksConfig || !hooksConfig.hooks) return result;

  if (!result.hooks) {
    result.hooks = {};
  } else {
    result.hooks = { ...result.hooks };
  }

  for (const [eventName, configMatcherGroups] of Object.entries(hooksConfig.hooks)) {
    if (!Array.isArray(configMatcherGroups) || configMatcherGroups.length === 0) continue;

    const targetCommand = configMatcherGroups[0]?.hooks?.[0]?.command;
    if (!targetCommand) continue;

    if (!result.hooks[eventName]) {
      result.hooks[eventName] = configMatcherGroups.map(mg => deepClone(mg));
      continue;
    }

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
      result.hooks[eventName] = [
        ...existingGroups,
        ...configMatcherGroups.map(mg => deepClone(mg)),
      ];
    }
  }

  return result;
}

export function removeHooksByConfig(settings: Settings, hooksConfig: HooksConfig): Settings {
  const result: Settings = { ...settings };

  if (!hooksConfig?.hooks || !result.hooks) return result;

  const commandsToRemove = new Set<string>();
  for (const matcherGroups of Object.values(hooksConfig.hooks)) {
    if (!Array.isArray(matcherGroups)) continue;
    for (const group of matcherGroups) {
      if (!Array.isArray(group.hooks)) continue;
      for (const hook of group.hooks) {
        if (hook.type === "command" && hook.command) {
          commandsToRemove.add(hook.command);
        }
      }
    }
  }

  result.hooks = { ...result.hooks };

  for (const [eventName, matcherGroups] of Object.entries(result.hooks)) {
    if (!Array.isArray(matcherGroups)) continue;

    const newGroups: MatcherGroup[] = [];
    for (const group of matcherGroups) {
      if (!group.hooks || !Array.isArray(group.hooks)) {
        newGroups.push(group);
        continue;
      }

      const filteredHooks = group.hooks.filter(hook => !(hook && hook.type === "command" && commandsToRemove.has(hook.command)));

      if (filteredHooks.length > 0) {
        newGroups.push({ ...group, hooks: filteredHooks });
      }
    }

    if (newGroups.length > 0) {
      result.hooks[eventName] = newGroups;
    } else {
      delete result.hooks[eventName];
    }
  }

  if (Object.keys(result.hooks).length === 0) {
    delete result.hooks;
  }

  return result;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
