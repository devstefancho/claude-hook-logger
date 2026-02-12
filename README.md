# Claude Hook Logger

Event logging system + web dashboard for Claude Code hooks.

![Dashboard](screenshots/dashboard.png)

## Features

- **Automatic event logging** for all Claude Code hook events (JSONL format)
- **Web dashboard** with session timeline, tool usage charts, interrupt/orphan detection
- **CLI analysis tools** for quick insights from the terminal
- **Safe settings.json merge** — never destroys existing hooks or settings
- **One-command install/uninstall**

## Prerequisites

- [jq](https://jqlang.github.io/jq/)
- [Node.js](https://nodejs.org/) 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

## Quick Start

```bash
git clone https://github.com/devstefancho/claude-hook-logger.git
cd claude-hook-logger
./install.sh
```

This will:
1. Copy hook scripts to `~/.claude/hooks/`
2. Merge event-logger hooks into `~/.claude/settings.json`
3. Create `~/.claude/logs/` for JSONL log output

## Usage

### Web Dashboard

```bash
~/.claude/hooks/log-viewer.sh --open
```

Opens the log viewer at `http://localhost:7777`. Use `--port NNNN` to change the port.

### CLI Analysis

```bash
# Overall summary of today's log
~/.claude/hooks/analyze-interrupts.sh

# Session timeline for a specific session
~/.claude/hooks/analyze-interrupts.sh <logfile> <session_id_prefix>

# Show only interrupts
~/.claude/hooks/analyze-interrupts.sh --interrupts

# Show orphan tool calls (PreToolUse without matching PostToolUse)
~/.claude/hooks/analyze-interrupts.sh --orphans

# Session summary table
~/.claude/hooks/analyze-interrupts.sh --sessions
```

## Log Format

Logs are written as JSONL (one JSON object per line) to `~/.claude/logs/hook-events.jsonl`.

```json
{
  "ts": "2025-01-15T09:30:00.000Z",
  "event": "PreToolUse",
  "session_id": "abc123-def456",
  "cwd": "/Users/you/project",
  "permission_mode": "default",
  "data": {
    "tool_name": "Read",
    "tool_use_id": "tool_01ABC",
    "tool_input_summary": "/src/index.ts"
  }
}
```

## Hook Events

| Event | Timing | Data Fields |
|---|---|---|
| `SessionStart` | Session begins | `source`, `model` |
| `SessionEnd` | Session ends | `reason` |
| `UserPromptSubmit` | User sends prompt | `prompt` (truncated), `prompt_length` |
| `PreToolUse` | Before tool execution | `tool_name`, `tool_use_id`, `tool_input_summary` |
| `PostToolUse` | After tool success | `tool_name`, `tool_use_id`, `success` |
| `PostToolUseFailure` | After tool failure | `tool_name`, `tool_use_id`, `error`, `is_interrupt` |
| `Notification` | System notification | `notification_type`, `message` |
| `Stop` | Agent stop signal | `stop_hook_active` |
| `SubagentStart` | Subagent spawned | `agent_id`, `agent_type` |
| `SubagentStop` | Subagent finished | `agent_id`, `agent_type` |

## Architecture

```
install.sh
  ├── copies scripts → ~/.claude/hooks/
  └── merges settings → ~/.claude/settings.json

Claude Code session
  └── triggers hooks on events
        └── event-logger.sh
              └── appends JSONL → ~/.claude/logs/hook-events.jsonl

log-viewer.sh → node server.mjs → web dashboard (localhost:7777)
analyze-interrupts.sh → CLI summary / session timeline
```

## Uninstall

```bash
cd claude-hook-logger
./uninstall.sh
```

> **Note:** Logs are preserved in `~/.claude/logs/`. Delete them manually if no longer needed.

## Development

```bash
npm test
npm run test:coverage
```

## License

MIT
