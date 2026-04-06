import { useState, useCallback, useEffect, useRef } from "react";

export interface FeedItem {
  ts: string;
  sessionId: string;
  type: "stop" | "permission" | "prompt";
  message: string;
}

export function useActivityFeed(enabled: boolean) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevCount = useRef(0);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/activity-feed?limit=50");
      const data = await res.json();
      const feed: FeedItem[] = data.feed || [];
      setItems(feed);
      if (feed.length > prevCount.current) {
        setUnreadCount((c) => c + (feed.length - prevCount.current));
      }
      prevCount.current = feed.length;
    } catch {
      // ignore
    }
  }, []);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  useEffect(() => {
    if (!enabled) return;
    fetchFeed();
    const timer = setInterval(fetchFeed, 10000);
    return () => clearInterval(timer);
  }, [enabled, fetchFeed]);

  return { items, unreadCount, clearUnread, refresh: fetchFeed };
}
