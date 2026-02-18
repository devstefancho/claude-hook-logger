import { useState, useEffect, useRef, useCallback } from "react";

export function useAutoRefresh(onTick: () => void, intervalMs = 5000) {
  const [enabled, setEnabled] = useState(true);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => tickRef.current(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  return { enabled, toggle };
}
