import { useState, useCallback, useRef } from "react";
import {
  pendingParams,
  scheduleFlush,
  readParam,
  defaultSerialize,
  defaultDeserialize,
} from "./url-state-core";

interface UseUrlStateOptions<T> {
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
}

export function useUrlState<T extends string | number | boolean | null>(
  key: string,
  defaultValue: T,
  options?: UseUrlStateOptions<T>,
): [T, (value: T | ((prev: T) => T)) => void] {
  const serialize = options?.serialize ?? defaultSerialize;
  const deserialize =
    options?.deserialize ?? ((raw: string) => defaultDeserialize(raw, defaultValue));

  const [value, setValueInternal] = useState<T>(() => {
    const raw = readParam(key);
    if (raw === null) return defaultValue;
    return deserialize(raw);
  });

  const defaultRef = useRef(defaultValue);
  const serializeRef = useRef(serialize);
  serializeRef.current = serialize;

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValueInternal((prev) => {
        const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        const serialized = serializeRef.current(resolved);
        const defaultSerialized = serializeRef.current(defaultRef.current);
        if (serialized === defaultSerialized) {
          pendingParams[key] = null;
        } else {
          pendingParams[key] = serialized;
        }
        scheduleFlush();
        return resolved;
      });
    },
    [key],
  );

  return [value, setValue];
}

export function useUrlSetState(
  key: string,
  defaultSet: Set<string>,
): [Set<string>, (value: Set<string> | ((prev: Set<string>) => Set<string>)) => void] {
  const defaultSorted = [...defaultSet].sort().join(",");

  const [value, setValueInternal] = useState<Set<string>>(() => {
    const raw = readParam(key);
    if (raw === null) return defaultSet;
    if (raw === "") return new Set<string>();
    return new Set(raw.split(","));
  });

  const setValue = useCallback(
    (next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setValueInternal((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        const serialized = [...resolved].sort().join(",");
        if (serialized === defaultSorted) {
          pendingParams[key] = null;
        } else {
          pendingParams[key] = serialized;
        }
        scheduleFlush();
        return resolved;
      });
    },
    [key, defaultSorted],
  );

  return [value, setValue];
}

// Re-export for external use
export { useUrlSetState as useUrlSetState_, useUrlState as useUrlState_ };
