#!/bin/bash
# Claude Code Universal Event Logger
# Reads JSON from stdin, extracts event-specific fields, appends JSONL to log file.
# Used by all hook events via settings.json registration.

LOG_DIR="$HOME/.claude/logs"
LOG_FILE="$LOG_DIR/hook-events.jsonl"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Read JSON input from stdin
INPUT=$(cat)
if [[ -z "$INPUT" ]]; then
    exit 0
fi

# Common fields
TS=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // "unknown"')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
CWD=$(echo "$INPUT" | jq -r '.cwd // "unknown"')
PERM_MODE=$(echo "$INPUT" | jq -r '.permission_mode // empty')

# Build base JSON object
BASE=$(jq -n \
    --arg ts "$TS" \
    --arg event "$EVENT" \
    --arg session_id "$SESSION_ID" \
    --arg cwd "$CWD" \
    --arg perm "$PERM_MODE" \
    '{ts: $ts, event: $event, session_id: $session_id, cwd: $cwd, permission_mode: $perm}')

# Extract event-specific data
case "$EVENT" in
    SessionStart)
        DATA=$(echo "$INPUT" | jq '{source: (.source // null), model: (.model // null)}')
        ;;
    SessionEnd)
        DATA=$(echo "$INPUT" | jq '{reason: (.reason // null)}')
        ;;
    UserPromptSubmit)
        PROMPT=$(echo "$INPUT" | jq -r '.prompt // ""')
        PROMPT_LEN=${#PROMPT}
        # Truncate prompt to 500 chars for logging
        PROMPT_TRUNC=$(echo "$PROMPT" | head -c 500)
        DATA=$(jq -n \
            --arg prompt "$PROMPT_TRUNC" \
            --argjson len "$PROMPT_LEN" \
            '{prompt: $prompt, prompt_length: $len}')
        ;;
    PreToolUse)
        TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
        TOOL_USE_ID=$(echo "$INPUT" | jq -r '.tool_use_id // "unknown"')
        # Extract tool-specific summary based on tool type
        case "$TOOL_NAME" in
            Bash)
                SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.command // empty' | head -c 200)
                ;;
            Read)
                SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
                ;;
            Write)
                SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
                ;;
            Edit)
                SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
                ;;
            Glob)
                SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty')
                ;;
            Grep)
                SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.pattern // empty')
                ;;
            Task)
                SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.description // empty')
                ;;
            WebFetch)
                SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.url // empty')
                ;;
            WebSearch)
                SUMMARY=$(echo "$INPUT" | jq -r '.tool_input.query // empty')
                ;;
            *)
                SUMMARY=$(echo "$INPUT" | jq -r '.tool_input | tostring' 2>/dev/null | head -c 200)
                ;;
        esac
        DATA=$(jq -n \
            --arg tool "$TOOL_NAME" \
            --arg id "$TOOL_USE_ID" \
            --arg summary "$SUMMARY" \
            '{tool_name: $tool, tool_use_id: $id, tool_input_summary: $summary}')
        ;;
    PostToolUse)
        TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
        TOOL_USE_ID=$(echo "$INPUT" | jq -r '.tool_use_id // "unknown"')
        DATA=$(jq -n \
            --arg tool "$TOOL_NAME" \
            --arg id "$TOOL_USE_ID" \
            '{tool_name: $tool, tool_use_id: $id, success: true}')
        ;;
    PostToolUseFailure)
        TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // "unknown"')
        TOOL_USE_ID=$(echo "$INPUT" | jq -r '.tool_use_id // "unknown"')
        ERROR=$(echo "$INPUT" | jq -r '.error // empty' | head -c 300)
        IS_INTERRUPT=$(echo "$INPUT" | jq -r '.is_interrupt // false')
        DATA=$(jq -n \
            --arg tool "$TOOL_NAME" \
            --arg id "$TOOL_USE_ID" \
            --arg error "$ERROR" \
            --argjson interrupt "$IS_INTERRUPT" \
            '{tool_name: $tool, tool_use_id: $id, error: $error, is_interrupt: $interrupt}')
        ;;
    Notification)
        NTYPE=$(echo "$INPUT" | jq -r '.notification_type // empty')
        MSG=$(echo "$INPUT" | jq -r '.message // empty' | head -c 300)
        DATA=$(jq -n \
            --arg ntype "$NTYPE" \
            --arg msg "$MSG" \
            '{notification_type: $ntype, message: $msg}')
        ;;
    Stop)
        STOP_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
        DATA=$(jq -n \
            --argjson active "$STOP_ACTIVE" \
            '{stop_hook_active: $active}')
        ;;
    SubagentStart)
        AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty')
        AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')
        DATA=$(jq -n \
            --arg aid "$AGENT_ID" \
            --arg atype "$AGENT_TYPE" \
            '{agent_id: $aid, agent_type: $atype}')
        ;;
    SubagentStop)
        AGENT_ID=$(echo "$INPUT" | jq -r '.agent_id // empty')
        AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')
        DATA=$(jq -n \
            --arg aid "$AGENT_ID" \
            --arg atype "$AGENT_TYPE" \
            '{agent_id: $aid, agent_type: $atype}')
        ;;
    *)
        DATA='{}'
        ;;
esac

# Merge base + data and append to log file
echo "$BASE" | jq -c --argjson data "$DATA" '. + {data: $data}' >> "$LOG_FILE"

# On SessionStart, trigger log rotation
if [[ "$EVENT" == "SessionStart" ]]; then
    "$HOME/.claude/hooks/rotate-logs.sh" &
fi

exit 0
