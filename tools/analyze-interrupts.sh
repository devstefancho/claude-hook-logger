#!/bin/bash
# Interrupt & Session Analysis Tool for Claude Code hook events
# Usage:
#   analyze-interrupts.sh                           # Summary of today's log
#   analyze-interrupts.sh <logfile>                  # Summary of specific log
#   analyze-interrupts.sh <logfile> <session_id>     # Timeline for a session
#   analyze-interrupts.sh --interrupts [logfile]     # Show only interrupts
#   analyze-interrupts.sh --orphans [logfile]         # Show orphan tool calls
#   analyze-interrupts.sh --sessions [logfile]        # Session summary table

LOG_FILE="${2:-$HOME/.claude/hook-logger/hook-events.jsonl}"
MODE="${1:---summary}"

# If first arg is a file path, treat as default summary for that file
if [[ -f "$MODE" ]]; then
    LOG_FILE="$MODE"
    MODE="--summary"
fi

if [[ ! -f "$LOG_FILE" ]]; then
    echo "No log file found: $LOG_FILE"
    exit 1
fi

if ! command -v jq &>/dev/null; then
    echo "Error: jq is required. Install via: brew install jq"
    exit 1
fi

BOLD='\033[1m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

case "$MODE" in
    --interrupts)
        echo -e "${BOLD}=== Direct Interrupts (PostToolUseFailure with is_interrupt=true) ===${NC}"
        jq -r 'select(.event == "PostToolUseFailure" and .data.is_interrupt == true) |
            "\(.ts) | \(.session_id[0:8])... | \(.data.tool_name) | \(.data.error[0:80])"' "$LOG_FILE" | \
        while IFS= read -r line; do
            echo -e "${RED}$line${NC}"
        done
        COUNT=$(jq '[select(.event == "PostToolUseFailure" and .data.is_interrupt == true)] | length' "$LOG_FILE")
        echo -e "\n${BOLD}Total: ${RED}$COUNT${NC} interrupts"
        ;;

    --orphans)
        echo -e "${BOLD}=== Orphan Tool Calls (PreToolUse without matching PostToolUse) ===${NC}"
        # Find PreToolUse IDs that have no corresponding PostToolUse or PostToolUseFailure
        jq -r '
            [., input] |
            null
        ' "$LOG_FILE" > /dev/null 2>&1  # placeholder

        # Use a two-pass approach
        PRE_IDS=$(jq -r 'select(.event == "PreToolUse") | .data.tool_use_id' "$LOG_FILE" | sort)
        POST_IDS=$(jq -r 'select(.event == "PostToolUse" or .event == "PostToolUseFailure") | .data.tool_use_id' "$LOG_FILE" | sort)

        ORPHANS=$(comm -23 <(echo "$PRE_IDS") <(echo "$POST_IDS"))

        if [[ -z "$ORPHANS" ]]; then
            echo -e "${GREEN}No orphan tool calls found.${NC}"
        else
            echo "$ORPHANS" | while read -r orphan_id; do
                jq -r "select(.event == \"PreToolUse\" and .data.tool_use_id == \"$orphan_id\") |
                    \"\(.ts) | \(.session_id[0:8])... | \(.data.tool_name) | \(.data.tool_input_summary[0:80])\"" "$LOG_FILE" | \
                while IFS= read -r line; do
                    echo -e "${YELLOW}$line${NC}"
                done
            done
            ORPHAN_COUNT=$(echo "$ORPHANS" | grep -c .)
            echo -e "\n${BOLD}Total: ${YELLOW}$ORPHAN_COUNT${NC} orphan tool calls (likely interrupted)"
        fi
        ;;

    --sessions)
        echo -e "${BOLD}=== Session Summary ===${NC}"
        echo -e "${CYAN}Session ID       | Events | Tools | Prompts | Interrupts | Duration${NC}"
        echo "-----------------|--------|-------|---------|------------|----------"
        jq -rs '
            group_by(.session_id) | .[] |
            {
                sid: .[0].session_id[0:16],
                total: length,
                tools: [.[] | select(.event == "PreToolUse")] | length,
                prompts: [.[] | select(.event == "UserPromptSubmit")] | length,
                interrupts: [.[] | select(.event == "PostToolUseFailure" and .data.is_interrupt == true)] | length,
                first: .[0].ts,
                last: .[-1].ts
            } |
            "\(.sid) | \(.total | tostring | .[0:6]) | \(.tools | tostring | .[0:5]) | \(.prompts | tostring | .[0:7]) | \(.interrupts | tostring | .[0:10]) | \(.first[11:19])-\(.last[11:19])"
        ' "$LOG_FILE"
        ;;

    *)
        # If second arg looks like a session ID, show timeline
        if [[ -n "$2" && ! -f "$2" ]]; then
            SESSION_FILTER="$2"
            if [[ -f "$1" ]]; then
                LOG_FILE="$1"
            fi
            echo -e "${BOLD}=== Session Timeline: ${SESSION_FILTER} ===${NC}"
            jq -r "select(.session_id | startswith(\"$SESSION_FILTER\")) |
                if .event == \"PreToolUse\" then
                    \"\(.ts[11:19]) \u001b[36m> \(.event)\u001b[0m \(.data.tool_name) \(.data.tool_input_summary[0:60])\"
                elif .event == \"PostToolUse\" then
                    \"\(.ts[11:19]) \u001b[32m< \(.event)\u001b[0m \(.data.tool_name) ok\"
                elif .event == \"PostToolUseFailure\" then
                    if .data.is_interrupt then
                        \"\(.ts[11:19]) \u001b[31m! INTERRUPT\u001b[0m \(.data.tool_name) \(.data.error[0:60])\"
                    else
                        \"\(.ts[11:19]) \u001b[31m< \(.event)\u001b[0m \(.data.tool_name) \(.data.error[0:60])\"
                    end
                elif .event == \"UserPromptSubmit\" then
                    \"\(.ts[11:19]) \u001b[33m>> PROMPT\u001b[0m \(.data.prompt[0:60])\"
                else
                    \"\(.ts[11:19])   \(.event)\"
                end
            " "$LOG_FILE"
            exit 0
        fi

        # Default: overall summary
        echo -e "${BOLD}=== Hook Events Summary ===${NC}"
        echo -e "Log file: ${CYAN}$LOG_FILE${NC}"
        echo ""

        TOTAL=$(jq -s 'length' "$LOG_FILE")
        echo -e "Total events: ${BOLD}$TOTAL${NC}"
        echo ""

        echo -e "${BOLD}Events by type:${NC}"
        jq -rs 'group_by(.event) | .[] | "\(.[0].event): \(length)"' "$LOG_FILE" | sort -t: -k2 -rn

        echo ""
        INTERRUPT_COUNT=$(jq -s '[.[] | select(.event == "PostToolUseFailure" and .data.is_interrupt == true)] | length' "$LOG_FILE")
        echo -e "Direct interrupts: ${RED}$INTERRUPT_COUNT${NC}"

        # Orphan count
        PRE_IDS=$(jq -r 'select(.event == "PreToolUse") | .data.tool_use_id' "$LOG_FILE" | sort)
        POST_IDS=$(jq -r 'select(.event == "PostToolUse" or .event == "PostToolUseFailure") | .data.tool_use_id' "$LOG_FILE" | sort)
        ORPHAN_COUNT=$(comm -23 <(echo "$PRE_IDS") <(echo "$POST_IDS") | grep -c . 2>/dev/null || echo 0)
        echo -e "Orphan tool calls: ${YELLOW}$ORPHAN_COUNT${NC}"

        SESSION_COUNT=$(jq -rs '[.[] | .session_id] | unique | length' "$LOG_FILE")
        echo -e "Sessions: ${BOLD}$SESSION_COUNT${NC}"

        echo ""
        echo -e "${BOLD}Top tools used:${NC}"
        jq -rs '[.[] | select(.event == "PreToolUse") | .data.tool_name] | group_by(.) | sort_by(-length) | .[:10] | .[] | "\(.[0]): \(length)"' "$LOG_FILE"
        ;;
esac

exit 0
