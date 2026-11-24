import { useEffect, useRef, useState } from 'react';

export interface AudioDurationItem {
  id: string;
  url: string;
}

/**
 * Formats audio duration in seconds (e.g., "0.9s", "1.4s", "12.3s").
 */
export function formatSeconds(sec: number | undefined): string | null {
  if (sec === undefined || !Number.isFinite(sec) || sec <= 0) return null;
  return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`;
}

/**
 * Preloads audio metadata in the background so each item in a list immediately
 * displays its duration in seconds without requiring the user to press Play first.
 */
export function useAudioDurations(
  items: AudioDurationItem[],
  enabled = true,
): Record<string, number> {
  const [durations, setDurations] = useState<Record<string, number>>({});
  const probedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || items.length === 0) return;

    let cancelled = false;
    const loaders: HTMLAudioElement[] = [];

    for (const item of items) {
      const key = `${item.id}|${item.url}`;
      if (probedKeysRef.current.has(key)) continue;
      probedKeysRef.current.add(key);

      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        if (!cancelled && Number.isFinite(audio.duration) && audio.duration > 0) {
          setDurations((prev) => ({ ...prev, [item.id]: audio.duration }));
        }
      };
      audio.onerror = () => {
        // Allow retry if file was still being written
        probedKeysRef.current.delete(key);
      };
      audio.src = item.url;
      loaders.push(audio);
    }

    return () => {
      cancelled = true;
      for (const a of loaders) {
        a.onloadedmetadata = null;
        a.onerror = null;
        a.src = '';
      }
    };
  }, [items, enabled]);

  return durations;
}
