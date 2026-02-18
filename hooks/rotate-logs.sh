#!/bin/bash
# Log rotation for Claude Code hook events
# Called on SessionStart. Rotates log if date has changed.

LOG_DIR="$HOME/.claude/hook-logger"
LOG_FILE="$LOG_DIR/hook-events.jsonl"

# Nothing to rotate if log file doesn't exist or is empty
[[ ! -s "$LOG_FILE" ]] && exit 0

# Check the date of the first entry in the current log
FIRST_DATE=$(head -1 "$LOG_FILE" | jq -r '.ts // empty' | cut -d'T' -f1)
TODAY=$(date -u +"%Y-%m-%d")

# If the first entry is from a previous day, rotate
if [[ -n "$FIRST_DATE" && "$FIRST_DATE" != "$TODAY" ]]; then
    # Use the first entry's date as the archive name
    ARCHIVE="$LOG_DIR/hook-events.${FIRST_DATE}.jsonl"

    # If archive already exists for that date, append to it
    if [[ -f "$ARCHIVE" ]]; then
        cat "$LOG_FILE" >> "$ARCHIVE"
    else
        mv "$LOG_FILE" "$ARCHIVE"
    fi

    # Ensure current log is cleared (mv may have done this, but handle append case)
    [[ -f "$LOG_FILE" ]] && : > "$LOG_FILE"
fi

exit 0
