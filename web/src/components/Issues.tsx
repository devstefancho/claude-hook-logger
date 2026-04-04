import { useMemo } from "react";
import type { LogEvent } from "../types";
import { formatRelativeTime } from "../utils/format";

interface IssuesProps {
  events: LogEvent[];
  orphanIds: Set<string>;
  onScrollToEvent: (idx: number) => void;
}

export function Issues({ events, orphanIds, onScrollToEvent }: IssuesProps) {
  const interrupts = useMemo(
    () =>
      events.reduce<{ ev: LogEvent; idx: number }[]>((acc, ev, idx) => {
        if (ev.event === "Stop" && ev.data?.stop_hook_active) acc.push({ ev, idx });
        return acc;
      }, []),
    [events],
  );

  const orphans = useMemo(
    () =>
      events.reduce<{ ev: LogEvent; idx: number }[]>((acc, ev, idx) => {
        if (ev.event === "PreToolUse" && ev.data?.tool_use_id && orphanIds.has(ev.data.tool_use_id))
          acc.push({ ev, idx });
        return acc;
      }, []),
    [events, orphanIds],
  );

  if (!interrupts.length && !orphans.length) {
    return <div className="empty-state">No interrupts or orphans detected</div>;
  }

  return (
    <>
      <div className="issues-hint">
        Interrupts: sessions terminated by the stop hook while still active
        <br />
        Orphans: tool calls without a completion response (interrupted/session ended)
      </div>
      {interrupts.map(({ ev, idx }) => (
        <div
          key={`int-${idx}`}
          className="issue-item interrupt-item"
          onClick={() => onScrollToEvent(idx)}
        >
          <div className="issue-label red">&#9889; Interrupt</div>
          <div className="issue-detail">
            {formatRelativeTime(ev.ts)} ago &middot; session{" "}
            {ev.session_id?.slice(0, 8)}
          </div>
        </div>
      ))}
      {orphans.map(({ ev, idx }) => (
        <div
          key={`orph-${idx}`}
          className="issue-item orphan-item"
          onClick={() => onScrollToEvent(idx)}
        >
          <div className="issue-label yellow">&#9888; Orphan Tool Call</div>
          <div className="issue-detail">
            {ev.data?.tool_name} &middot; {formatRelativeTime(ev.ts)} ago
            &middot; session {ev.session_id?.slice(0, 8)}
          </div>
        </div>
      ))}
    </>
  );
}
