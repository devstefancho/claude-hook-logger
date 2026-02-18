export function formatRelativeTime(ts: string): string {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 0) return "future";
  if (diff < 60000) return "now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h";
  return Math.floor(diff / 86400000) + "d";
}

export function formatAbsTime(ts: string): string {
  if (!ts) return "--:--:--";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "..." : s;
}
