export const EVENT_TYPES: Record<string, { badge: string; cls: string }> = {
  PreToolUse:         { badge: "Pre",       cls: "badge-pre" },
  PostToolUse:        { badge: "Post",      cls: "badge-post" },
  PostToolUseFailure: { badge: "Fail",      cls: "badge-fail" },
  UserPromptSubmit:   { badge: "Prompt",    cls: "badge-prompt" },
  Notification:       { badge: "Notif",     cls: "badge-notif" },
  Stop:               { badge: "Stop",      cls: "badge-stop" },
  SessionStart:       { badge: "SessStart", cls: "badge-sess-start" },
  SessionEnd:         { badge: "SessEnd",   cls: "badge-sess-end" },
  SubagentStart:      { badge: "SubStart",  cls: "badge-sub-start" },
  SubagentStop:       { badge: "SubStop",   cls: "badge-sub-stop" },
};
