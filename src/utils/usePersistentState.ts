/**
 * usePersistentState — persists state to localStorage transparently.
 * Wraps useState with auto-save on every change and safe hydration on mount.
 */
import { useState, useEffect, useCallback } from 'react';

export function usePersistentState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setStateInternal] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Quota exceeded or private mode — fail silently
    }
  }, [key, state]);

  // Stable setter reference
  const setState = useCallback((value: React.SetStateAction<T>) => {
    setStateInternal(value);
  }, []);

  return [state, setState];
}

/** Clear all Aurum Terminal persisted keys */
export function clearAurumStorage(): void {
  const prefix = 'aurum_';
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* noop */ }
}
