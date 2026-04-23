import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read from localStorage after mount to avoid server/client mismatch.
  // Sets isHydrated=true after reading so the write effect knows it's safe to persist.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch {
      // ignore parse errors — keep initialValue
    }
    setIsHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Only write after hydration to avoid overwriting stored data with initialValue on mount.
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore write errors (e.g. private browsing quota exceeded)
    }
  }, [key, value, isHydrated]);

  return [value, setValue, isHydrated] as const;
}
