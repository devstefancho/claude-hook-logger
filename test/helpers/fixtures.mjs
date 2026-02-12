/**
 * Shared test fixtures for settings-merge tests.
 */

/** Minimal hooks-config with a single event */
export const minimalHooksConfig = {
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

/** Full hooks-config matching the project's hooks-config.json */
export const fullHooksConfig = {
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

/** All event names from the full config */
export const allEventNames = [
  "SessionStart", "SessionEnd", "UserPromptSubmit",
  "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "Notification", "Stop", "SubagentStart", "SubagentStop",
];

/** Settings object with non-hook keys (env, permissions, model, etc.) */
export const settingsWithNonHookKeys = {
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

/** Settings with existing Stop hook that has timeout */
export const settingsWithStopTimeout = {
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

/** Settings with Notification matcher groups (permission_prompt + idle_prompt) */
export const settingsWithNotificationMatchers = {
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

/** Settings with SessionStart having notification-hook.sh (coexist scenario) */
export const settingsWithOtherHooks = {
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

/** Settings with event-logger already registered */
export const settingsAlreadyRegistered = {
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

/** Settings with a similar but different command (v2) */
export const settingsWithV2Logger = {
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

/** Command pattern used for removal */
export const removePattern = "event-logger\\.sh";
