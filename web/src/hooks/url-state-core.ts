// Pure URL state management logic – no React dependency
// Testable in Node.js environment with mocked window/history

export const pendingParams: Record<string, string | null> = {};
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function resetPendingParams() {
  for (const key of Object.keys(pendingParams)) {
    delete pendingParams[key];
  }
}

export function flushToUrl() {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(pendingParams)) {
    if (value === null) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  }
  resetPendingParams();
  window.history.replaceState(window.history.state, "", url.toString());
}

export function scheduleFlush() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    flushToUrl();
  }, 100);
}

export function cancelFlush() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

export function readParam(key: string): string | null {
  const url = new URL(window.location.href);
  return url.searchParams.get(key);
}

export function defaultSerialize<T>(value: T): string {
  return String(value);
}

export function defaultDeserialize<T>(raw: string, defaultValue: T): T {
  if (typeof defaultValue === "number") {
    const n = Number(raw);
    return (Number.isNaN(n) ? defaultValue : n) as T;
  }
  if (typeof defaultValue === "boolean") {
    return (raw === "true") as unknown as T;
  }
  return raw as unknown as T;
}

export function serializeSet(set: Set<string>): string {
  return [...set].sort().join(",");
}

export function deserializeSet(raw: string): Set<string> {
  if (raw === "") return new Set<string>();
  return new Set(raw.split(","));
}
