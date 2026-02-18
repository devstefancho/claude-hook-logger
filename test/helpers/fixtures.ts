import type { Settings, HooksConfig } from '../../lib/settings-merge.js';

export const minimalHooksConfig: HooksConfig = {
  hooks: {
    Stop: [
      {
        hooks: [
          { type: "command", command: "~/.claude/hooks/event-logger.sh", async: true },
        ],
      },
    ],
  },
};

export const fullHooksConfig: HooksConfig = {
  hooks: {
    SessionStart: [
      { hooks: [{ type: "command", command: "~/.claude/hooks/event-logger.sh" }] },
    ],
    SessionEnd: [
      { hooks: [{ type: "command", command: "~/.claude/hooks/event-logger.sh", async: true }] },
    ],
    UserPromptSubmit: [
      { hooks: [{ type: "command", command: "~/.claude/hooks/event-logger.sh" }] },
    ],
    PreToolUse: [
      { hooks: [{ type: "command", command: "~/.claude/hooks/event-logger.sh", async: true }] },
    ],
    PostToolUse: [
      { hooks: [{ type: "command", command: "~/.claude/hooks/event-logger.sh", async: true }] },
    ],
    PostToolUseFailure: [
      { hooks: [{ type: "command", command: "~/.claude/hooks/event-logger.sh", async: true }] },
    ],
    Notification: [
      { hooks: [{ type: "command", command: "~/.claude/hooks/event-logger.sh", async: true }] },
    ],
    Stop: [
      { hooks: [{ type: "command", command: "~/.claude/hooks/event-logger.sh", async: true }] },
    ],
    SubagentStart: [
      { hooks: [{ type: "command", command: "~/.claude/hooks/event-logger.sh", async: true }] },
    ],
    SubagentStop: [
      { hooks: [{ type: "command", command: "~/.claude/hooks/event-logger.sh", async: true }] },
    ],
  },
};

export const allEventNames: string[] = [
  "SessionStart", "SessionEnd", "UserPromptSubmit",
  "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "Notification", "Stop", "SubagentStart", "SubagentStop",
];

export const settingsWithNonHookKeys: Settings = {
  env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1", DISABLE_AUTOUPDATER: "1" },
  permissions: {
    allow: ["Bash(git log *)"],
    defaultMode: "default",
  },
  model: "opus",
  statusLine: { type: "command", command: "~/.claude/claude-statusline.sh" },
  enabledPlugins: { "swift-lsp@claude-plugins-official": true },
  promptSuggestionEnabled: false,
};

export const settingsWithStopTimeout: Settings = {
  hooks: {
    Stop: [
      {
        hooks: [
          { type: "command", command: "~/.claude/hooks/stop-speak.sh", timeout: 15 },
        ],
      },
    ],
  },
};

export const settingsWithNotificationMatchers: Settings = {
  hooks: {
    Notification: [
      {
        matcher: "permission_prompt",
        hooks: [
          { type: "command", command: "~/.claude/hooks/notification-hook.sh" },
        ],
      },
      {
        matcher: "idle_prompt",
        hooks: [
          { type: "command", command: "~/.claude/hooks/notification-hook.sh" },
        ],
      },
    ],
  },
};

export const settingsWithOtherHooks: Settings = {
  hooks: {
    SessionStart: [
      {
        hooks: [
          { type: "command", command: "~/.claude/hooks/notification-hook.sh" },
        ],
      },
    ],
  },
};

export const settingsAlreadyRegistered: Settings = {
  hooks: {
    Stop: [
      {
        hooks: [
          { type: "command", command: "~/.claude/hooks/event-logger.sh", async: true },
        ],
      },
    ],
  },
};

export const settingsWithV2Logger: Settings = {
  hooks: {
    Stop: [
      {
        hooks: [
          { type: "command", command: "~/.claude/hooks/event-logger-v2.sh", async: true },
        ],
      },
    ],
  },
};

